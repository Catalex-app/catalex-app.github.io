// Capture the app's project Git conflict UI, separate from agent draft review.
import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1400,height:850},deviceScaleFactor:2,reducedMotion:'reduce'});
 await page.addInitScript(()=>localStorage.setItem('catalex-settings',JSON.stringify({state:{showEditorMinimap:false},version:24})));
 await page.goto(new URL('assets/workspace/index.html?scene=git&scenario=partial-overlap',process.env.CAPTURE_URL || 'http://127.0.0.1:4321/').href);
 await expect(page.locator('[data-git-conflict-panel]')).toContainText('Resolve Git Conflict');
 await expect(page.locator('[data-proposed-changes-panel]')).toHaveCount(0);
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForTimeout(300);
 const panel=await page.locator('[data-git-conflict-panel]').boundingBox();
 await page.screenshot({path:fileURLToPath(new URL('../assets/git-merge.jpg',import.meta.url)),quality:90,clip:{x:panel.x-65,y:panel.y,width:650,height:365}});
 console.log('Captured real project Git merge UI at 2× pixel density.');
} finally {await browser.close();}
