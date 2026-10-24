// Run after npm run dev. Use --workspace-only to refresh just the full screenshots.
// Capture at 2× pixel density without changing the logical workspace layout.
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
const assets = fileURLToPath(new URL("../assets/", import.meta.url));
const base = process.env.CAPTURE_URL || "http://127.0.0.1:4321/";
const browser = await chromium.launch();
// Keep both inline comments above the floating chat drawer in full captures.
async function frameComments(page) {
	await page.evaluate(() => document.fonts.ready);
	await page.locator('.cm-inlineCommentCard[data-inline-comment-id="A-9"]').waitFor();
	await page.evaluate(() => {
		const comment = document.querySelector('.cm-inlineCommentCard[data-inline-comment-id="A-9"]');
		const drawer = document.querySelector('[data-chat-drawer-panel="true"]');
		const scroller = comment.closest('.cm-scroller');
		scroller.scrollTop += Math.max(0, comment.getBoundingClientRect().bottom - drawer.getBoundingClientRect().top + 48);
	});
	await page.waitForTimeout(200);
	const framed = await page.evaluate(() => {
		const human = document.querySelector('.cm-inlineCommentCard[data-inline-comment-id="H-8"]');
		const agent = document.querySelector('.cm-inlineCommentCard[data-inline-comment-id="A-9"]');
		const drawer = document.querySelector('[data-chat-drawer-panel="true"]');
		return human.getBoundingClientRect().top >= human.closest('.cm-scroller').getBoundingClientRect().top
			&& agent.getBoundingClientRect().bottom <= drawer.getBoundingClientRect().top - 40;
	});
	if (!framed) throw new Error('Both comments must be visible above the chat drawer.');
}
try {
	let page = await browser.newPage({
		viewport: { width: 1440, height: 914 },
		deviceScaleFactor: 2,
		reducedMotion: "reduce",
	});
	const demo = new URL("assets/workspace/index.html", base).href;
	await page.goto(demo);
	await page.locator(".mupdf-page canvas").first().waitFor();
	await page.waitForTimeout(600);
	await frameComments(page);
	await page.screenshot({ path: `${assets}workspace-modern.jpg`, quality: 85 });
	await page.evaluate(() =>
		window.postMessage(
			{ type: "catalex-theme", theme: "classic" },
			location.origin,
		),
	);
	await page.waitForTimeout(250);
	await frameComments(page);
	await page.screenshot({
		path: `${assets}workspace-classic.jpg`,
		quality: 85,
	});
	if (!process.argv.includes("--workspace-only")) {
	await page.close();
	page = await browser.newPage({ viewport: { width: 1280, height: 820 }, reducedMotion: "reduce" });
	await page.goto(demo);
	await page.locator(".mupdf-page canvas").first().waitFor();
	await page.waitForTimeout(300);
	await page.getByText("Artisan", { exact: true }).click();
  await page.waitForTimeout(400);
  for (const [id, name] of [
		["H-8", "tour-comments"],
		["A-9", "tour-agent-comment"],
	]) {
		await page
			.locator(`.cm-inlineCommentCard[data-inline-comment-id="${id}"]`)
			.first()
			.screenshot({ path: `${assets}${name}.jpg`, quality: 95 });
	}
	await page.getByText("Duet", { exact: true }).click();
	await page.waitForTimeout(400);
	await page
		.getByRole("button", { name: "Toggle drawer", exact: true })
		.click();
	await page.waitForTimeout(350);
	await page
		.locator('[data-chat-drawer-panel="true"]')
		.screenshot({ path: `${assets}tour-agent.jpg`, quality: 95 });
	await page.evaluate(() =>
		window.postMessage(
			{ type: "catalex-scene", scene: "context" },
			location.origin,
		),
	);
	await page.waitForTimeout(350);
	await page.screenshot({
		path: `${assets}tour-context.jpg`,
		quality: 95,
		clip: { x: 280, y: 540, width: 468, height: 255 },
	});
	await page.goto(`${demo}?scene=review`);
	await page.getByRole("button", { name: "Accept All", exact: true }).waitFor();
	await page.waitForTimeout(300);
	await page.screenshot({
		path: `${assets}tour-review.jpg`,
		quality: 95,
		clip: { x: 264, y: 80, width: 500, height: 290 },
	});
	}
	console.log("Captured 2880×1828 workspace JPEGs at quality 85." + (process.argv.includes("--workspace-only") ? "" : " Refreshed feature details."));
} finally {
	await browser.close();
}
