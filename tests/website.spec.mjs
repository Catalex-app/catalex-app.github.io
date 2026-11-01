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
	await page.goto("./#main");
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"A catalyst for your next paper.",
	);
	await expect(page.locator(".eyebrow")).toHaveCount(0);
	await expect(page.locator("#main .hero-actions")).toHaveCount(0);
	const github=page.locator(".header-github");
	await expect(github).toHaveAccessibleName("GitHub");
	await expect(github).toHaveAttribute("href","https://github.com/Catalex-app/Catalex");
	await expect(github).toHaveText("");
	const downloadBox=await page.locator(".header-download").boundingBox();
	const githubBox=await github.boundingBox();
	expect(githubBox.x).toBeGreaterThan(downloadBox.x+downloadBox.width);
	expect(githubBox.height).toBeCloseTo(downloadBox.height,0);
	await expect(page.locator(".highlight-card")).toHaveCount(6);
	await expect(page.locator('.highlight-card[data-scene="write"] img')).toHaveAttribute("src","./assets/workspace-editor.jpg");
	await expect(page.locator("#highlights video, #highlights .highlight-demo-replay")).toHaveCount(0);
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
	await page.goto("./#main");
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
	await page.goto("./#main");
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
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto("./#main");
		await expect(page.locator('html')).toHaveAttribute('data-intro', 'complete');
		await page.evaluate(() => document.fonts.ready);
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
		).toBe(true);
		const hero=await page.locator('.hero').boundingBox();
		const copy=await page.locator('.hero-copy').boundingBox();
		const demo=await page.locator('.hero-workspace').boundingBox();
		expect(demo.y-copy.y-copy.height).toBeGreaterThanOrEqual(27);
		expect(Math.abs(demo.width-hero.width)).toBeLessThan(1);
		// Classic scrollbars reserve layout space on Linux and Windows.
		const contentBox = await page.locator('body').boundingBox();
		expect(Math.abs(demo.x+demo.width/2-contentBox.x-contentBox.width/2)).toBeLessThan(1);
		await expect(page.locator('.hero-copy')).toHaveCSS('text-align','center');
		await page.emulateMedia({ reducedMotion: "reduce" });
		const track = page.locator('.highlight-track');
		await track.scrollIntoViewIfNeeded();
		await track.focus();
		await expect(track).toBeFocused();
		await page.keyboard.press('ArrowRight');
		await expect(page.locator('.carousel-dots button').nth(1)).toHaveAttribute('aria-pressed', 'true');
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.screenshot({
			path: `output/revised-${width}.png`,
			fullPage: true,
		});
	});
}

test("root preview serves the site and blocks private project files", async ({
	request,
}) => {
	expect((await request.get("http://127.0.0.1:4323/")).ok()).toBe(true);
	// Capture bundles may be generated locally, but must never enter the deployed build.
	for (const resource of ["assets/workspace/index.html", "assets/workspace/paper.json"])
		expect((await request.get(`./${resource}`)).status()).toBe(404);
	for (const resource of [
		".git/config",
		".githubissues.json",
		".env",
		".release-env.sh",
		"docs/website/01-story-and-structure.md",
		"workspace-demo/main.tsx",
	])
		expect(
			(await request.get(`http://127.0.0.1:4323/${resource}`)).status(),
		).toBe(404);
});

for (const width of [390, 1010]) {
  test(`Main header stays sticky and top links work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./#top");
    await page.getByRole("button",{name:"Scroll down to learn more"}).click();
    const expectTop = async () => {
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      expect(await page.locator(".site-header").evaluate(el => el.getBoundingClientRect().top)).toBe(width<600 ? 12 : 16);
    };
    await expectTop();
    const header=page.locator(".site-header");
    await expect(header).toHaveCSS("position","sticky");
    await expect(header).toHaveCSS("background-color","rgba(255, 255, 255, 0.96)");
    await expect(header).toHaveCSS("border-radius",width<600 ? "12px" : "14px");
    for(const top of [450,1200]) {
      await page.evaluate(top=>scrollTo({top,behavior:"instant"}),top);
      expect(await page.evaluate(()=>scrollY)).toBe(top);
      const box=await header.boundingBox();
      expect(box.y).toBe(width<600 ? 12 : 16);
      expect(box.height).toBe(width<600 ? 92 : 64);
      await expect(page.locator(".header-download")).toBeInViewport();
      await expect(page.locator(".header-github")).toBeInViewport();
      expect(await header.evaluate(el=>el.contains(document.elementFromPoint(innerWidth/2,el.getBoundingClientRect().top+12)))).toBe(true);
    }
    await page.screenshot({path:`output/main-sticky-header-${width}.png`});
    await page.locator(".site-header .brand").click();
    await expect(page.locator("html")).toHaveAttribute("data-intro","ready");
    await expectTop();
    await page.getByRole("button",{name:"Scroll down to learn more"}).click();
    await expect(page.locator("html")).toHaveAttribute("data-intro","complete");
    await page.locator("#for-researchers").evaluate(el=>el.scrollIntoView());
    expect(await page.locator("#for-researchers").evaluate(el=>el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(width<600 ? 64 : 76);
    await expect(page.locator(".site-footer")).toHaveCount(0);
    await page.evaluate(() => scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'}));
    await expect(page.locator(".site-header .brand")).toBeInViewport();
    await page.screenshot({path:`output/main-ending-${width}.png`});
    await page.locator(".site-header .brand").click();
    await expect(page.locator("html")).toHaveAttribute("data-intro","ready");
    await expectTop();
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
    await page.goto('./#main');
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

test('landing page stays usable when JavaScript is unavailable', async ({browser}) => {
  const context = await browser.newContext({javaScriptEnabled: false});
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4322/catalex.github.io/');
  await expect(page.locator('.intro-scene')).not.toBeVisible();
  await expect(page.getByRole('heading', {level: 1})).toBeVisible();
  await page.locator('.header-download').click();
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
  test(`download page links to GitHub releases at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000});
    await page.emulateMedia({reducedMotion: 'reduce'});
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
    await page.goto('./#main');
    await page.locator('.header-download').click();
    await expect(page).toHaveURL(/\/catalex\.github\.io\/download\/$/);
    await expect(page.getByRole('heading', {name: 'Welcome to Catalex. Beta'})).toBeVisible();
    expect(await page.locator('.download-icon').evaluate(img => img.complete && img.naturalWidth === 512)).toBe(true);
    const url = page.url();
    const download = page.getByRole('link', {name: 'Get beta on GitHub Releases', exact: true});
    await expect(download).toHaveAttribute('href', 'https://github.com/Catalex-app/Catalex/releases');
    await page.locator('.site-header .brand').click();
    await page.getByRole('button',{name:'Scroll down to learn more'}).click();
    await page.locator('.header-download').click();
    await expect(page).toHaveURL(url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: `output/download-${width}.png`, fullPage: true});
    expect(failures).toEqual([]);
  });
}
