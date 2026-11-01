import {test, expect} from "@playwright/test";

const wheel = (page, deltaY, extra = {}) => page.locator("body").dispatchEvent("wheel", {deltaY, ...extra});
const atTop = async page => {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    scrollTo({top:0, behavior:"instant"});
  });
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
};

test("trackpad input tolerates sideways starts, zero samples and direction jitter", async ({page}) => {
  await page.goto("./#main");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
  await atTop(page);
  const hint = page.locator(".main-return-scroll");
  await page.evaluate(() => {
    for (const [deltaX, deltaY] of [[0, 0], [0.8, -0.2], [0.1, -0.5]]) {
      document.body.dispatchEvent(new WheelEvent("wheel", {bubbles:true, deltaX, deltaY}));
    }
  });
  await expect(hint).toHaveCSS("opacity", "1");
  expect(await hint.evaluate(el => Number(el.style.getPropertyValue("--scroll-progress")))).toBe(0);
  await page.evaluate(async () => {
    for (let i = 0; i < 36; i++) {
      for (const [deltaX, deltaY] of [[0, 0], [0.8, -0.2], [0, 0.5], [0.4, -8]]) {
        document.body.dispatchEvent(new WheelEvent("wheel", {bubbles:true, deltaX, deltaY}));
      }
      await new Promise(resolve => setTimeout(resolve, 16));
    }
  });
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  await expect(page).toHaveURL(/#top$/);
});

test("continuous trackpad input crossing the top never needs an idle gap", async ({page}) => {
  await page.goto("./#main");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
  await atTop(page);
  const hint = page.locator(".main-return-scroll");
  await page.evaluate(async () => {
    const send = deltaY => document.body.dispatchEvent(new WheelEvent("wheel", {bubbles:true, deltaY}));
    scrollTo({top:100, behavior:"instant"});
    send(-10);
    scrollTo({top:0, behavior:"instant"});
    // A decaying momentum tail, followed immediately by another finger swipe.
    for (let i = 0; i < 20; i++) {
      send(-0.5);
      await new Promise(resolve => setTimeout(resolve, 16));
    }
    send(-12);
  });
  await expect(hint).toBeVisible();
  expect(await hint.evaluate(el => Number(el.style.getPropertyValue("--scroll-progress")))).toBeGreaterThan(0);
  await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
  await page.screenshot({path:"output/return-trackpad-continuous.png"});
});

test("native small pixel wheel events reveal the hint and accumulate progress", async ({page}) => {
  await page.goto("./#main");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
  await atTop(page);
  await page.mouse.move(600, 220);
  await page.mouse.wheel(0.5, -2);
  const hint = page.locator(".main-return-scroll");
  await expect(hint).toHaveCSS("opacity", "1");
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0.5, -6);
  await expect.poll(() => hint.evaluate(el => Number(el.style.getPropertyValue("--scroll-progress")))).toBeGreaterThan(0);
  await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
});

for (const width of [1440]) {
  test(`upward scroll at Main's top reveals progress and returns to Welcome at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height:950});
    await page.goto("./#main");
    await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
    await atTop(page);
    const hint = page.locator(".main-return-scroll");
    await expect(hint).toBeHidden();
    await wheel(page, -70);
    await expect(hint).toBeVisible();
    expect(await hint.evaluate(el => Number(el.style.getPropertyValue("--scroll-progress")))).toBe(0);
    await expect(hint).toHaveCSS("opacity", "1");
    await wheel(page, -70);
    expect(await hint.evaluate(el => Number(el.style.getPropertyValue("--scroll-progress")))).toBeGreaterThan(0);
    await page.screenshot({path:`output/return-scroll-${width}.png`});
    await wheel(page, -70);
    await wheel(page, -70);
    await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
    await wheel(page, -70);
    await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
    await expect(page).toHaveURL(/#top$/);
    await expect(hint).toBeHidden();
    await expect(page.locator(".intro-scene")).toHaveCount(1);
    // The existing entry gesture still works and returns do not replay Intro.
    await page.getByRole("button", {name:"Scroll down to learn more"}).click();
    await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
    await expect(hint).toBeHidden();
  });
}

test("arrival reveals an empty prompt; zoom, horizontal scrolling and dialogs are excluded", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("./#main");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
  const hint = page.locator(".main-return-scroll");
  // Simulate reaching the top during the same continuous wheel gesture.
  await page.evaluate(() => {
    scrollTo({top:400, behavior:"instant"});
    document.body.dispatchEvent(new WheelEvent("wheel", {bubbles:true, deltaY:-80}));
    scrollTo({top:0, behavior:"instant"});
    for (let i=0; i<6; i++) document.body.dispatchEvent(new WheelEvent("wheel", {bubbles:true, deltaY:-80}));
  });
  await expect(hint).toBeVisible();
  expect(await hint.evaluate(el => Number(el.style.getPropertyValue("--scroll-progress")))).toBe(0);
  await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
  await page.waitForTimeout(220); // The reveal stage finishes, even with reduced motion.
  await wheel(page, -1000); // One large wheel event must not return immediately.
  await expect(hint).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
  await wheel(page, 20);
  await expect(hint).toBeHidden();
  await wheel(page, -80, {ctrlKey:true});
  await wheel(page, -80, {deltaX:100});
  await expect(hint).toBeHidden();
  await page.getByRole("button", {name:"Expand", exact:true}).click();
  await wheel(page, -1000);
  await expect(hint).toBeHidden();
  await page.keyboard.press("Escape");
  await atTop(page);
  await page.waitForTimeout(220);
  await wheel(page, -70);
  await expect(hint).toBeVisible();
  await expect(hint).toBeHidden({timeout:4000}); // Idle prompt expires after three seconds.
});

test("partial progress persists across short pauses, then fades after inactivity", async ({page}) => {
  await page.goto("./#main");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
  await atTop(page);
  const hint = page.locator(".main-return-scroll");
  await wheel(page, -70);
  await expect(hint).toHaveCSS("opacity", "1");
  await wheel(page, -70);
  await page.waitForTimeout(1200);
  await expect(hint).toBeVisible();
  await wheel(page, -70);
  const progress = await hint.evaluate(el => Number(el.style.getPropertyValue("--scroll-progress")));
  expect(progress).toBeCloseTo(140 / 260);
  await page.waitForTimeout(2200);
  await expect(hint).toBeVisible();
  expect(await hint.evaluate(el => Number(el.style.getPropertyValue("--scroll-progress")))).toBe(progress);
  // Inspect the actual exit animation before it hides the element.
  await expect.poll(() => hint.evaluate(el => el.getAnimations().some(a => a.playState === "running" && a.effect.getKeyframes().at(-1).opacity === "0")), {intervals:[20]}).toBe(true);
  await expect(hint).toBeHidden();
  await wheel(page, -70);
  await expect(hint).toBeVisible();
  expect(await hint.evaluate(el => Number(el.style.getPropertyValue("--scroll-progress")))).toBe(0);
});
