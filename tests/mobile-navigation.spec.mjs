import {test, expect} from '@playwright/test';

async function swipe(page, from, to) {
  const session = await page.context().newCDPSession(page);
  const point = (x,y) => [{x,y,id:1}];
  await session.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:point(...from)});
  for(let i=1;i<=6;i++) {
    await session.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:point(from[0]+(to[0]-from[0])*i/6,from[1]+(to[1]-from[1])*i/6)});
  }
  await session.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
  await session.detach();
}

test.describe('Compact navigation', () => {
  test.use({hasTouch:true});
  for(const width of [320,390,760]) {
    test(`shared header and direct swipes at ${width}px`, async({page}) => {
      await page.setViewportSize({width,height:844});
      await page.goto('./?playIntro=0#top');
      const root = page.locator('html');
      const header = page.locator('.site-header');
      const summary = page.locator('.mobile-navigation summary');
      await expect(root).toHaveAttribute('data-intro','ready');
      await expect(summary).toHaveText('Catalex');
      await expect(page.locator('.header-nav')).toBeHidden();
      await expect(page.locator('.header-download')).toBeHidden();
      await expect(page.locator('.header-replay')).toBeVisible();
      const before = await header.boundingBox();
      const cat = await header.locator('.brand img').boundingBox();
      await page.screenshot({path:`output/compact-welcome-${width}.png`});
      await swipe(page,[width/2,510],[width/2,410]);
      await expect(root).toHaveAttribute('data-intro','complete');
      await expect(page).toHaveURL(/#main$/);
      await expect(page.locator('.action-flight,.wordmark-flight')).toHaveCount(0);
      expect(await header.boundingBox()).toEqual(before);
      expect(await header.locator('.brand img').boundingBox()).toEqual(cat);
      await expect(page.locator('.header-download')).toBeHidden();
      await expect(page.locator('.header-github')).toBeVisible();
      await expect(page.locator('.header-replay')).toBeHidden();
      await page.screenshot({path:`output/compact-main-${width}.png`});
      // A swipe while reading content must remain ordinary page scrolling.
      await page.evaluate(()=>scrollTo({top:600,behavior:'instant'}));
      await swipe(page,[width/2,250],[width/2,370]);
      await expect(root).toHaveAttribute('data-intro','complete');
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
      await swipe(page,[width/2,250],[width/2,370]);
      await expect(root).toHaveAttribute('data-intro','ready');
      await expect(page).toHaveURL(/#top$/);
      expect(await header.boundingBox()).toEqual(before);
      await expect(page.locator('.main-return-scroll')).toBeHidden();
      // Sideways motion must not change screens.
      await swipe(page,[width/2-50,470],[width/2+50,455]);
      await expect(root).toHaveAttribute('data-intro','ready');
      await summary.click();
      await page.screenshot({path:`output/compact-menu-${width}.png`});
      await page.locator('.mobile-navigation').getByRole('link',{name:'Documentation',exact:true}).click();
      await expect(summary).toHaveText('Documentation');
      await expect(page.locator('.mobile-navigation')).not.toHaveAttribute('open');
      const titleFont = await summary.evaluate(el=>getComputedStyle(el).font);
      await summary.click();
      await page.locator('.mobile-navigation').getByRole('link',{name:'Changelog',exact:true}).click();
      await expect(summary).toHaveText('Changelog');
      expect(await summary.evaluate(el=>getComputedStyle(el).font)).toBe(titleFont);
      expect(await header.locator('.brand img').boundingBox()).toEqual(cat);
      await summary.click();
      await page.keyboard.press('Escape');
      await expect(page.locator('.mobile-navigation')).not.toHaveAttribute('open');
      await expect(summary).toBeFocused();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    });
  }
});

test('Replay expands left without moving the desktop icon', async({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./?playIntro=0#top');
  await expect(page.locator('html')).toHaveAttribute('data-intro','ready');
  const button = page.locator('.header-replay');
  const icon = button.locator('svg');
  const before = await button.boundingBox();
  const iconBefore = await icon.boundingBox();
  await button.hover();
  await expect.poll(async()=>Math.round((await button.boundingBox()).width)).toBe(110);
  const after = await button.boundingBox();
  expect(after.x).toBeLessThan(before.x);
  expect(Math.abs(after.x+after.width-before.x-before.width)).toBeLessThan(1);
  expect(await icon.boundingBox()).toEqual(iconBefore);
  const label = await button.locator('span').boundingBox();
  expect(label.x+label.width).toBeLessThan(iconBefore.x);
  await page.screenshot({path:'output/replay-expands-left.png'});
});

test('Mobile crossfades both screens without being cut short by viewport resize', async({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('./?playIntro=0#top');
  const root=page.locator('html');
  await expect(root).toHaveAttribute('data-intro','ready');
  await expect(page.locator('.terminal-actions a[href$="download/"]')).toBeHidden();
  async function inspectFade() {
    return page.evaluate(() => {
      const nodes=[document.querySelector('.intro-scene'),document.querySelector('#main')];
      return nodes.map(el=>{
        const animation=el.getAnimations().find(a=>a.effect.getTiming().duration===420);
        if(!animation) return null;
        animation.pause();
        animation.currentTime=210;
        const style=getComputedStyle(el);
        return {opacity:Number(style.opacity),transform:style.transform};
      });
    });
  }
  await page.locator('.intro-scene .terminal-scroll').dispatchEvent('click');
  expect(await inspectFade()).toEqual([{opacity:.5,transform:'none'},{opacity:.5,transform:'none'}]);
  await page.setViewportSize({width:390,height:800});
  await expect(root).toHaveAttribute('data-intro','docking');
  await page.screenshot({path:'output/mobile-crossfade-enter.png'});
  await page.evaluate(()=>document.getAnimations().forEach(a=>a.play()));
  await expect(root).toHaveAttribute('data-intro','complete');
  await expect(page.locator('.header-download')).toBeHidden();
  await page.screenshot({path:'output/mobile-github-only.png'});
  await page.locator('.site-header .brand').click();
  await expect(root).toHaveAttribute('data-intro','returning');
  expect(await inspectFade()).toEqual([{opacity:.5,transform:'none'},{opacity:.5,transform:'none'}]);
  await page.setViewportSize({width:390,height:844});
  await expect(root).toHaveAttribute('data-intro','returning');
  await expect(page.locator('.header-github')).toBeHidden();
  await page.screenshot({path:'output/mobile-crossfade-return.png'});
  await page.evaluate(()=>document.getAnimations().forEach(a=>a.play()));
  await expect(root).toHaveAttribute('data-intro','ready');
});

test('Narrow-screen scrolling switches directly without the desktop progress stage', async({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('./?playIntro=0#top');
  const root=page.locator('html');
  await expect(root).toHaveAttribute('data-intro','ready');
  await expect(page.locator('.intro-scene .terminal-scroll > span')).toBeHidden();
  await page.locator('.intro-scene').dispatchEvent('wheel',{deltaY:70});
  await expect(root).toHaveAttribute('data-intro','complete');
  await page.locator('body').dispatchEvent('wheel',{deltaY:-70});
  await expect(page.locator('.main-return-scroll')).toBeHidden();
  await expect(root).toHaveAttribute('data-intro','ready');
  await page.screenshot({path:'output/mobile-swipe-no-progress.png'});
});
