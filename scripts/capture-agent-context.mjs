// Capture the actual Half layout with a visible source selection and its input chip.
import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch();
try {
 const page = await browser.newPage({viewport:{width:1440,height:650},deviceScaleFactor:2,reducedMotion:'reduce'});
 // Seed only this disposable browser's real app preference.
 await page.addInitScript(() => localStorage.setItem('catalex-settings', JSON.stringify({state:{showEditorMinimap:false},version:24})));
 await page.goto(new URL('assets/workspace/index.html',process.env.CAPTURE_URL || 'http://127.0.0.1:4321/').href);
 await page.locator('.mupdf-page canvas').first().waitFor();
 await page.evaluate(()=>document.fonts.ready);
 await page.getByText('Artisan',{exact:true}).click();
 for(const id of ['H-8','A-9']) {
  const card=page.locator(`.cm-inlineCommentCard[data-inline-comment-id="${id}"]`);
  await card.getByRole('button',{name:'Delete comment',exact:true}).click();
  await card.getByRole('button',{name:'Confirm delete comment',exact:true}).click();
  await card.waitFor({state:'detached'});
 }
 await page.getByText('Duet',{exact:true}).click();
 await expect(page.locator('[data-editor-minimap="true"]')).toHaveCount(0);
 await page.evaluate(()=>window.postMessage({type:'catalex-scene',scene:'agent'},location.origin));
 await expect(page.locator('[data-chat-display="Expanded"]:visible')).toHaveAttribute('aria-pressed','true');
 await page.waitForTimeout(300);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>window.postMessage({type:'catalex-scene',scene:'context'},location.origin));
 await expect(page.locator('[data-chat-display="Expanded"]:visible')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-chat-drawer-panel="true"] [data-selection-chip="true"]')).toContainText('sample.tex');
 // Freeze the app's own initial blue sweep halfway across the badge label.
 const glow = page.locator('[data-chat-drawer-panel="true"] [data-selection-chip="true"] [data-context-glow]');
 await expect.poll(() => glow.evaluate(el => el.getAnimations().some(a => a.animationName === 'context-badge-attention'))).toBe(true);
 await glow.evaluate(el => {
  const animation=el.getAnimations().find(a=>a.animationName==='context-badge-attention');
  animation.pause();
  animation.currentTime=1220;
 });
 await page.waitForTimeout(300);
 await page.locator('.cm-content').focus();
 await expect(page.locator('.cm-editor')).toHaveClass(/cm-focused/);
 await page.evaluate(()=>{
  const line=[...document.querySelectorAll('.cm-line')].find(e=>e.textContent.includes('Reliable evaluation'));
  const scroller=line.closest('.cm-scroller');
  const drawer=document.querySelector('[data-chat-drawer-panel="true"]').getBoundingClientRect();
  scroller.scrollTop += line.getBoundingClientRect().top - (drawer.top-85);
 });
 await page.waitForTimeout(200);
 const drawer=await page.locator('[data-chat-drawer-panel="true"]').boundingBox();
 const editor=await page.locator('.cm-editor').boundingBox();
 const toolbar=await page.locator('[data-selection-toolbar="true"]').boundingBox();
 const chip=await page.locator('[data-chat-drawer-panel="true"] [data-selection-chip="true"]').boundingBox();
 // Include surrounding workspace, the whole selection toolbar, and the full composer.
 const left=Math.max(0,Math.min(editor.x-138,toolbar?.x ?? editor.x)-12);
 let top=Math.max(0,Math.min(drawer.y-110,toolbar?.y ?? drawer.y)-12);
 const bottom=drawer.y+drawer.height+12;
 // Match the shared landscape frame while preserving the selection and composer.
 const right=Math.min(1440,Math.max(left+(bottom-top)*2.2,drawer.x+drawer.width+20,chip.x+chip.width+20));
 top=Math.max(0,bottom-(right-left)/2.04);
 console.log({drawer,toolbar,chip,capture:{left,top,right,bottom}});
 await page.screenshot({path:fileURLToPath(new URL('../assets/agent-in-context.jpg',import.meta.url)),quality:90,clip:{x:left,y:top,width:right-left,height:bottom-top}});
 console.log('Captured Half mode with source selection and input context chip.');
} finally {await browser.close();}
