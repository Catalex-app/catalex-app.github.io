import {test, expect} from '@playwright/test';

for (const width of [1440, 390]) {
  test(`header cat slides while navigation stays fixed at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height:950});
    await page.goto('./?playIntro=0#top');
    await expect(page.locator('html')).toHaveAttribute('data-intro', 'ready');
    await page.evaluate(() => document.fonts.ready);
    const geometry = () => {
      const rect = s => document.querySelector(s).getBoundingClientRect().toJSON();
      return {cat:rect('.site-header .brand img'), nav:rect('.header-nav'), brand:rect('.site-header .brand')};
    };
    const welcome = await page.evaluate(geometry);
    expect(welcome.cat.x).toBeGreaterThan(welcome.brand.x + 40);
    await page.screenshot({path:`output/header-cat-welcome-${width}.png`});
    await page.getByRole('button', {name:'Scroll down to learn more'}).click();
    await expect(page.locator('html')).toHaveAttribute('data-intro', 'docking');
    await page.evaluate(() => document.getAnimations().forEach(a => { a.pause(); a.currentTime = 525; }));
    const mid = await page.evaluate(geometry);
    expect(mid.cat.x).toBeLessThan(welcome.cat.x);
    expect(mid.cat.x).toBeGreaterThan(welcome.brand.x);
    expect(Math.abs(mid.nav.x - welcome.nav.x)).toBeLessThan(1);
    await page.screenshot({path:`output/header-cat-docking-${width}.png`});
    await page.evaluate(() => document.getAnimations().forEach(a => a.play()));
    await expect(page.locator('html')).toHaveAttribute('data-intro', 'complete');
    const main = await page.evaluate(geometry);
    expect(Math.abs(main.nav.x - welcome.nav.x)).toBeLessThan(1);
    expect(Math.abs(main.cat.x - main.brand.x)).toBeLessThan(1);
    await page.locator('.site-header .brand').click();
    await page.mouse.move(width - 10, 200); // Keep the cat's hover rotation out of geometry checks.
    await expect(page.locator('html')).toHaveAttribute('data-intro', 'ready');
    await expect.poll(async () => Math.abs((await page.evaluate(geometry)).cat.x - welcome.cat.x)).toBeLessThan(1);
    expect(Math.abs((await page.evaluate(geometry)).nav.x - welcome.nav.x)).toBeLessThan(1);
    await page.screenshot({path:`output/header-cat-returned-${width}.png`});
  });
}
