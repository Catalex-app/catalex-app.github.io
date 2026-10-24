// Capture the first highlight with the real app's plain editing mode.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 914 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await page.goto(new URL('assets/workspace/index.html', process.env.CAPTURE_URL || 'http://127.0.0.1:4321/').href);
  await page.locator('.mupdf-page canvas').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.getByText('Artisan', { exact: true }).click();
  // These actions affect only the disposable browser fixture.
  for (const id of ['H-8', 'A-9']) {
    await page.locator(`.cm-inlineCommentCard[data-inline-comment-id="${id}"]`).getByRole('button', { name: 'Delete comment', exact: true }).click();
    await page.locator(`.cm-inlineCommentCard[data-inline-comment-id="${id}"]`).getByRole('button', { name: 'Confirm delete comment', exact: true }).click();
    await page.locator(`.cm-inlineCommentCard[data-inline-comment-id="${id}"]`).waitFor({ state: 'detached' });
  }
  await page.locator('.cm-scroller').evaluate(el => { el.scrollTop = 0; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: fileURLToPath(new URL('../assets/workspace-editor.jpg', import.meta.url)), quality: 85 });
  console.log('Captured plain editor at 2880×1828.');
} finally {
  await browser.close();
}
