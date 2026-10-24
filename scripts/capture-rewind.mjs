// Actual Rewind components with the app's browser-only history fixture.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const app = path.resolve(process.argv[2] || '../Catalex');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 620 }, deviceScaleFactor: 3, reducedMotion: 'reduce' });
  await page.route('**/examples/*/main.pdf', route => route.fulfill({ path: path.join(app, 'apps/desktop/public/examples/letter-formal/main.pdf'), contentType: 'application/pdf' }));
  await page.goto(new URL('assets/workspace/index.html?scene=history&openRewind&mixedOperations', process.env.CAPTURE_URL || 'http://127.0.0.1:4321/').href);
  await page.locator('.history-front-card').waitFor();
  await page.getByTestId('history-snapshot-before-agent-apply').click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.screenshot({ path: fileURLToPath(new URL('../assets/rewind.jpg', import.meta.url)), quality: 90 });
  console.log('Captured the Rewind interface at 3600×1860.');
} finally { await browser.close(); }
