import {test,expect} from '@playwright/test';

test.use({browserName:'webkit', reducedMotion:'no-preference', trace:'retain-on-failure'});
for(const [width,height] of [[1440,1000],[390,844]]) {
  test(`WebKit autoplays after refresh and Welcome entry at ${width}px`,async({page})=>{
      await page.setViewportSize({width,height});
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
      // WebKit may fetch the full file on Linux or byte ranges on macOS.
      // The media-server test separately verifies exact 206 range semantics.
      expect(ranges.some(status => status === 200 || status === 206)).toBe(true);
      await page.screenshot({path:`output/hero-demo-webkit-${width}.png`});
  });
}
