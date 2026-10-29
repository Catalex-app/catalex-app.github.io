import {test, expect} from "@playwright/test";

for (const width of [390, 1440]) {
  test(`printer lights and reveals one formula line before scroll entry at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000});
    await page.emulateMedia({reducedMotion: "no-preference"});
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => { if (response.status() >= 400) errors.push(response.url()); });
    await page.goto("./?intro=typewriter");
    const root = page.locator("html");
    const scene = page.getByRole("dialog");
    const formula = scene.locator(".reaction");
    await expect(root).toHaveAttribute("data-intro", "dark");
    await expect(formula).toHaveCSS("font-family", /CatalexMath/);
    await expect(scene.locator(".intro-letter, .typewriter-paper-image")).toHaveCount(0);
    expect(await page.locator("#main").evaluate(el => el.inert)).toBe(true);
    expect(await scene.locator(".printer-actions").evaluate(el => el.inert)).toBe(true);
    await expect(scene.locator(".printer-actions")).toHaveCSS("opacity", "1");
    await expect(scene.locator(".printer-actions")).toHaveCSS("visibility", "visible");
    await expect(scene.locator(".printer-actions")).toHaveCSS("transition-property", "none");
    await expect(scene.getByRole("button", {name: "Scroll down to learn more", includeHidden: true})).toBeDisabled();
    await expect(root).toHaveAttribute("data-intro", "illuminating");
    const initial = await formula.evaluate(el => {
      const box = el.getBoundingClientRect();
      const first = el.firstElementChild.getBoundingClientRect();
      const head = document.querySelector(".printer-carriage").getBoundingClientRect();
      const right = Number(getComputedStyle(el).clipPath.match(/inset\([^ ]+ ([0-9.]+)%/)[1]);
      const cone = document.querySelector(".printer-light-opening").getBBox();
      return {headX: head.x, nozzleX: head.x + head.width * 12 / 220, coneWidth: cone.width, coneHeight: cone.height,
        inkX: box.left + box.width * (1 - right / 100), researchRight: first.right};
    });
    expect(Math.abs(initial.nozzleX - initial.researchRight)).toBeLessThan(1);
    expect(Math.abs(initial.inkX - initial.researchRight)).toBeLessThan(1);
    await page.waitForTimeout(180);
    expect(Math.abs((await scene.locator(".printer-carriage").boundingBox()).x - initial.headX)).toBeLessThan(1);
    await page.screenshot({path: `output/printer-research-reveal-${width}.png`});
    await page.mouse.wheel(0, 600);
    await expect(root).not.toHaveAttribute("data-intro", "docking");
    await page.evaluate(() => {
      window.printerTrack = [];
      const record = () => {
        const head = document.querySelector(".printer-carriage").getBoundingClientRect();
        const rail = document.querySelector(".printer-rails").getBoundingClientRect();
        window.printerTrack.push({time: performance.now(), headX: head.x, headY: head.y, railY: rail.y, phase: document.documentElement.dataset.intro});
        if (document.documentElement.dataset.intro !== "ready") requestAnimationFrame(record);
      };
      record();
    });
    await expect(root).toHaveAttribute("data-intro", "printing");
    const scanStart = await formula.evaluate(el => getComputedStyle(el).clipPath);
    const headStart = await scene.locator(".printer-carriage").boundingBox();
    await page.waitForTimeout(600);
    expect(await formula.evaluate(el => getComputedStyle(el).clipPath)).not.toBe(scanStart);
    const headLater = await scene.locator(".printer-carriage").boundingBox();
    expect(headLater.x - headStart.x).toBeGreaterThan(width === 390 ? 20 : 70);
    // During the actual pass, the ink edge must meet the SVG's left nozzle,
    // and the nozzle must be on the formula rather than below it.
    const mechanicalSamples = await page.evaluate(async () => {
      const result = [];
      for (let i = 0; i < 24; i++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const formula = document.querySelector(".typewriter-intro .reaction");
        const box = formula.getBoundingClientRect();
        const head = document.querySelector(".printer-carriage").getBoundingClientRect();
        const clip = getComputedStyle(formula).clipPath;
        const right = Number(clip.match(/inset\([^ ]+ ([0-9.]+)%/)[1]);
        const inkX = box.left + box.width * (1 - right / 100);
        const nozzleX = head.left + head.width * 12 / 220;
        const nozzleY = head.top + head.height * 142 / 212;
        const sceneStyle = getComputedStyle(document.querySelector(".typewriter-intro"));
        const cone = document.querySelector(".printer-light-opening").getBBox();
        result.push({
          xError: Math.abs(inkX - nozzleX),
          yError: Math.abs(nozzleY - box.top - box.height / 2),
          lampWidth: parseFloat(sceneStyle.getPropertyValue("--lamp-width")),
          beamTranslation: new DOMMatrix(getComputedStyle(document.querySelector(".printer-beam")).transform).m41,
          coneWidth: cone.width, coneHeight: cone.height,
        });
      }
      return result;
    });
    expect(Math.max(...mechanicalSamples.map(sample => sample.xError))).toBeLessThan(1);
    expect(Math.max(...mechanicalSamples.map(sample => sample.yError))).toBeLessThan(1);
    expect(mechanicalSamples.every(sample => sample.coneWidth === initial.coneWidth && sample.coneHeight === initial.coneHeight)).toBe(true);
    // The beam extends left of the nozzle by its full width.
    expect(Math.abs(mechanicalSamples[0].beamTranslation + mechanicalSamples[0].lampWidth)).toBeLessThan(1);
    await page.screenshot({path: `output/printer-dark-printing-${width}.png`});
    await expect(root).toHaveAttribute("data-intro", "lighting", {timeout: 8000});
    // The whole printed equation is inside the light before the ambient reveal.
    const illuminated = await scene.locator(".reaction").evaluate(el => {
      const opening = document.querySelector(".printer-light-opening");
      const local = opening.getCTM().inverse();
      return [...el.querySelectorAll(":scope > .reactant, :scope > .operator, .catalyst-brand")].every(term => {
        const box = term.getBoundingClientRect();
        return [[box.left, box.top], [box.right, box.top], [box.left, box.bottom], [box.right, box.bottom]]
          .every(([x, y]) => opening.isPointInFill(new DOMPoint(x, y).matrixTransform(local)));
      });
    });
    expect(illuminated).toBe(true);
    const coneLeft = await scene.locator(".printer-light-opening").evaluate(el => {
      const box = el.getBBox();
      return new DOMPoint(box.x, box.y).matrixTransform(el.getCTM()).x;
    });
    expect(coneLeft).toBeGreaterThanOrEqual(10);
    expect(coneLeft).toBeLessThanOrEqual(25);
    const lightBefore = Number(await scene.locator(".printer-ambient-light").getAttribute("opacity"));
    await page.waitForTimeout(180);
    expect(Number(await scene.locator(".printer-ambient-light").getAttribute("opacity"))).toBeGreaterThan(lightBefore);
    await expect(scene.locator(".printer-actions")).toHaveCSS("opacity", "1");
    expect(await scene.locator(".printer-actions").evaluate(el => el.getAnimations().length)).toBe(0);
    await expect(scene.locator(".printer-night")).toHaveCSS("opacity", "1");
    await expect(root).toHaveAttribute("data-intro", "ready");
    const track = await page.evaluate(() => window.printerTrack);
    const printing = track.filter(item => item.phase === "printing");
    const travel = printing.slice(1).map((item, index) => item.headX - printing[index].headX);
    expect(Math.min(...travel)).toBeGreaterThanOrEqual(-.01);
    const start = printing[0].time;
    const duration = 3200;
    const speedIn = (from, to) => {
      const samples = printing.slice(1).flatMap((item, index) => {
        const elapsed = (item.time - start) / duration;
        const delta = item.time - printing[index].time;
        return elapsed >= from && elapsed <= to && delta > 0
          ? [(item.headX - printing[index].headX) / delta] : [];
      });
      return samples.reduce((sum, speed) => sum + speed, 0) / samples.length;
    };
    // The rendered carriage gains speed smoothly and brakes before parking.
    expect(speedIn(.3, .6)).toBeGreaterThan(speedIn(0, .15) * 1.5);
    expect(speedIn(.3, .6)).toBeGreaterThan(speedIn(.85, .98) * 1.5);
    expect(travel.filter(delta => delta > .1).length).toBeGreaterThan(24);
    expect(Math.max(...track.map(item => item.headY)) - Math.min(...track.map(item => item.headY))).toBeLessThan(1);
    expect(Math.max(...track.map(item => item.railY)) - Math.min(...track.map(item => item.railY))).toBeLessThan(1);
    await expect(scene.getByRole("link", {name: "Beta is now available"})).toBeVisible();
    await expect(scene.getByRole("link", {name: "GitHub"})).toHaveAttribute("href", "https://github.com/RicercarG/Catalex");
    await expect(scene.getByRole("button", {name: "Scroll down to learn more"})).toBeEnabled();
    const layout = await formula.evaluate(el => {
      const box = el.getBoundingClientRect();
      const terms = [...el.querySelectorAll(":scope > .reactant, :scope > .operator")].map(node => node.getBoundingClientRect().top);
      return {left: box.left, right: box.right, terms};
    });
    expect(layout.left).toBeGreaterThanOrEqual(13);
    expect(layout.right).toBeLessThanOrEqual(width - 13);
    expect(Math.max(...layout.terms) - Math.min(...layout.terms)).toBeLessThan(2);
    await expect(scene.locator(".product")).toHaveText("Paper");
    const buttons = await scene.locator(".printer-actions").boundingBox();
    const parked = await scene.locator(".printer-carriage").boundingBox();
    expect(Math.abs(buttons.x + buttons.width / 2 - width / 2)).toBeLessThan(1);
    expect(parked.x).toBeGreaterThan(layout.right);
    expect(parked.x + parked.width).toBeLessThanOrEqual(width - 13);
    const rail = await scene.locator(".printer-rails").boundingBox();
    expect(Math.abs(rail.y + rail.height / 2 - parked.y - parked.height * 25 / 212)).toBeLessThan(1);
    expect(rail.y + rail.height).toBeLessThan(parked.y + parked.height * 91 / 212);
    expect(buttons.y).toBeGreaterThan(parked.y + parked.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.waitForTimeout(550);
    await page.screenshot({path: `output/printer-ready-${width}.png`});
    // Scroll input during printing was ignored; only ready-state input accumulates.
    await page.mouse.click(8, 8);
    await page.keyboard.press("Escape");
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(120);
    await expect(root).toHaveAttribute("data-intro", "ready");
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(120);
    await expect(root).toHaveAttribute("data-intro", "ready");
    await page.mouse.wheel(0, 40);
    await expect(root).toHaveAttribute("data-intro", "docking");
    await expect(root).toHaveAttribute("data-intro", "complete");
    await expect(scene).toHaveCount(0);
    expect(await page.locator("#main").evaluate(el => el.inert)).toBe(false);
    await expect(page.locator(".site-header .brand")).not.toBeFocused();
    await expect(page.getByRole("heading", {level: 1})).toHaveText("A catalyst for your next paper.");
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.reload();
    await expect(root).toHaveAttribute("data-intro", "dark");
    expect(errors).toEqual([]);
  });
}

test("reduced motion presents the lit landing screen and keyboard entry works", async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: "reduce"});
  await page.goto("./?intro=typewriter");
  const scene = page.getByRole("dialog");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  await expect(scene.locator(".reaction")).toHaveCSS("clip-path", "none");
  await expect(scene.locator(".printer-night")).toHaveCSS("opacity", "0");
  await page.clock.install();
  await page.clock.fastForward(120000);
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  await page.keyboard.press("Tab");
  await expect(scene.getByRole("link", {name: "Beta is now available"})).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(scene.getByRole("link", {name: "GitHub"})).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(scene.getByRole("button", {name: "Scroll down to learn more"})).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(scene).toHaveCount(0);
  await expect(page.locator(".site-header .brand")).toBeFocused();
});

test("the landing download action works without entering the main screen", async ({page}) => {
  await page.emulateMedia({reducedMotion: "reduce"});
  await page.goto("./?intro=typewriter");
  await page.getByRole("dialog").getByRole("link", {name: "Beta is now available"}).click();
  await expect(page.getByRole("heading", {name: "Welcome to Catalex."})).toBeVisible();
});

test("touch scroll accumulation enters while pinch and horizontal wheel do not", async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: "reduce"});
  await page.goto("./?intro=typewriter");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  await page.getByRole("dialog").dispatchEvent("wheel", {deltaY: 400, ctrlKey: true});
  await page.getByRole("dialog").dispatchEvent("wheel", {deltaX: 400, deltaY: 0});
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  const touch = (type, y) => page.evaluate(({type, y}) => {
    const target = document.querySelector(".intro-scene");
    const point = new Touch({identifier: 1, target, clientX: 190, clientY: y});
    target.dispatchEvent(new TouchEvent(type, {touches: [point], bubbles: true, cancelable: true}));
  }, {type, y});
  await touch("touchstart", 700);
  await touch("touchmove", 580);
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  await touch("touchmove", 430);
  await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
});

test("line-mode wheel input and reverse scrolling use the same entry threshold", async ({page}) => {
  await page.emulateMedia({reducedMotion: "reduce"});
  await page.goto("./?intro=typewriter");
  const scene = page.getByRole("dialog");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  await scene.dispatchEvent("wheel", {deltaY: 10, deltaMode: 1});
  await scene.dispatchEvent("wheel", {deltaY: -6, deltaMode: 1});
  await scene.dispatchEvent("wheel", {deltaY: 10, deltaMode: 1});
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  await scene.dispatchEvent("wheel", {deltaY: 3, deltaMode: 1});
  await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
});

test("resize and live reduced motion settle the screen without entering", async ({page}) => {
  await page.emulateMedia({reducedMotion: "no-preference"});
  await page.goto("./?intro=typewriter");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "printing");
  await page.emulateMedia({reducedMotion: "reduce"});
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  await page.setViewportSize({width: 844, height: 390});
  const scene = page.getByRole("dialog");
  const buttons = await scene.locator(".printer-actions").boundingBox();
  const hint = await scene.locator(".printer-scroll").boundingBox();
  expect(buttons.y + buttons.height).toBeLessThan(hint.y - 8);
  const formula = await scene.locator(".reaction").boundingBox();
  expect(formula.x).toBeGreaterThan(0);
  expect(formula.x + formula.width).toBeLessThan(844);
  expect(await page.locator("#main").evaluate(el => el.inert)).toBe(true);
  await page.keyboard.press("PageDown");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
});

for (const asset of ["typewriter-intro.svg", "typewriter-head.svg", "typewriter-paper.svg"]) {
  test(`an unavailable printer asset ${asset} reveals the usable website`, async ({page}) => {
    await page.route(`**/assets/${asset}`, route => route.abort());
    await page.goto("./?intro=typewriter");
    await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.locator("#main").evaluate(el => el.inert)).toBe(false);
    await page.getByRole("link", {name: "Beta is now available"}).click();
    await expect(page.getByRole("heading", {name: "Welcome to Catalex."})).toBeVisible();
  });
}
