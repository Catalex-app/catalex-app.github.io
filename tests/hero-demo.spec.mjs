import {test,expect,webkit} from '@playwright/test';

async function connection(page,changes={}) {
  await page.addInitScript(changes=>Object.defineProperty(navigator,'connection',{configurable:true,value:{saveData:false,effectiveType:'4g',downlink:10,addEventListener(){},...changes}}),changes);
}

test('Main demo loops without controls and follows visibility and motion preferences',async({page})=>{
  await connection(page);
  await page.emulateMedia({reducedMotion:'no-preference'});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./#main');
  const video=page.locator('.hero-demo-video');
  const frame=page.locator('.hero-window');
  await expect(frame).toHaveClass(/is-playing/);
  expect(await video.evaluate(el=>el.muted && el.loop && el.playsInline)).toBe(true);
  await expect.poll(()=>video.evaluate(el=>el.currentTime)).toBeGreaterThan(.15);
  const image=await page.locator('.hero-demo-poster').boundingBox();
  const movie=await video.boundingBox();
  expect(Math.abs(image.height-movie.height)).toBeLessThan(1);
  await expect(page.getByRole('button',{name:/^(Pause|Play) demo$/})).toHaveCount(0);
  await video.evaluate(el=>el.currentTime=el.duration-.15);
  await expect.poll(()=>video.evaluate(el=>el.currentTime)).toBeLessThan(2);
  await page.evaluate(()=>scrollTo({top:document.body.scrollHeight,behavior:'instant'}));
  await expect.poll(()=>video.evaluate(el=>el.paused)).toBe(true);
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  await expect.poll(()=>video.evaluate(el=>el.paused)).toBe(false);
  await page.screenshot({path:'output/main-hero-video-desktop.png'});
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect.poll(()=>video.evaluate(el=>el.paused)).toBe(true);
  await expect(video).toHaveCSS('opacity','0');
  await expect(page.locator('.hero-demo-poster')).toBeVisible();
  await expect(page.locator('.hero-demo-toggle')).toBeHidden();
  expect(errors).toEqual([]);
});

test('Welcome leaves the video unloaded until Main entry finishes',async({page})=>{
  await connection(page);
  await page.goto('./?playIntro=0');
  await expect(page.locator('html')).toHaveAttribute('data-intro','ready');
  await expect(page.locator('.hero-demo-video')).not.toHaveAttribute('src');
  await page.getByRole('button',{name:'Scroll down to learn more'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-intro','complete');
  await expect(page.locator('.hero-window')).toHaveClass(/is-playing/);
});

for(const [name,network,motion] of [
  ['reduced motion',{},'reduce'],
  ['Save Data',{saveData:true},'no-preference'],
]) {
  test(`demo keeps its still frame without a video request for ${name}`,async({page})=>{
    await connection(page,network);
    await page.emulateMedia({reducedMotion:motion});
    const requests=[];
    page.on('request',request=>{if(request.url().endsWith('hero-demo.mp4'))requests.push(request.url());});
    await page.setViewportSize({width:390,height:844});
    await page.goto('./#main');
    await expect(page.locator('html')).toHaveAttribute('data-intro','complete');
    await expect(page.locator('.hero-demo-poster')).toBeVisible();
    await expect(page.locator('.hero-demo-video')).not.toHaveAttribute('src');
    await expect(page.locator('.hero-demo-video')).toHaveCSS('opacity','0');
    await page.waitForTimeout(150);
    expect(requests).toEqual([]);
    if(name==='reduced motion')await page.screenshot({path:'output/main-hero-video-poster-phone.png'});
  });
}

// Embedded browsers may report stale/low bandwidth even for instant localhost media.
for(const [name,network] of [['2G estimate',{effectiveType:'2g'}],['low bandwidth estimate',{downlink:.5}]]) {
  test(`fast media autoplays despite a ${name}`,async({page})=>{
    await connection(page,network);
    await page.goto('./#main');
    await expect(page.locator('.hero-window')).toHaveClass(/is-playing/);
    await expect(page.locator('.hero-window')).toHaveAttribute('data-demo-state','playing');
    await expect.poll(()=>page.locator('.hero-demo-video').evaluate(el=>el.currentTime)).toBeGreaterThan(.15);
  });
}

test('failed media preserves the poster and usable navigation',async({page})=>{
  await connection(page);
  await page.route('**/hero-demo.mp4',route=>route.abort());
  const failed=page.waitForEvent('requestfailed',request=>request.url().endsWith('hero-demo.mp4'));
  await page.goto('./#main');
  await failed;
  await expect(page.locator('.hero-demo-video')).not.toHaveAttribute('src');
  await expect(page.locator('.hero-demo-video')).toHaveCSS('opacity','0');
  await expect(page.locator('.hero-demo-poster')).toBeVisible();
  await expect(page.locator('.hero-demo-toggle')).toBeHidden();
  await page.locator('.header-download').click();
  await expect(page.getByRole('heading',{name:'Welcome to Catalex.'})).toBeVisible();
});

test('slow video loading times out to the still frame',async({page})=>{
  await connection(page);
  await page.clock.install();
  let release;
  const held=new Promise(resolve=>release=resolve);
  await page.route('**/hero-demo.mp4',async route=>{await held;await route.abort();});
  await page.goto('./#main');
  await expect(page.locator('.hero-demo-video')).toHaveAttribute('src','./assets/hero-demo.mp4');
  await page.clock.fastForward(5100);
  await expect(page.locator('.hero-demo-video')).not.toHaveAttribute('src');
  await expect(page.locator('.hero-demo-poster')).toBeVisible();
  await expect(page.locator('.hero-demo-toggle')).toBeHidden();
  release();
});

test('blocked autoplay returns to the still frame',async({page})=>{
  await connection(page);
  await page.addInitScript(()=>HTMLMediaElement.prototype.play=function(){window.demoAutoplayAttempted=true;return Promise.reject(new DOMException('Autoplay blocked','NotAllowedError'));});
  await page.goto('./#main');
  await page.waitForFunction(()=>window.demoAutoplayAttempted);
  await expect(page.locator('.hero-demo-video')).not.toHaveAttribute('src');
  await expect(page.locator('.hero-demo-video')).toHaveCSS('opacity','0');
  await expect(page.locator('.hero-demo-poster')).toBeVisible();
});


for(const [width,height] of [[1440,1000],[390,844]]) {
  test(`WebKit autoplays after refresh and Welcome entry at ${width}px`,async({baseURL})=>{
    const browser=await webkit.launch();
    try {
      const page=await browser.newPage({baseURL,viewport:{width,height},reducedMotion:'no-preference'});
      const ranges=[];
      page.on('response',response=>{if(response.url().endsWith('hero-demo.mp4'))ranges.push(response.status());});
      await page.goto('./?playIntro=0#top', {waitUntil:'domcontentloaded'});
      await expect(page.locator('html')).toHaveAttribute('data-intro','ready');
      await page.getByRole('button',{name:'Scroll down to learn more'}).click();
      for(let attempt=0;attempt<2;attempt++) {
        await expect(page.locator('html')).toHaveAttribute('data-intro','complete');
        await expect(page).toHaveURL(/#main$/);
        await expect(page.locator('.hero-window')).toHaveClass(/is-playing/,{timeout:10000});
        const video=page.locator('.hero-demo-video');
        await expect.poll(()=>video.evaluate(el=>el.currentTime)).toBeGreaterThan(.2);
        expect(await video.evaluate(el=>el.error)).toBeNull();
        await expect(page.getByRole('button',{name:/^(Pause|Play) demo$/})).toHaveCount(0);
        // A looping media request can keep WebKit's load event pending on Linux.
        // The next iteration explicitly checks Main readiness and actual playback.
        if(attempt===0)await page.reload({waitUntil:'domcontentloaded'});
      }
      expect(ranges).toContain(206);
      await page.screenshot({path:`output/hero-demo-webkit-${width}.png`});
    } finally {await browser.close();}
  });
}

test('media server supports WebKit byte probes, seeking ranges, and HEAD',async({request})=>{
  const path='./assets/hero-demo.mp4';
  const full=await request.get(path);
  expect(full.status()).toBe(200);
  const bytes=await full.body();
  expect(Number(full.headers()['content-length'])).toBe(bytes.length);
  const cases=[['bytes=0-1',0,1],['bytes=1000-1999',1000,1999],['bytes=-16',bytes.length-16,bytes.length-1],[`bytes=${bytes.length-16}-`,bytes.length-16,bytes.length-1],[`bytes=${bytes.length-2}-${bytes.length+100}`,bytes.length-2,bytes.length-1]];
  for(const [range,start,end] of cases) {
    const response=await request.get(path,{headers:{Range:range}});
    expect(response.status()).toBe(206);
    expect(response.headers()['content-type']).toBe('video/mp4');
    expect(response.headers()['accept-ranges']).toBe('bytes');
    expect(response.headers()['content-range']).toBe(`bytes ${start}-${end}/${bytes.length}`);
    expect(Number(response.headers()['content-length'])).toBe(end-start+1);
    expect(await response.body()).toEqual(bytes.subarray(start,end+1));
  }
  const head=await request.head(path,{headers:{Range:'bytes=0-1'}});
  expect(head.status()).toBe(206);
  expect(head.headers()['content-length']).toBe('2');
  expect((await head.body()).length).toBe(0);
  for(const range of [`bytes=${bytes.length}-`,'bytes=10-1','bytes=-0','bytes=-','bytes=0-1,3-4']) {
    const response=await request.get(path,{headers:{Range:range}});
    expect(response.status()).toBe(416);
    expect(response.headers()['content-range']).toBe(`bytes */${bytes.length}`);
    expect((await response.body()).length).toBe(0);
  }
});
