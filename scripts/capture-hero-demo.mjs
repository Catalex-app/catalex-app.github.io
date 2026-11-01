// Record the real app renderer, with a deterministic local agent fixture.
// Rebuild assets/workspace first; no account, network agent, or source files are used.
import {chromium,expect} from '@playwright/test';
import {cp,mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const editorDemo=process.argv.includes('--editor');
const media=editorDemo ? 'editor-demo' : 'hero-demo';
const density=editorDemo ? 2 : 1.5;
const captureWidth=1440*density,captureHeight=914*density;
const camera=[];
const endingHold=editorDemo ? 1 : 0;
const output=`${root}output/${editorDemo ? 'editor-recording-hd' : 'hero-recording-hd'}/`;
await mkdir(output,{recursive:true});
const encodeOnly=process.argv.includes('--encode-only');
const browser=encodeOnly ? null : await chromium.launch();
let context,page,cdp,timeline=[],frames=[],started,duration;
const frameWrites=[];
let captureError;
async function saveStill(name) {
 // Playwright screenshots restore the context's unscaled viewport. Reuse the
 // latest recording frame so taking evidence never changes the recorded layout.
 expect(await page.evaluate(()=>({width:innerWidth,height:innerHeight}))).toEqual({width:1440,height:914});
 const frame=frames.at(-1),write=frameWrites.at(-1);
 await write;
 await cp(`${output}${frame.name}`,`${output}${name}.jpg`);
}
const mark=(label,detail={})=>timeline.push({label,seconds:Number(((Date.now()-started)/1000).toFixed(2)),...detail});
if(!encodeOnly) {
try {
 context=await browser.newContext({viewport:{width:captureWidth,height:captureHeight},deviceScaleFactor:1});
 // Scale the compositor's viewport, keeping the app's original CSS layout.
 // DPR alone leaves screencast frames at 1440px, regardless of maxWidth.
 // Expose the same density to the app so PDF canvases rasterize sharply too.
 await context.addInitScript(density=>Object.defineProperty(window,'devicePixelRatio',{value:density,configurable:true}),density);
 page=await context.newPage();
 cdp=await context.newCDPSession(page);
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:914,deviceScaleFactor:1,mobile:false,viewport:{x:0,y:0,width:1440,height:914,scale:density}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(new URL(`assets/workspace/index.html?scene=${editorDemo ? 'editor' : 'hero'}`,process.env.CAPTURE_URL || 'http://127.0.0.1:4321/').href);
 await page.locator(editorDemo ? '.cm-editor' : '.mupdf-page canvas').first().waitFor();
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForTimeout(1200);
 await expect(page.locator('.cm-inlineCommentCard')).toHaveCount(0);
 await expect(page.locator('[data-proposed-changes-panel]')).toHaveCount(0);
 await page.evaluate(()=>{
   const dot=document.createElement('div');
   dot.id='recording-dot';
   dot.setAttribute('aria-hidden','true');
   Object.assign(dot.style,{position:'fixed',top:'0',left:'0',width:'22px',height:'22px',borderRadius:'50%',background:'rgba(24,24,27,.38)',border:'2px solid rgba(255,255,255,.95)',boxShadow:'0 0 0 1px #18181b24',opacity:'0',transform:'translate(-50%,-50%)',pointerEvents:'none',zIndex:'2147483647'});
   document.body.append(dot);
 });
 // Cue the target first, then press, release, and let the result settle.
 async function cueDot(x,y) {
   await page.evaluate(({x,y})=>{
     const dot=document.querySelector('#recording-dot');
     dot.getAnimations().forEach(animation=>animation.cancel());
     Object.assign(dot.style,{left:`${x}px`,top:`${y}px`,opacity:'1'});
     dot.animate([{opacity:0,transform:'translate(-50%,-50%) scale(1.3)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.05)'}],{duration:180,fill:'forwards',easing:'ease-out'});
   },{x,y});
   await page.waitForTimeout(220);
 }
 async function dotDown(x,y) {
   await page.evaluate(({x,y})=>{
     const dot=document.querySelector('#recording-dot');
     dot.getAnimations().forEach(animation=>animation.cancel());
     Object.assign(dot.style,{left:`${x}px`,top:`${y}px`,opacity:'1'});
     dot.animate([{transform:'translate(-50%,-50%) scale(1.2)'},{transform:'translate(-50%,-50%) scale(.85)'}],{duration:130,fill:'forwards',easing:'ease-out'});
   },{x,y});
 }
 async function dotUp() {
   await page.evaluate(()=>{
     const dot=document.querySelector('#recording-dot');
     dot.getAnimations().forEach(animation=>animation.cancel());
     dot.style.opacity='0';
     dot.animate([{opacity:1,transform:'translate(-50%,-50%) scale(.85)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.65)'}],{duration:300,fill:'forwards',easing:'ease-out'});
   });
 }
 async function center(locator) {
   const box=await locator.boundingBox();
   return {x:box.x+box.width/2,y:box.y+box.height/2};
 }
 async function clickDot(locator,options={}) {
   await expect(locator).toBeEnabled();
   await clickPoint(await center(locator),options);
 }
 async function clickPoint(point,{label,settle=480}={}) {
   await page.mouse.move(point.x,point.y);
   if(label)mark(`${label}-cue`);
   await cueDot(point.x,point.y);
   await dotDown(point.x,point.y);
   await page.mouse.down();
   await page.waitForTimeout(140);
   await page.mouse.up();
   if(label)mark(`${label}-clicked`);
   await dotUp();
   await page.mouse.move(1438,900);
   await page.waitForTimeout(settle);
 }
 async function dragDot(from,to,duration=1000) {
   await page.mouse.move(from.x,from.y);
   await cueDot(from.x,from.y);
   await dotDown(from.x,from.y);
   await page.mouse.down();
   await page.waitForTimeout(140);
   const steps=Math.ceil(duration/25);
   for(let n=1;n<=steps;n++) {
     const t=n/steps,ease=t*t*(3-2*t);
     const point={x:from.x+(to.x-from.x)*ease,y:from.y+(to.y-from.y)*ease};
     await page.mouse.move(point.x,point.y);
     await page.evaluate(({x,y})=>Object.assign(document.querySelector('#recording-dot').style,{left:`${x}px`,top:`${y}px`}),point);
     await page.waitForTimeout(duration/steps);
   }
   await page.mouse.up();
   await dotUp();
   await page.mouse.move(1438,900);
   await page.waitForTimeout(350);
 }
 // Stream high-density frames without the pauses of repeated screenshots.
 // Write immediately rather than keeping the entire recording in memory.
 cdp.on('Page.screencastFrame',({data,metadata,sessionId})=>{
   const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`;
   frames.push({name,at:metadata.timestamp});
   frameWrites.push(writeFile(`${output}${name}`,Buffer.from(data,'base64')).catch(error=>{captureError=error;}));
   void cdp.send('Page.screencastFrameAck',{sessionId}).catch(()=>{});
 });
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:97,maxWidth:captureWidth,maxHeight:Math.ceil(captureHeight),everyNthFrame:1});
 await expect.poll(()=>frames.length).toBeGreaterThan(0);
 started=Date.now();
 await saveStill('still');
 mark('still');
 if(editorDemo) {
   const sources=JSON.parse(await readFile(`${root}workspace-demo/editor-source.json`,'utf8'));
   const mode=page.getByRole('tablist',{name:'Workspace assistant mode'});
   const navigation=await page.evaluate(()=>performance.timeOrigin);
   // Leave room between UI actions for the continuous camera to follow.
   const cameraBeat=(ms=900)=>page.waitForTimeout(ms);
   await expect(mode).toHaveAttribute('data-active-mode','artisan');
   await page.waitForTimeout(700);
   await cameraBeat(700);
   await clickDot(page.locator('[data-workspace-assistant-mode]').getByText('sample.tex',{exact:true}),{label:'open-latex'});
   await expect.poll(()=>page.evaluate(()=>window.catalexEditorDemo.state().activeFile)).toBe('sample.tex');
   await page.locator('.mupdf-page canvas').first().waitFor();
   await saveStill('latex-open');
   await cameraBeat();
   const insertion=await page.evaluate(()=>window.catalexEditorDemo.insertionPoint());
   await clickPoint({x:insertion.rect.left+1,y:insertion.rect.top+8},{label:'source',settle:700});
   // Literal input preserves the displayed LaTeX, without accepting completions.
   for(const character of sources.insertion){await page.keyboard.insertText(character);await page.waitForTimeout(30);}
   await page.keyboard.press('Escape');
   await page.waitForTimeout(450);
   const expected=sources.initial.replace('\n\\end{document}',sources.insertion+'\n\\end{document}');
   const typed=await page.evaluate(()=>window.catalexEditorDemo.state());
   const extra=typed.source.length-expected.length;
   // Native LaTeX pairing may leave spacer lines after the closing bracket.
   if(extra>0 && extra<=2 && typed.source.replace(/\n{3,}/g,'\n\n')===expected.replace(/\n{3,}/g,'\n\n')) {
     expect(typed.source.slice(typed.cursor,typed.cursor+extra)).toBe('\n'.repeat(extra));
     for(let n=0;n<extra;n++)await page.keyboard.press('Delete');
   }
   expect((await page.evaluate(()=>window.catalexEditorDemo.state())).source).toBe(expected);
   mark('latex-typed');
   await saveStill('typed');
   await cameraBeat(1000);
   const revision=await page.evaluate(()=>document.querySelectorAll('.mupdf-page canvas').length);
   await clickDot(page.getByRole('button',{name:'Recompile',exact:true}),{label:'compile'});
   await expect.poll(()=>page.evaluate(()=>window.catalexEditorDemo.state().compileCount)).toBe(1);
   await expect(page.getByRole('button',{name:'Recompile',exact:true})).toBeEnabled();
   await page.waitForTimeout(400);
   await cameraBeat(800);
   await page.waitForTimeout(1300);
   mark('compiled-result',{pages:revision});
   await saveStill('compiled');
   await cameraBeat(1000);
   await cameraBeat(800);
   await clickDot(mode.getByRole('tab',{name:'Duet',exact:true}),{label:'duet'});
   await expect(mode).toHaveAttribute('data-active-mode','duet');
   const composer=page.locator('[data-chat-drawer-panel="true"]');
   const input=composer.getByPlaceholder('Ask me anything');
   await expect(input).toBeVisible();
   await cameraBeat(1000);
   await clickDot(input,{label:'agent-input',settle:700});
   await input.pressSequentially('Help me sharpen this introduction.',{delay:40});
   await page.waitForTimeout(400);
   await clickDot(composer.getByRole('button',{name:'Send',exact:true}),{label:'agent-send'});
   await expect.poll(()=>page.evaluate(()=>window.catalexEditorDemo.state().streaming)).toBe(true);
   await cameraBeat(900);
   const handle=await center(composer.getByRole('button',{name:'Toggle drawer',exact:true}));
   await page.mouse.move(handle.x,handle.y);
   await page.waitForTimeout(200);
   const half=page.getByRole('button',{name:'Half',exact:true});
   const point=await center(half);
   await dragDot(point,{x:point.x,y:point.y-250},900);
   await expect(half).toHaveAttribute('aria-pressed','true');
   await expect.poll(()=>page.evaluate(()=>window.catalexEditorDemo.state().streaming),{timeout:10000}).toBe(false);
   await expect(composer.locator('[data-chat-messages]')).toContainText('room to develop');
   await cameraBeat(700);
   await page.waitForTimeout(1000);
   await saveStill('agent-workspace');
   expect(await page.evaluate(()=>performance.timeOrigin)).toBe(navigation);
   mark('finished');
 } else {
 await page.waitForTimeout(950);
 const points=await page.evaluate(()=>window.catalexHeroDemo.selectionPoints());
 await dragDot({x:points.start.left+1,y:points.start.top+8},{x:points.end.left,y:points.end.top+8},850);
 expect((await page.evaluate(()=>window.catalexHeroDemo.state())).selected).toContain('Your abstract here.');
 expect((await page.evaluate(()=>window.catalexHeroDemo.state())).selected).toContain('scientific findings.');
 mark('abstract-selected');
 await saveStill('selected');
 await page.waitForTimeout(650);
 const composer=page.locator('[data-chat-drawer-panel="true"]');
 const input=composer.getByPlaceholder('Ask me anything');
 await clickDot(input,{label:"prompt",settle:760});
 mark("typing-started");
 expect(timeline.at(-1).seconds-timeline.find(beat=>beat.label==="prompt-clicked").seconds).toBeGreaterThanOrEqual(.7);
 await input.pressSequentially('Help me polish this abstract.',{delay:65});
 await page.waitForTimeout(650);
 const send=composer.getByRole('button',{name:'Send',exact:true});
 await clickDot(send,{label:"send"});
 await expect(page.locator('html')).toHaveAttribute('data-demo-phase','working');
 mark('agent-started-mini');
 const navigation=await page.evaluate(()=>performance.timeOrigin);
 await page.waitForTimeout(900);
 const handle=composer.getByRole('button',{name:'Toggle drawer',exact:true});
 const handlePoint=await center(handle);
 await page.mouse.move(handlePoint.x,handlePoint.y);
 await page.waitForTimeout(300);
 const half=page.getByRole('button',{name:'Half',exact:true});
 const halfPoint=await center(half);
 await dragDot(halfPoint,{x:halfPoint.x,y:halfPoint.y-250},1050);
 await expect(half).toHaveAttribute('aria-pressed','true');
 await expect(composer.locator('[data-chat-messages]')).toBeVisible();
 let sample=await page.evaluate(()=>window.catalexHeroDemo.state());
 expect(sample.streaming).toBe(true);
 const halfChars=sample.outputChars;
 mark('half-streaming',{outputChars:sample.outputChars});
 await page.waitForTimeout(1800);
 await saveStill('half-streaming');
 await clickDot(page.getByRole('button',{name:'Full',exact:true}),{label:'full'});
 await expect(page.locator('[data-workspace-mode-area]')).toHaveAttribute('data-chat-layout','workspace');
 await page.waitForTimeout(600);
 sample=await page.evaluate(()=>window.catalexHeroDemo.state());
 expect(sample.streaming).toBe(true);
 expect(sample.outputChars).toBeGreaterThan(halfChars);
 const fullChars=sample.outputChars;
 mark('full-streaming',{outputChars:sample.outputChars});
 await page.waitForTimeout(2800);
 await saveStill('full-streaming');
 await clickDot(page.getByRole('button',{name:'Mini',exact:true}),{label:'mini'});
 await expect(page.locator('[data-workspace-mode-area]')).toHaveAttribute('data-chat-layout','drawer');
 await page.waitForTimeout(650);
 sample=await page.evaluate(()=>window.catalexHeroDemo.state());
 expect(sample.streaming).toBe(true);
 expect(sample.outputChars).toBeGreaterThan(fullChars);
 mark('mini-still-streaming',{outputChars:sample.outputChars});
 await saveStill('mini-streaming');
 // Let the continuous fixture finish itself, without cutting or manually swapping scenes.
 await expect(page.locator('html')).toHaveAttribute('data-demo-phase','review',{timeout:15000});
 expect(await page.evaluate(()=>performance.timeOrigin)).toBe(navigation);
 const reject=page.getByRole('button',{name:'Reject All',exact:true});
 await expect(reject).toBeVisible();
 await expect(page.getByRole('button',{name:'Accept',exact:true}).first()).toBeVisible();
 mark('proposal');
 await saveStill('proposal');
 await page.waitForTimeout(1900);
 await clickDot(reject,{label:"reject",settle:650});
 await expect(page.locator('[data-proposed-changes-panel]')).toHaveCount(0);
 expect(await page.evaluate(()=>window.catalexHeroDemo.state())).toMatchObject({restored:true,changes:0});
 await expect(page.locator('.cm-inlineCommentCard')).toHaveCount(0);
 mark('rejected');
 await saveStill('rejected');
 await page.waitForTimeout(850);
 await page.evaluate(()=>document.querySelectorAll('.cm-scroller').forEach(el=>el.scrollTo({top:0,behavior:'smooth'})));
 await page.waitForTimeout(700);
 await page.evaluate(()=>{
   window.catalexHeroDemo.reset();
   document.activeElement?.blur();
 });
 await page.waitForTimeout(1000);
 await saveStill('reset');
 }
 duration=(Date.now()-started)/1000;
 mark(editorDemo ? 'recording-ended' : 'loop-reset');
 expect(errors).toEqual([]);
 await cdp.send('Page.stopScreencast');
 await Promise.all(frameWrites);
 if(captureError)throw captureError;
 await context.close();
} catch(error) {
 if(page && !page.isClosed())await page.screenshot({path:`${output}failed.png`}).catch(()=>{});
 throw error;
} finally {
 await browser.close();
 await Promise.all(frameWrites);
}
// Keep the timestamps between changed frames, including the still holds.
const probe=spawnSync('ffprobe',['-v','error','-show_entries','stream=width,height','-of','json',`${output}${frames[0].name}`],{encoding:'utf8'});
if(probe.status!==0)throw new Error('Cannot verify capture resolution.');
expect(JSON.parse(probe.stdout).streams[0]).toMatchObject({width:captureWidth,height:Math.round(captureHeight)});
const manifest=[];
for(let index=0;index<frames.length;index++) {
 const name=frames[index].name;
 const seconds=index+1<frames.length ? frames[index+1].at-frames[index].at : Math.max(.1,duration-(frames[index].at-frames[0].at));
 manifest.push(`file '${name}'`, `duration ${Math.max(.001,seconds).toFixed(6)}`);
}
manifest.push(`file 'frame-${String(frames.length-1).padStart(5,'0')}.jpg'`);
await writeFile(`${output}frames.txt`,manifest.join('\n'));
} else {
 const metadata=JSON.parse(await readFile(`${output}timeline.json`,'utf8'));
 duration=metadata.duration;timeline=metadata.timeline;frames=Array(metadata.frames);
 camera.push(...JSON.parse(await readFile(`${output}camera.json`,'utf8')));
}
// Follow the action, with one deliberate pullback through the mode switch.
// Scale stays steady from source to PDF and through the agent's drawer change.
if(editorDemo) {
  const beat=label=>timeline.find(item=>item.label===label).seconds;
  const target=(seconds,zoom,x,y)=>({seconds,zoom,x,y});
  const keys=[
    target(0,1,720,457),
    target(beat('open-latex-clicked'),1,720,457),
    target(beat('source-cue')-.15,2.25,550,245),
    target(beat('latex-typed'),2.25,550,245),
    target(beat('compile-cue')-.12,2.25,1110,195),
    target(beat('compiled-result')-2.1,2.25,1110,195),
    target(beat('compiled-result')-1.3,2.25,1115,265),
    target(beat('compiled-result'),2.25,1115,265),
    target(beat('duet-cue')-.15,1.65,410,265),
    target(beat('duet-clicked')+.45,1.65,410,265),
    target(beat('agent-input-cue')-.15,1.85,558,685),
    target(beat('agent-send-clicked')+.5,1.85,558,685),
    target(beat('agent-send-clicked')+1.4,1.85,558,640),
    target(duration-1.7,1.85,558,640),
    target(duration-.5,.78,720,457),
    target(duration+endingHold,.78,720,457),
  ];
  camera.splice(0,camera.length,...keys);
}

// Intro's critically damped spring (frequency 15), solved for moving targets.
// Position AND velocity carry through every key; a new shot never resets motion.
function springSegments(property) {
  const keys=camera.filter((key,index)=>index===0 || key.seconds>camera[index-1].seconds);
  const frequency=15,segments=[];
  let position=keys[0][property],velocity=0;
  for(let index=0;index<keys.length-1;index++) {
    const a=keys[index],b=keys[index+1],span=b.seconds-a.seconds;
    const slope=(b[property]-a[property])/span;
    const offset=position-a[property]+2*slope/frequency;
    const impulse=velocity-slope+frequency*offset;
    segments.push({start:a.seconds,end:b.seconds,target:a[property],slope,offset,impulse,frequency});
    const decay=Math.exp(-frequency*span);
    position=b[property]-2*slope/frequency+(offset+impulse*span)*decay;
    velocity=slope+(impulse-frequency*(offset+impulse*span))*decay;
  }
  return {segments,position,velocity};
}
function cameraExpression(property) {
  const {segments,position}=springSegments(property);
  let expression=String(position);
  for(const segment of segments.toReversed()) {
    const {start,end,target,slope,offset,impulse,frequency}=segment;
    const time=`(on/24-${start.toFixed(5)})`;
    const value=`${target}+(${slope})*${time}-${2*slope/frequency}+(${offset}+(${impulse})*${time})*exp(-${frequency}*${time})`;
    expression=`if(lt(on/24,${end.toFixed(5)}),${value},${expression})`;
  }
  return expression;
}
if(editorDemo) {
  expect(springSegments('zoom').position).toBeCloseTo(.78,4);
  expect(springSegments('x').position).toBeCloseTo(720,2);
  expect(springSegments('y').position).toBeCloseTo(457,2);
}
// A small white overscan lets close-ups include edge controls without cropping
// them at the card boundary. Keep its aspect ratio and compensate the zoom.
const padX=480,padY=305,padWidth=captureWidth+padX*2,padHeight=captureHeight+padY*2;
const filter=editorDemo
 ? `fps=24,tpad=stop_mode=clone:stop_duration=${endingHold},format=yuv444p,pad=${padWidth}:${padHeight}:${padX}:${padY}:white,zoompan=z='(${cameraExpression('zoom')})*${padWidth/captureWidth}':x='max(0,min(iw-iw/zoom,(${cameraExpression('x')})*${density}+${padX}-iw/zoom/2))':y='max(0,min(ih-ih/zoom,(${cameraExpression('y')})*${density}+${padY}-ih/zoom/2))':d=1:s=2160x1372:fps=24,scale=2160:1372:out_range=tv`
 : 'fps=24,scale=2160:1372:flags=lanczos:out_range=tv';
await writeFile(`${output}camera.json`,JSON.stringify(camera,null,2));
// Keep high-density text; save bytes through 24 fps and slower H.264 encoding.
// Use even output dimensions for Safari-compatible 4:2:0.
const result=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',`${output}frames.txt`,'-t',String(duration+endingHold),'-an','-vf',filter,'-c:v','libx264','-preset','veryslow','-crf','20','-refs','4','-level:v','5.0','-pix_fmt','yuv420p','-color_range','tv','-movflags','+faststart',`${output}hero-demo.mp4`],{stdio:'inherit'});
if(result.status!==0)throw new Error('Demo video encoding failed.');
const poster=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',`${output}still.jpg`,'-frames:v','1','-q:v','4',`${output}hero-demo-poster.jpg`],{stdio:'inherit'});
if(poster.status!==0)throw new Error('Demo poster encoding failed.');
// Publish complete files only; an encoding failure must leave the old demo usable.
await rename(`${output}hero-demo.mp4`,`${root}assets/${media}.mp4`);
await rename(`${output}hero-demo-poster.jpg`,`${root}assets/${media}-poster.jpg`);
await writeFile(`${output}timeline.json`,JSON.stringify({duration,videoDuration:duration+endingHold,frames:frames.length,timeline,camera,cameraMotion:editorDemo ? "intro-spring" : "fixed"},null,2));
console.log(JSON.stringify({video:`assets/${media}.mp4`,poster:`assets/${media}-poster.jpg`,duration,frames:frames.length,timeline},null,2));
