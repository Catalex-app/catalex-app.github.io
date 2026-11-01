import {test, expect} from '@playwright/test';

for (const width of [1440, 390]) {
  test(`workflow grows once and can replay at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000});
    await page.emulateMedia({reducedMotion: 'no-preference'});
    await page.goto('./#main');
    const figure = page.locator('.review-figure');
    const replay = page.getByRole('button', {name: 'Replay workflow animation'});
    await expect(figure).toHaveAttribute('data-flow-state', 'pending');
    await expect(replay).toBeHidden();
    await figure.evaluate(el => el.scrollIntoView({block: 'center', behavior: 'instant'}));
    await expect(figure).toHaveAttribute('data-flow-state', 'playing');
    // Inspect real rendered keyframes without timing-sensitive screenshots.
    const offsets = new Map();
    for (const time of [800, 1000, 2250, 2400, 3800, 4600, 5100]) {
      await figure.evaluate((el, time) => {
        for (const animation of el.getAnimations({subtree: true})) {
          animation.pause();
          animation.currentTime = time;
        }
      }, time);
      await expect(replay).toBeHidden();
      offsets.set(time, await figure.locator('.flow-lines path').evaluateAll(paths => paths.map(path => parseFloat(getComputedStyle(path).strokeDashoffset))));
      if (time >= 2250) await figure.screenshot({path: `output/workflow-${width}-${time}.png`});
      if (time === 3800 || time === 4600) {
        await expect(figure.locator('.review-gate')).toHaveCSS('background-color', time === 3800 ? 'rgb(255, 255, 255)' : 'rgb(22, 128, 76)');
        await expect(figure.locator('.review-gate')).toHaveCSS('color', time === 3800 ? 'rgb(24, 24, 27)' : 'rgb(255, 255, 255)');
        const remaining = offsets.get(time)[2];
        expect(remaining).toBeCloseTo(await figure.locator('.accepted-line').evaluate(el => el.getTotalLength()), 2);
      }
    }
    // Paths hold at the project and worktree nodes while their labels appear.
    expect(offsets.get(800)[0]).toBeCloseTo(offsets.get(1000)[0], 2);
    expect(offsets.get(2250)).toEqual(offsets.get(2400));
    await expect(figure.locator('.review-gate')).toHaveCSS('opacity', '1');
    expect(await figure.locator('.accepted-line').evaluate(el => parseFloat(getComputedStyle(el).strokeDashoffset))).toBeGreaterThan(0);
    await figure.evaluate(el => el.getAnimations({subtree: true}).forEach(animation => animation.finish()));
    await expect(figure).toHaveAttribute('data-flow-state', 'complete');
    await expect(replay).toBeVisible();
    await expect(figure.locator('.review-gate')).toHaveCSS('background-color', 'rgb(22, 128, 76)');
    await expect(figure.locator('.review-gate')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await figure.screenshot({path: `output/workflow-${width}-complete.png`});
    await replay.click();
    await expect(figure).toHaveAttribute('data-flow-state', 'playing');
    await expect(replay).toBeHidden();
    await expect(figure.locator('.review-gate')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(figure.locator('.review-gate')).toHaveCSS('color', 'rgb(24, 24, 27)');
    await page.evaluate(() => scrollTo({top: 0, behavior: 'instant'}));
    await expect.poll(() => figure.evaluate(el => el.getAnimations({subtree: true}).every(a => a.playState === 'paused'))).toBe(true);
    await figure.evaluate(el => el.scrollIntoView({block: 'center', behavior: 'instant'}));
    await expect(figure).toHaveAttribute('data-flow-state', 'complete', {timeout: 8500});
    await page.evaluate(() => scrollTo({top: 0, behavior: 'instant'}));
    await figure.evaluate(el => el.scrollIntoView({block: 'center', behavior: 'instant'}));
    await expect(figure).toHaveAttribute('data-flow-state', 'complete');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('reduced motion shows the full graph and stops an active replay', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('./#your-agent');
  const figure = page.locator('.review-figure');
  const replay = page.getByRole('button', {name: 'Replay workflow animation'});
  await expect(figure).toHaveAttribute('data-flow-state', 'complete');
  await expect(replay).toBeHidden();
  await expect(figure.locator('.review-gate')).toHaveCSS('opacity', '1');
  await expect(figure.locator('.accepted-line')).toHaveCSS('stroke-dasharray', 'none');
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await replay.click();
  await expect(figure).toHaveAttribute('data-flow-state', 'playing');
  await page.emulateMedia({reducedMotion: 'reduce'});
  await expect(figure).toHaveAttribute('data-flow-state', 'complete');
  await expect(replay).toBeHidden();
  expect(await figure.evaluate(el => el.getAnimations({subtree: true}).length)).toBe(0);
});
