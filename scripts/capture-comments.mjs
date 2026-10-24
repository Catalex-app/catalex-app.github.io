// Capture the real inline comment UI and its compiled PDF highlights at 3×.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 914 }, deviceScaleFactor: 3, reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('catalex-settings', JSON.stringify({ state: { showEditorMinimap: false }, version: 24 })));
  await page.goto(new URL('assets/workspace/index.html', process.env.CAPTURE_URL || 'http://127.0.0.1:4321/').href);
  await page.locator('.mupdf-page canvas').first().waitFor();
  await page.getByText('Artisan', { exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.cm-inlineCommentCard[data-inline-comment-id="A-9"]').waitFor();
  await page.waitForTimeout(300);
  await page.locator('.cm-scroller').first().evaluate(el => { el.scrollTop = 50; });
  await page.waitForTimeout(200);
  const clip = { x: 300, y: 280, width: 1120, height: 549 };
  for (const id of ['H-8', 'A-9']) {
    const bounds = await page.locator(`.cm-inlineCommentCard[data-inline-comment-id="${id}"]`).boundingBox();
    if (!bounds || bounds.y < clip.y || bounds.y + bounds.height > clip.y + clip.height) throw new Error(`${id} is outside the capture`);
  }
  await page.screenshot({ path: fileURLToPath(new URL('../assets/comments-and-pdf.jpg', import.meta.url)), clip, quality: 90 });
  console.log('Captured comments and PDF at 3360×1647.');
} finally { await browser.close(); }
