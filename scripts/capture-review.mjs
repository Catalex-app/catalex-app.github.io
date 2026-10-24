// High-density capture of the real agent draft review controls.
import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1428,height:820},deviceScaleFactor:3,reducedMotion:'reduce'});
 await page.addInitScript(()=>localStorage.setItem('catalex-settings',JSON.stringify({state:{showEditorMinimap:false},version:24})));
 await page.goto(new URL('assets/workspace/index.html?scene=review',process.env.CAPTURE_URL || 'http://127.0.0.1:4321/').href);
 const panel=page.locator('[data-proposed-changes-panel]');
 await expect(panel.getByRole('button',{name:'Accept All',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Accept',exact:true}).first()).toBeVisible();
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForTimeout(200);
 const box=await panel.boundingBox();
 await page.screenshot({path:fileURLToPath(new URL('../assets/agent-review.jpg',import.meta.url)),quality:90,clip:{x:box.x,y:box.y,width:box.width,height:box.width/2.04}});
 console.log('Captured review at 3× pixel density.');
} finally {await browser.close();}
