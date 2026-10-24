// Open the app's normal Git actions menu in the disposable project fixture.
import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1400,height:850},deviceScaleFactor:2,reducedMotion:'reduce'});
 await page.addInitScript(()=>localStorage.setItem('catalex-settings',JSON.stringify({state:{showEditorMinimap:false},version:24})));
 await page.goto(new URL('assets/workspace/index.html?scene=git',process.env.CAPTURE_URL || 'http://127.0.0.1:4321/').href);
 await page.locator('[data-git-conflict-panel]').waitFor();
 for(let i=0;i<3;i++){
  await page.locator('[data-git-conflict-panel]').getByRole('button',{name:'Accept All',exact:true}).click();
  await page.waitForTimeout(100);
 }
 await page.getByRole('button',{name:'Finish merge',exact:true}).click();
 await page.getByRole('button',{name:'Create merge commit',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.evaluate(()=>window.postMessage({type:'catalex-theme',theme:'modern'},location.origin));
 await expect(page.locator('html')).toHaveAttribute('data-ui-theme','modern');
 await page.waitForTimeout(200);
 await page.getByRole('button',{name:'More git actions',exact:true}).click();
 const menu=page.getByRole('menu');
 await expect(menu).toBeVisible();
 await page.evaluate(()=>document.fonts.ready);
 await page.mouse.move(0,800);
 await page.waitForTimeout(150);
 console.log(await menu.innerText());
 const box=await menu.boundingBox();
 const width=Math.round((box.y+box.height+24)*2.2);
 const height=Math.ceil(width/2.04);
 const x=Math.max(0,Math.min(1400-width,box.x+box.width/2-width*.68));
 await page.screenshot({path:fileURLToPath(new URL('../assets/git-actions.jpg',import.meta.url)),quality:90,clip:{x,y:0,width,height}});
 console.log({width:width*2,height:height*2});
} finally {await browser.close();}
