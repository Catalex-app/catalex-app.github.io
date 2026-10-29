import { test, expect } from "@playwright/test";

test("neutral page, real captures, and local links work under a Pages subpath", async ({
	page,
}) => {
	const errors = [],
		failed = [];
	page.on("pageerror", (e) => errors.push(e.message));
	page.on("response", (r) => {
		if (r.status() >= 400) failed.push(r.url());
	});
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("./");
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"A catalyst for your next paper.",
	);
	await expect(page.locator(".eyebrow")).toHaveCount(0);
	await expect(page.locator(".highlight-card")).toHaveCount(6);
	await expect(page.locator("iframe")).toHaveCount(0);
	await expect(page.locator(".highlight-card a")).toHaveCount(0);
	expect(
		await page.locator("body").evaluate((e) => getComputedStyle(e).color),
	).toBe("rgb(24, 24, 27)");
	for (const link of await page.locator('a[href^="#"]').all())
		await expect(page.locator(await link.getAttribute("href"))).toHaveCount(1);
	for (const image of await page.locator("img").all()) {
		await image.scrollIntoViewIfNeeded();
		await expect
			.poll(() => image.evaluate((e) => e.complete && e.naturalWidth > 0))
			.toBe(true);
	}
	expect(failed).toEqual([]);
	expect(errors).toEqual([]);
});

test("highlight navigation respects boundaries, restarts, and supports keys", async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("./");
	const dots = page.locator(".carousel-dots button");

	await expect(page.getByRole("button", { name: "Previous highlight" })).toBeDisabled();
	await page.locator(".highlight-track").focus();
	await page.keyboard.press("ArrowLeft");
	await expect(dots.first()).toHaveAttribute("aria-pressed", "true");
	await dots.last().click();
	await expect(page.getByRole("button", { name: "Previous highlight" })).toBeEnabled();
	await expect(dots.last()).toHaveAttribute("aria-pressed", "true");
	await expect(page.locator("#highlight-next span")).toHaveText("Start over");
	await page.getByRole("button", { name: "Start over", exact: true }).click();
	await expect(page.getByRole("button", { name: "Next highlight" })).toBeVisible();
	await expect(dots.nth(0)).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("button", { name: "Previous highlight" })).toBeDisabled();
	await page.locator(".highlight-track").focus();
	await page.keyboard.press("ArrowRight");
	await expect(dots.nth(1)).toHaveAttribute("aria-pressed", "true");

});

test("highlights stay put until manually navigated", async ({ page }) => {
	await page.clock.install();
	await page.goto("./");
	await page.locator(".highlight-track").scrollIntoViewIfNeeded();
	await page.mouse.move(0, 0);
	await page.clock.fastForward(30000);
	await expect(page.locator(".carousel-dots button").first()).toHaveAttribute("aria-pressed", "true");
	await expect(page.locator("#highlight-play")).toHaveCount(0);
});

for (const width of [360, 390, 768, 949, 1440]) {
	test(`layout fits at ${width}px and highlights support keyboard navigation`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 1000 });
		await page.goto("./");
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
		).toBe(true);
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.locator('.highlight-track').focus();
		await page.keyboard.press('ArrowRight');
		await expect(page.locator('.carousel-dots button').nth(1)).toHaveAttribute('aria-pressed', 'true');
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.screenshot({
			path: `output/revised-${width}.png`,
			fullPage: true,
		});
	});
}

test("root preview serves the workspace and blocks private project files", async ({
	request,
}) => {
	for (const resource of [
		"",
		"assets/workspace/index.html",
		"assets/workspace/paper.json",
	])
		expect((await request.get(`http://127.0.0.1:4323/${resource}`)).ok()).toBe(
			true,
		);
	for (const resource of [
		".git/config",
		"docs/website/01-story-and-structure.md",
		"workspace-demo/main.tsx",
	])
		expect(
			(await request.get(`http://127.0.0.1:4323/${resource}`)).status(),
		).toBe(404);
});

for (const width of [390, 1010]) {
  test(`top links reveal the full header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./#top");
    const expectTop = async () => {
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      expect(await page.locator(".site-header").evaluate(el => el.getBoundingClientRect().top)).toBe(0);
    };
    await expectTop();
    for (const selector of [".site-header .brand", ".site-footer .brand", ".site-footer a:last-child"]) {
      await page.locator("#for-researchers").scrollIntoViewIfNeeded();
      await page.locator(selector).click();
      await expectTop();
    }
  });
}

for (const width of [390, 1010]) {
  test(`highlights overlay preserves the overview at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./#highlights");
    const source = page.locator("#highlights .highlight-card");
    const content = cards => cards.map(card => ({
      title: card.querySelector("h2, h3").textContent,
      copy: [...card.querySelectorAll(".card-copy p")].map(p => p.textContent),
      image: card.querySelector("img").getAttribute("src"),
    }));
    const overview = await source.evaluateAll(content);
    await page.locator('.carousel-dots button').nth(2).click();
    await expect(page.locator('.carousel-dots button').nth(2)).toHaveAttribute('aria-pressed', 'true');
    const opener = page.getByRole("button", {name: "Expand", exact: true});
    await opener.scrollIntoViewIfNeeded();
    const position = await page.evaluate(() => ({y: scrollY, left: document.querySelector('#highlights .highlight-track').scrollLeft, url: location.href}));
    await opener.click();
    const dialog = page.getByRole("dialog", {name: await page.locator("#highlights-title").textContent(), exact: true});
    await expect(dialog).toBeVisible();
    const details = await dialog.locator('.highlight-card').evaluateAll(cards => cards.map(card => ({
      title: card.querySelector('h2').textContent,
      copy: [...card.querySelectorAll('.card-copy p')].map(p => p.textContent),
      image: document.querySelector(`.highlights-stage [data-scene="${card.dataset.scene}"] img`).getAttribute('src'),
    })));
    expect(details).toEqual(overview);
    expect(page.url()).toBe(position.url);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const menu = dialog.getByRole("navigation", {name: "Highlight sections"});
    await page.evaluate(() => document.fonts.ready);
    const menuSizes = () => menu.locator('a').evaluateAll(links => links.map(link => ({width:link.offsetWidth, height:link.offsetHeight, top:link.offsetTop})));
    const initialMenuSizes = await menuSizes();
    await expect(menu.locator('a[href="#highlight-agent"]')).toHaveAttribute('aria-current', 'location');
    for (const scene of ["comments", "history", "write"]) {
      const link = menu.locator(`a[href="#highlight-${scene}"]`);
      await link.click();
      await expect(link).toHaveAttribute("aria-current", "location");
      expect(await menuSizes()).toEqual(initialMenuSizes);
      await expect(dialog.locator(`.highlights-stage [data-scene="${scene}"]`)).toHaveAttribute('aria-hidden', 'false');
      await expect(dialog.locator(`#highlight-${scene}`)).toBeInViewport();
    }
    // Native modal focus remains inside the overlay in both directions.
    await dialog.getByRole('button', {name:'Close', exact:true}).focus();
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('dialog'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => ({y:scrollY, left:document.querySelector('#highlights .highlight-track').scrollLeft,url:location.href}))).toEqual(position);
    await opener.click();
    await expect(menu.locator('a[href="#highlight-agent"]')).toHaveAttribute('aria-current', 'location');
    await dialog.getByRole('button', {name:'Close', exact:true}).click();
    await expect(dialog).not.toBeVisible();
    await page.goto('./?view=highlights#highlight-review');
    await expect(dialog).toBeVisible();
    await expect(menu.locator('a[href="#highlight-review"]')).toHaveAttribute('aria-current', 'location');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', {name:'Catalex highlights, at a glance.'})).toBeInViewport();
  });
}

for (const width of [390, 1010]) {
  test(`scroll reveals replay and respect motion preferences at ${width}px`, async ({ page }) => {
    await page.setViewportSize({width, height:1000});
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-intro', 'complete');
    const story = page.locator('.agent-story');
    await expect(story).toHaveAttribute('data-reveal', 'pending');
    await page.evaluate(() => document.querySelector('#your-agent').scrollIntoView({behavior:'instant'}));
    await expect(story).toHaveAttribute('data-reveal', 'visible');
    await expect.poll(() => story.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
    await expect.poll(() => story.evaluate(el => el.getAnimations().length)).toBe(0);
    await page.evaluate(() => scrollTo({top:0,behavior:'instant'}));
    await expect(story).toHaveAttribute('data-reveal', 'pending');
    await page.evaluate(() => document.querySelector('#your-agent').scrollIntoView({behavior:'instant'}));
    await expect(story).toHaveAttribute('data-reveal', 'visible');
    await expect.poll(() => story.evaluate(el => el.getAnimations().length)).toBe(1);
    await expect.poll(() => story.evaluate(el => el.getAnimations().length)).toBe(0);
    await page.emulateMedia({reducedMotion:'reduce'});
    await expect(page.locator('[data-reveal="pending"]')).toHaveCount(0);
    await page.getByRole('button',{name:'Expand',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    expect(await dialog.locator('.highlight-track').evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.locator('[data-reveal="pending"]')).toHaveCount(0);
    expect(await story.evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
  });
}

for (const width of [390, 1010]) {
  test(`expanded highlights pin the visual and scroll freely at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:1000});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('./#highlights');
    await page.getByRole('button',{name:'Expand',exact:true}).click();
    const dialog=page.getByRole('dialog');
    const stage=dialog.locator('.highlights-stage');
    const stageTop=await stage.evaluate(el=>el.getBoundingClientRect().top);
    await page.mouse.move(width-60,800);
    await page.mouse.wheel(0,175);
    await expect.poll(()=>dialog.evaluate(el=>Math.round(el.scrollTop))).toBe(96);
    await page.waitForTimeout(350);
    expect(await dialog.evaluate(el=>Math.round(el.scrollTop))).toBe(96);
    expect(await stage.evaluate(el=>el.getBoundingClientRect().top)).toBe(stageTop);
    expect(await dialog.evaluate(el=>getComputedStyle(el).scrollSnapType)).toBe('none');
    const delta = await dialog.evaluate(el => {
      const rect = el.querySelector('#highlight-git').getBoundingClientRect();
      const top = innerWidth <= 820 ? el.querySelector('.highlights-stage').getBoundingClientRect().bottom : 80;
      return rect.top + rect.height / 2 - (top + (innerHeight - top) / 2);
    });
    await page.mouse.wheel(0,delta / .55);
    await expect(dialog.locator('.highlights-menu a[href="#highlight-git"]')).toHaveAttribute('aria-current','location');
    await expect(stage.locator('[data-scene="git"]')).toHaveAttribute('aria-hidden','false');
    expect(await stage.evaluate(el=>el.getBoundingClientRect().top)).toBe(stageTop);
    await dialog.locator('.highlights-menu a[href="#highlight-write"]').click();
    await expect(stage.locator('[data-scene="write"]')).toHaveAttribute('aria-hidden','false');
    await expect(dialog.locator('.highlights-close')).toBeInViewport();
  });
}


test('expanded wheel motion settles and yields to navigation', async ({page}) => {
  await page.setViewportSize({width:1010,height:1000});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('./#highlights');
  await page.evaluate(()=>document.fonts.ready);
  await page.getByRole('button',{name:'Expand',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await page.mouse.move(800,600);
  await page.mouse.wheel(0,200);
  await expect.poll(()=>dialog.evaluate(el=>Math.round(el.scrollTop))).toBe(110);
  await page.mouse.wheel(0,900);
  await dialog.locator('.highlights-menu a[href="#highlight-write"]').click();
  await expect.poll(()=>dialog.evaluate(el=>Math.round(el.scrollTop))).toBe(0);
  await page.waitForTimeout(200);
  expect(await dialog.evaluate(el=>Math.round(el.scrollTop))).toBe(0);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

for (const width of [390, 1010]) {
  test(`equation forms, brand docks, and refresh replays at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000});
    await page.emulateMedia({reducedMotion: 'no-preference'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('./#top');
    const root = page.locator('html');
    const scene = page.locator('.intro-scene');
    const opacity = locator => locator.evaluate(el => Number(getComputedStyle(el).opacity));
    await expect(root).toHaveAttribute('data-intro', 'forming');
    await expect(scene).toBeVisible();
    expect(await opacity(page.locator('#main'))).toBe(0);
    expect(await opacity(page.locator('.header-download'))).toBe(0);
    expect(await opacity(scene.locator('.product .intro-letter').last())).toBe(0);
    await expect.poll(() => opacity(scene.locator('.product .intro-letter').last()), {intervals: [50]}).toBe(1);
    const sourceMark = await scene.locator('.catalyst-brand').boundingBox();
    const sourceArrow = await scene.locator('.reaction-arrow').boundingBox();
    const sourceText = await scene.locator('.catalyst-brand > span').boundingBox();
    const sourceIcon = await scene.locator('.catalyst-cat').boundingBox();
    expect(Math.abs(sourceMark.x + sourceMark.width / 2 - sourceArrow.x - sourceArrow.width / 2)).toBeLessThan(1);
    expect(sourceText.x + sourceText.width).toBeLessThanOrEqual(sourceMark.x + sourceMark.width + 1);
    expect(sourceIcon.width).toBe(36);
    await page.screenshot({path: `output/intro-equation-${width}.png`});
    await expect(root).toHaveAttribute('data-intro', 'docking');
    const mark = page.locator('.site-header .brand');
    const moving = await mark.boundingBox();
    expect(moving.y).toBeGreaterThan(100);
    expect(moving.x).toBeGreaterThan(32);
    await page.screenshot({path: `output/intro-docking-${width}.png`});
    await expect(root).toHaveAttribute('data-intro', 'complete');
    await expect(scene).toHaveCount(0);
    expect(await opacity(page.locator('#main'))).toBe(1);
    expect(await opacity(page.locator('.header-download'))).toBe(1);
    expect((await mark.boundingBox()).y).toBeLessThan(40);
    await page.screenshot({path: `output/intro-settled-${width}.png`});
    await page.evaluate(() => scrollTo({top: 1600, behavior: 'instant'}));
    await page.evaluate(() => scrollTo({top: 0, behavior: 'instant'}));
    await expect(scene).toHaveCount(0);
    await page.evaluate(() => scrollTo({top: 1600, behavior: 'instant'}));
    await page.reload();
    await expect(root).toHaveAttribute('data-intro', 'forming');
    await expect(scene).toBeVisible();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await page.keyboard.press('Tab');
    await expect(scene).toHaveCount(0);
    await expect(page.getByRole('link', {name: 'Skip to content'})).toBeFocused();
    expect(await opacity(page.locator('#main'))).toBe(1);
    expect(errors).toEqual([]);
  });
}

test('intro types individual characters and draws shaft before arrowhead', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 1000});
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-intro', 'forming');
  const frame = async time => {
    await page.locator('.intro-scene').evaluate((scene, time) => {
      for (const animation of scene.getAnimations({subtree: true})) {
        animation.pause();
        animation.currentTime = time;
      }
    }, time);
  };
  const visibleText = selector => page.locator(selector).first().evaluate(el =>
    [...el.querySelectorAll('.intro-letter')]
      .filter(letter => getComputedStyle(letter).opacity === '1')
      .map(letter => letter.textContent).join(''));
  const offset = selector => page.locator(selector).evaluate(el => parseFloat(getComputedStyle(el).strokeDashoffset));
  await frame(250);
  expect(await visibleText('.intro-scene .reactant')).toBe('Resea');
  expect(await visibleText('.intro-scene .operator')).toBe('');
  expect(await visibleText('.intro-scene .product')).toBe('');
  await page.screenshot({path: 'output/intro-typewriter.png'});
  await frame(1900);
  expect(await visibleText('.intro-scene .reactant')).toBe('Researchhuman');
  expect(await visibleText('.catalyst-brand')).toBe('Catalex');
  expect(await offset('.reaction-shaft')).toBeGreaterThan(0);
  expect(await offset('.reaction-shaft')).toBeLessThan(1);
  expect(await offset('.reaction-head')).toBe(1);
  await page.screenshot({path: 'output/intro-shaft.png'});
  await frame(2250);
  expect(await offset('.reaction-shaft')).toBe(0);
  expect(await offset('.reaction-head')).toBeGreaterThan(0);
  expect(await offset('.reaction-head')).toBeLessThan(1);
  await page.screenshot({path: 'output/intro-arrowhead.png'});
  await frame(2570);
  expect(await visibleText('.intro-scene .product')).toBe('Paper');
  const mark = await page.locator('.catalyst-brand').boundingBox();
  const arrow = await page.locator('.reaction-arrow').boundingBox();
  expect(Math.abs(mark.x + mark.width / 2 - arrow.x - arrow.width / 2)).toBeLessThan(1);
  expect(arrow.y + arrow.height / 2 - mark.y - mark.height).toBeCloseTo(10, 0);
  await page.screenshot({path: 'output/intro-alignment.png'});
  await page.keyboard.press('Escape');
  await expect(page.locator('.intro-scene')).toHaveCount(0);
});

test('intro yields to reduced motion, resize, and section navigation', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('./');
  await expect(page.locator('.intro-scene')).toHaveCount(0);
  expect(await page.locator('#main').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.reload();
  await expect(page.locator('.intro-scene')).toBeVisible();
  await page.emulateMedia({reducedMotion: 'reduce'});
  await expect(page.locator('.intro-scene')).toHaveCount(0);
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.reload();
  await expect(page.locator('.intro-scene')).toBeVisible();
  await page.setViewportSize({width: 700, height: 800});
  await expect(page.locator('.intro-scene')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.intro-scene')).toBeVisible();
  await page.mouse.wheel(0, 200);
  await expect(page.locator('.intro-scene')).toHaveCount(0);
  await page.goto('./#highlights');
  await expect(page.locator('.intro-scene')).toHaveCount(0);
  await expect(page.locator('#highlights-title')).toBeInViewport();
});

test('landing page stays usable when JavaScript is unavailable', async ({browser}) => {
  const context = await browser.newContext({javaScriptEnabled: false});
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4322/catalex.github.io/');
  await expect(page.locator('.intro-scene')).not.toBeVisible();
  await expect(page.getByRole('heading', {level: 1})).toBeVisible();
  await page.getByRole('link', {name: 'Beta is now available'}).click();
  await expect(page.getByRole('heading', {name: 'Welcome to Catalex.'})).toBeVisible();
  await context.close();
});

test('a missing main script cannot leave the landing page hidden', async ({page}) => {
  await page.route('**/app.js', route => route.abort());
  await page.goto('./');
  await expect(page.locator('html')).toHaveClass(/intro-pending/);
  await page.waitForFunction(() => !document.documentElement.classList.contains('intro-pending'), null, {timeout: 10000});
  await expect(page.locator('.intro-scene')).not.toBeVisible();
  expect(await page.locator('#main').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
});

for (const width of [390, 1040]) {
  test(`download page links and placeholder work at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000});
    await page.emulateMedia({reducedMotion: 'reduce'});
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
    await page.goto('./');
    await page.getByRole('link', {name: 'Beta is now available'}).click();
    await expect(page).toHaveURL(/\/catalex\.github\.io\/download\/$/);
    await expect(page.getByRole('heading', {name: 'Welcome to Catalex.'})).toBeVisible();
    expect(await page.locator('.download-icon').evaluate(img => img.complete && img.naturalWidth === 512)).toBe(true);
    const url = page.url();
    await page.getByRole('button', {name: 'Download', exact: true}).click();
    expect(page.url()).toBe(url);
    await page.locator('.site-header .brand').click();
    await page.locator('.header-download').click();
    await expect(page).toHaveURL(url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: `output/download-${width}.png`, fullPage: true});
    expect(failures).toEqual([]);
  });
}
