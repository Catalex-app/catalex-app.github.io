import { expect, test } from "@playwright/test";

const pages = [
	["", "Overview"],
	["getting-started/", "Getting started"],
	["workspace/", "Your workspace"],
	["writing/", "Writing"],
	["comments/", "Comments"],
	["references/", "References"],
	["agents/", "Working with agents"],
	["sync-and-recovery/", "Sync and recovery"],
	["development/", "Overview"],
	["development/setup/", "Development setup"],
	["development/architecture/", "Repository map"],
	["testing/", "Testing conventions"],
	["development/releases/", "Releases"],
];

for (const width of [390, 1280]) {
	test(`documentation navigation and links work at ${width}px`, async ({
		page,
		request,
	}) => {
		await page.setViewportSize({ width, height: 960 });
		await page.emulateMedia({ reducedMotion: "reduce" });
		const errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		for (const [slug, title] of pages) {
			await page.goto(`./docs/${slug}`);
			await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
			await expect(
				page
					.getByRole("navigation", { name: "User guide", exact: true })
					.getByRole("link"),
			).toHaveCount(8);
			await expect(
				page
					.getByRole("navigation", { name: "Development", exact: true })
					.getByRole("link"),
			).toHaveCount(5);
			await expect(
				page.locator('.docs-sidebar [aria-current="page"]'),
			).toHaveText(title);
			await expect(page.locator(".site-header .header-docs")).toHaveCount(1);
			const headerNav = page.locator(".header-nav");
			await expect(headerNav.locator("a")).toHaveText([
				"Documentation",
				"Changelog",
			]);
			await expect(headerNav.locator('[aria-current="page"]')).toHaveText(
				"Documentation",
			);
			expect(
				await headerNav.evaluate((el) => {
					const nav = el.getBoundingClientRect(),
						header = el.parentElement.getBoundingClientRect();
					const brand = el.parentElement.querySelector('.brand').getBoundingClientRect();
					const actions = el.parentElement.querySelector('.header-actions').getBoundingClientRect();
					if (innerWidth <= 760) {
                        const menu = document.querySelector('.mobile-navigation summary').getBoundingClientRect();
                        return getComputedStyle(el).display === 'none' && menu.left >= brand.right && menu.right < actions.left;
                    }
                    return nav.left >= header.left && nav.right <= header.right && nav.left > brand.right && nav.right < actions.left;
				}),
			).toBe(true);
			await expect(page.locator(".docs-source")).toHaveAttribute(
				"href",
				/^https:\/\/github.com\/Catalex-app\/Catalex\/blob\/main\/docs\//,
			);
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
			).toBe(true);
			for (const href of await page
				.locator(".docs-layout a")
				.evaluateAll((links) => links.map((link) => link.href))) {
				const target = new URL(href);
				if (target.origin !== new URL(page.url()).origin) continue;
				const response = await request.get(href);
				expect(response.status(), href).toBe(200);
				if (target.hash) {
					const html = await response.text();
					const exists = await page.evaluate(
						({ html, id }) =>
							Boolean(
								new DOMParser()
									.parseFromString(html, "text/html")
									.getElementById(id),
							),
						{ html, id: decodeURIComponent(target.hash.slice(1)) },
					);
					expect(exists, href).toBe(true);
				}
			}
			if (
				slug === "development/" ||
				slug === "agents/" ||
				slug === "comments/"
			) {
				await page.screenshot({
					path: `output/${slug === "development/" ? "developer-docs" : slug.slice(0, -1)}-${width}.png`,
					fullPage: true,
				});
			}
		}
		await page.goto("./docs/");
		await page
			.getByRole("link", { name: "Next Getting started", exact: true })
			.click();
		await expect(page).toHaveURL(/\/docs\/getting-started\/$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			"Getting started",
		);
		expect(errors).toEqual([]);
		await page.screenshot({ path: `output/docs-${width}.png`, fullPage: true });
	});
}

test("Docs is reachable from the homepage and download page", async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	for (const route of ["./#main", "./download/"]) {
		await page.goto(route);
		await page.locator(".site-header .header-docs").click();
		await expect(page).toHaveURL(/\/docs\/$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			"Overview",
		);
	}
});

test("guide entry redirects and cross-page links preserve the Pages subpath", async ({
	page,
	request,
}) => {
	const root = "http://127.0.0.1:4322";
	// The primary preview uses a Pages base path; its missing-slash entry redirects correctly.
	const response = await request.get(`${root}/catalex.github.io/docs`, {
		maxRedirects: 0,
	});
	expect(response.status()).toBe(301);
	expect(response.headers().location).toBe("/catalex.github.io/docs/");
	const nested = await request.get(
		`${root}/catalex.github.io/docs/development/setup`,
		{ maxRedirects: 0 },
	);
	expect(nested.status()).toBe(301);
	expect(nested.headers().location).toBe(
		"/catalex.github.io/docs/development/setup/",
	);
	await page.goto(`${root}/catalex.github.io/docs/`);
	await page
		.getByRole("link", { name: "Working with agents", exact: true })
		.first()
		.click();
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"Working with agents",
	);
});

test("guides work at the domain root in development", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("http://127.0.0.1:4323/docs/");
	await page
		.getByRole("navigation", { name: "User guide", exact: true })
		.getByRole("link", { name: "Writing", exact: true })
		.click();
	await expect(page).toHaveURL("http://127.0.0.1:4323/docs/writing/");
	await expect(page.getByRole("heading", { level: 1 })).toHaveText("Writing");
	await page
		.getByRole("navigation", { name: "Development", exact: true })
		.getByRole("link", { name: "Development setup", exact: true })
		.click();
	await expect(page).toHaveURL("http://127.0.0.1:4323/docs/development/setup/");
	await page
		.getByRole("link", { name: "Getting started", exact: true })
		.last()
		.click();
	await expect(page).toHaveURL("http://127.0.0.1:4323/docs/getting-started/");
});
