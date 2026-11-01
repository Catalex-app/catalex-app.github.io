import {test, expect} from "@playwright/test";

for(const [width,height] of [[1440,1000],[390,844],[844,390],[320,568]]) {
  test(`Welcome switches between highlighted Code, Split, and Preview at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:"no-preference"});
    await page.goto("./?intro=typewriter&playIntro=0");
    const scene=page.locator(".intro-scene");
    await expect(page.locator("html")).toHaveAttribute("data-intro","ready");
    await expect(scene.getByRole("button",{name:"Preview only"})).toHaveAttribute("aria-pressed","true");
    await expect(scene.locator(".welcome-code")).toBeHidden();
    await expect(scene.locator(".catalyst-brand > span")).toHaveCSS("color","rgb(53, 53, 59)");
    await expect(scene.locator(".reaction-arrow")).toHaveCSS("stroke","rgb(53, 53, 59)");
    await expect(scene.locator(".catalyst-brand > span")).toHaveCSS("font-style","normal");
    const anchors=await scene.locator(".welcome-views, .terminal-actions").evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().top));
    for(const [mode,name] of [["code","Code only"],["preview","Preview only"],["split","Split view"],["code","Code only"],["split","Split view"],["preview","Preview only"]]) {
      await scene.getByRole("button",{name,exact:true}).click();
      await expect(scene).toHaveAttribute("data-view",mode);
      expect(await scene.locator(".welcome-code").evaluate(el=>el.getAnimations().length)).toBeGreaterThan(0);
      const movingGaps=await page.evaluate(async()=>{
        const gaps=[];
        while(document.querySelector(".welcome-code").getAnimations().length) {
          await new Promise(resolve=>requestAnimationFrame(resolve));
          const source=document.querySelector(".welcome-code"),preview=document.querySelector(".terminal-formula");
          const a=source.getBoundingClientRect(),b=preview.getBoundingClientRect();
          if(a.width<1 || b.width<1 || getComputedStyle(source).visibility!=="visible" || getComputedStyle(preview).visibility!=="visible" || Number(getComputedStyle(source).opacity)<.05 || Number(getComputedStyle(preview).opacity)<.05)continue;
          gaps.push(innerWidth>=700 ? b.left-a.right : document.querySelector(".catalyst-brand").getBoundingClientRect().top-a.bottom);
        }
        return gaps;
      });
      expect(movingGaps.every(gap=>gap>=-.5)).toBe(true);
      await expect(scene.locator(".welcome-code")).toBeVisible({visible:mode!=="preview"});
      await expect(scene.locator(".terminal-formula")).toBeVisible({visible:mode!=="code"});
      await expect(scene.getByRole("button",{name,exact:true})).toHaveAttribute("aria-pressed","true");
      const geometry=await page.evaluate(()=>{
        const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};
        return {source:box(".welcome-code"),formula:box(".terminal-formula"),brand:box(".catalyst-brand"),controls:box(".welcome-views"),actions:box(".terminal-actions"),description:box(".welcome-description"),caption:box(".terminal-caption"),hint:box(".terminal-scroll"),overflow:document.documentElement.scrollWidth>innerWidth};
      });
      expect(geometry.controls.top).toBeGreaterThan(0);
      expect(Math.abs(geometry.controls.top-anchors[0])).toBeLessThan(.5);
      expect(Math.abs(geometry.actions.top-anchors[1])).toBeLessThan(.5);
      expect(geometry.description.top).toBeGreaterThan(0);
      expect(geometry.caption.bottom).toBeLessThan(geometry.actions.top-8);
      expect(geometry.actions.bottom).toBeLessThan(geometry.hint.top-8);
      const center=(geometry.controls.top+geometry.actions.bottom)/2;
      expect(center).toBeLessThanOrEqual(height/2+1);
      expect(center).toBeGreaterThan(height*.35);
      if(geometry.hint.top-geometry.actions.bottom>25)expect(Math.abs(center-height/2)).toBeLessThan(1);
      expect(geometry.overflow).toBe(false);
      if(mode==="split") {
        if(width>=700)expect(geometry.source.right).toBeLessThan(geometry.formula.left-20);
        else expect(geometry.source.bottom).toBeLessThan(geometry.brand.top-12);
      }
      if(mode!=="preview") {
        await expect(scene.locator(".welcome-code")).toHaveCSS("background-color","rgb(5, 5, 5)");
        await expect(scene.locator(".welcome-code")).toHaveCSS("border-top-color","rgb(39, 39, 42)");
        await expect(scene.locator(".welcome-code")).toHaveCSS("color","rgb(237, 237, 237)");
        await expect(scene.locator(".welcome-code")).toContainText(String.raw`\xrightarrow{\text{Catalex}} \text{Paper}`);
        expect(await scene.locator(".welcome-code").evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeLessThan(34);
        expect(await scene.locator(".welcome-code .latex-command").count()).toBeGreaterThan(4);
        expect(await scene.locator(".welcome-code").evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
      }
      await page.screenshot({path:`output/welcome-views-${width}-${mode}.png`});
    }
  });
}

test("Welcome view controls support rapid keyboard changes, resize, reduced motion, and Main-page entry",async({page})=>{
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto("./?intro=typewriter&playIntro=0");
  const scene=page.locator(".intro-scene");
  await expect(page.locator("html")).toHaveAttribute("data-intro","ready");
  await page.keyboard.press("Tab");
  await expect(scene.getByRole("button",{name:"Preview only"})).toBeFocused();
  for(const key of ["ArrowLeft","ArrowLeft","End"])await page.keyboard.press(key);
  await page.waitForFunction(()=>document.querySelector(".welcome-code").getAnimations().length===0);
  await expect(scene.getByRole("button",{name:"Preview only"})).toHaveAttribute("aria-pressed","true");
  await expect(scene.locator(".welcome-code")).toBeHidden();
  await scene.getByRole("button",{name:"Split view"}).dispatchEvent("click");
  await page.setViewportSize({width:390,height:844});
  await expect(scene.getByRole("button",{name:"Split view"})).toHaveAttribute("aria-pressed","true");
  await expect(scene.locator(".welcome-code")).toBeVisible();
  await expect(scene.locator(".terminal-formula")).toBeVisible();
  await page.emulateMedia({reducedMotion:"reduce"});
  await scene.getByRole("button",{name:"Code only"}).click();
  expect(await scene.locator(".welcome-code").evaluate(el=>el.getAnimations().length)).toBe(0);
  await expect(scene.locator(".terminal-formula")).toBeHidden();
  await scene.getByRole("button",{name:"Scroll down to learn more"}).click();
  await expect(scene).toHaveCount(0);
  await expect(page.locator("#main .hero-caption")).toBeVisible();
  expect(errors).toEqual([]);
});

for(const [width,height] of [[1440,1000],[390,844],[844,390]]) {
  test(`Welcome preview groups its small product description with Beta is now available at ${width}px`, async({page})=>{
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:"no-preference"});
    await page.goto("./?intro=typewriter&playIntro=0");
    await expect(page.locator("html")).toHaveAttribute("data-intro","ready");
    const scene=page.locator(".intro-scene");
    await expect(scene.locator(".terminal-view")).toBeHidden();
    await expect(scene.locator(".terminal-caption > span").first()).toHaveText("A LaTeX workspace for you and your agent.");
    await expect(scene.locator(".terminal-caption > span")).toHaveCount(1);
    await expect(page.locator("#main .hero-caption")).toHaveText("Draft, polish, and format with agent assistance, using the subscription you already have.");
    const caption=await scene.locator(".terminal-caption").boundingBox();
    const brand=await scene.locator(".catalyst-brand").boundingBox();
    const actions=await scene.locator(".terminal-actions").boundingBox();
    const hint=await scene.locator(".terminal-scroll").boundingBox();
    const description=await scene.locator(".welcome-description").boundingBox();
    const controls=await scene.locator(".welcome-views").boundingBox();
    await expect(scene.locator(".welcome-title")).toHaveCount(0);
    await expect(scene.getByRole("link",{name:"Beta is now available"})).toHaveAttribute("href","./download/");
    expect(description.y).toBeGreaterThan(0);
    expect(caption.y+caption.height).toBeLessThan(actions.y-8);
    expect(actions.y-caption.y-caption.height).toBeLessThan(20);
    expect(await scene.locator(".terminal-caption").evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(height<450 || width<600 ? 14 : 16);
    const center=(controls.y+actions.y+actions.height)/2;
    expect(center).toBeLessThanOrEqual(height/2+1);
    expect(center).toBeGreaterThan(height*.3);
    if(hint.y-actions.y-actions.height>25)expect(Math.abs(center-height/2)).toBeLessThan(1);
    expect(actions.y+actions.height).toBeLessThan(hint.y-8);
    await page.screenshot({path:`output/welcome-copy-${width}.png`});
    await page.clock.install();
    await page.clock.fastForward(10000);
    await expect(page.locator("html")).toHaveAttribute("data-intro","ready");
  });
}

for (const width of [390, 1440]) {
  test(`terminal zooms from large LaTeX to a Compile button aligned with Catalex at ${width}px`, async ({page}) => {
    const height = width === 390 ? 844 : 1000;
    await page.setViewportSize({width, height});
    await page.emulateMedia({reducedMotion:"no-preference"});
    const errors=[];
    page.on("pageerror", error=>errors.push(error.message));
    await page.goto("./?playIntro=1");
    const root=page.locator("html");
    const scene=page.locator(".intro-scene");
    const formula=scene.locator(".reaction");
    await page.waitForFunction(()=>document.documentElement.dataset.intro === "blinking");
    await expect(scene.locator(".braun-keyboard, .printer-carriage, .printer-rails")).toHaveCount(0);
    await expect(scene.locator(".terminal-view")).toHaveCSS("background-color","rgb(5, 5, 5)");
    await expect(scene.locator(".terminal-result")).toBeHidden();
    expect(await page.locator("#main").evaluate(el=>el.inert)).toBe(true);
    expect(await scene.locator(".terminal-actions").evaluate(el=>el.inert)).toBe(true);
    const blinking=await page.evaluate(async()=>{
      const values=[];
      while(document.documentElement.dataset.intro === "blinking") {
        values.push(Number(getComputedStyle(document.querySelector(".terminal-cursor")).opacity)>.5);
        await new Promise(resolve=>requestAnimationFrame(resolve));
      }
      return values;
    });
    let darkIntervals=0, visible=true;
    for(const sample of blinking){if(!sample && visible)darkIntervals++;visible=sample;}
    expect(darkIntervals).toBe(2);
    const cursor=scene.locator(".terminal-cursor");
    const cursorBox=await cursor.boundingBox();
    expect(cursorBox.width).toBeGreaterThan(20);
    expect(cursorBox.height).toBeGreaterThan(30);
    expect(await scene.locator(".terminal-track").evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(34);
    await page.mouse.wheel(0,600);
    const samples=await page.evaluate(async()=>{
      const values=[];
      for(let frame=0;frame<240;frame++){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const track=document.querySelector(".terminal-track");
        const point=document.querySelector(".terminal-cursor").getBoundingClientRect();
        values.push({length:document.querySelector(".terminal-text").textContent.length,
          x:point.left+point.width/2, y:point.top+point.height/2,
          cameraX:new DOMMatrix(getComputedStyle(track).transform).m41,
          zoom:new DOMMatrix(getComputedStyle(track).transform).a,
          pixelAligned:Math.abs(new DOMMatrix(getComputedStyle(track).transform).m41*devicePixelRatio-Math.round(new DOMMatrix(getComputedStyle(track).transform).m41*devicePixelRatio))<.01});
        // Observe a line-break zoom without depending on a fixed source length.
        if(frame>=110 && values.at(-1).zoom<values[0].zoom-.01)break;
      }
      return values;
    });
    expect(samples.at(-1).length).toBeGreaterThan(samples[0].length);
    expect(samples.at(-1).zoom).toBeLessThan(samples[0].zoom);
    expect(samples.every(sample=>sample.x>0 && sample.x<width && sample.y>0 && sample.y<height)).toBe(true);
    expect(samples.every(sample=>sample.pixelAligned)).toBe(true);
    await expect(scene.locator(".terminal-track")).toHaveCSS("text-shadow","none");
    await expect(scene.locator(".terminal-track")).toHaveCSS("filter","none");
    expect(Math.max(...samples.map(s=>s.cameraX))-Math.min(...samples.map(s=>s.cameraX))).toBeGreaterThan(20);
    expect(samples.slice(1).some((sample,index)=>sample.length===samples[index].length && Math.abs(sample.cameraX-samples[index].cameraX)>.1)).toBe(true);
    await expect(formula).toBeHidden();
    await page.screenshot({path:`output/terminal-follow-test-${width}.png`});
    await page.waitForFunction(()=>document.documentElement.dataset.intro === "compile-ready", null, {timeout:18000});
    expect(await scene.locator(".terminal-text").textContent()).toContain(String.raw`\xrightarrow{\text{Catalex}}`);
    expect((await scene.locator(".terminal-text").textContent()).endsWith("\\]" )).toBe(true);
    await expect(scene.locator(".latex-command").first()).toHaveText("\\text");
    const syntaxColors = await scene.locator(".terminal-track").locator(".latex-command, .latex-brace, .latex-operator").evaluateAll(nodes=>[...new Set(nodes.map(node=>getComputedStyle(node).color))]);
    expect(syntaxColors.length).toBe(3);
    const compileButton=scene.getByRole("button",{name:"Compile",exact:true});
    await expect(compileButton).toBeFocused();
    await expect(scene.locator(".terminal-cursor-flight")).toBeVisible();
    await expect(scene.locator(".terminal-cursor-flight")).toHaveCSS("border-top-width","2px");
    await expect(scene.locator(".terminal-track .terminal-cursor")).toHaveCount(0);
    const alignment=await page.evaluate(()=>{
      const brand=document.querySelector(".terminal-intro .catalyst-brand").getBoundingClientRect();
      const button=document.querySelector(".terminal-compile").getBoundingClientRect();
      const scale=Number(getComputedStyle(document.querySelector(".intro-scene")).getPropertyValue("--formula-scale"));
      const track=document.querySelector(".terminal-track");
      return {x:Math.abs(brand.left+brand.width/2-button.left-button.width/2),
        y:Math.abs(brand.top+brand.height/2-button.top-button.height/2),
        terminalSize:parseFloat(getComputedStyle(track).fontSize)*new DOMMatrix(getComputedStyle(track).transform).a,
        renderedSize:parseFloat(getComputedStyle(document.querySelector(".terminal-intro .reactant")).fontSize)*scale};
    });
    expect(alignment.x).toBeLessThan(1);
    expect(alignment.y).toBeLessThan(1);
    expect(Math.abs(alignment.terminalSize-alignment.renderedSize)).toBeLessThan(.01);
    if(width===390) await page.keyboard.down("Enter");
    else {
      const box=await compileButton.boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
      await page.mouse.down();
    }
    await expect(compileButton).toHaveClass(/is-pressed/);
    await expect(root).toHaveAttribute("data-intro","compile-pressed");
    await page.waitForTimeout(260);
    await expect(root).toHaveAttribute("data-intro","compile-pressed");
    await expect(scene.locator(".terminal-result")).toBeHidden();
    await expect(compileButton).toHaveCSS("opacity","1");
    if(width===390) await page.keyboard.up("Enter");
    else await page.mouse.up();
    await page.waitForFunction(()=>document.documentElement.dataset.intro === "revealing");
    const origin=await scene.locator(".terminal-result").evaluate(el=>{
      const clip=getComputedStyle(el).clipPath.match(/circle\(([\d.]+)px at ([\d.]+)px ([\d.]+)px\)/);
      const point=document.querySelector(".terminal-intro .catalyst-brand").getBoundingClientRect();
      return {radius:Number(clip[1]),xError:Math.abs(Number(clip[2])-point.left-point.width/2),yError:Math.abs(Number(clip[3])-point.top-point.height/2)};
    });
    expect(origin.xError).toBeLessThan(1);
    expect(origin.yError).toBeLessThan(1);
    await page.waitForTimeout(120);
    const later=await scene.locator(".terminal-result").evaluate(el=>parseFloat(getComputedStyle(el).clipPath.match(/circle\(([\d.]+)px/)[1]));
    expect(later).toBeGreaterThan(origin.radius);
    await expect(compileButton).not.toHaveClass(/is-pressed/);
    const handoff=await page.evaluate(()=>{
      const button=document.querySelector(".terminal-compile"),name=document.querySelector(".terminal-intro .catalyst-brand > span");
      return {button:Number(getComputedStyle(button).opacity),name:Number(getComputedStyle(name).opacity)};
    });
    expect(handoff.button).toBeLessThan(1);
    expect(handoff.name).toBeGreaterThan(0);
    await expect(scene.locator(".terminal-actions")).toHaveCSS("opacity","1");
    await expect(root).toHaveAttribute("data-intro","ready");
    await expect(scene.locator(".terminal-view")).toBeHidden();
    await expect(scene.locator(".terminal-result")).toHaveCSS("clip-path","none");
    await expect(formula).toBeVisible();
    const line=await formula.boundingBox();
    const actions=await scene.locator(".terminal-actions").boundingBox();
    const hint=await scene.locator(".terminal-scroll").boundingBox();
    expect(Math.abs(line.x+line.width/2-width/2)).toBeLessThan(1);
    const brand=await scene.locator(".catalyst-brand").boundingBox();
    const caption=await scene.locator(".terminal-caption").boundingBox();
    const description=await scene.locator(".welcome-description").boundingBox();
    const controls=await scene.locator(".welcome-views").boundingBox();
    expect(caption.y+caption.height).toBeLessThan(actions.y-8);
    expect(actions.y-caption.y-caption.height).toBeLessThan(20);
    expect(Math.abs((controls.y+actions.y+actions.height)/2-height/2)).toBeLessThan(1);
    const arrow=await scene.locator(".catalyst").boundingBox();
    expect(brand.x).toBeGreaterThan(arrow.x);
    expect(brand.x+brand.width).toBeLessThan(arrow.x+arrow.width);
    const headerBox = await page.locator(".site-header").boundingBox();
    const stageWidth = Math.min(1200, headerBox.width);
    expect(Math.abs(line.x-(width-stageWidth)/2)).toBeLessThan(1);
    expect(Math.abs(line.width-stageWidth)).toBeLessThan(1);
    expect(actions.y).toBeGreaterThan(line.y+line.height+30);
    expect(hint.y).toBeGreaterThan(actions.y+actions.height+8);
    const sceneBox = await scene.boundingBox();
    expect(Math.abs(actions.x+actions.width/2-sceneBox.x-sceneBox.width/2)).toBeLessThan(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`output/terminal-ready-test-${width}.png`});
    for(const delta of [120,120]){
      await page.mouse.wheel(0,delta);
      await page.waitForTimeout(100);
      await expect(root).toHaveAttribute("data-intro","ready");
    }
    await page.mouse.wheel(0,40);
    await expect(root).toHaveAttribute("data-intro","complete");
    await expect(scene).toHaveCount(0);
    expect(await page.locator("#main").evaluate(el=>el.inert)).toBe(false);
    await expect(page.getByRole("heading",{level:1})).toHaveText("A catalyst for your next paper.");
    await expect(page.locator("#main .hero-caption")).toHaveText("Draft, polish, and format with agent assistance, using the subscription you already have.");
    await page.reload();
    await expect(root).toHaveAttribute("data-intro","complete");
    await expect(page).toHaveURL(/#main$/);
    expect(errors).toEqual([]);
  });
}

test("line breaks accelerate and shake, then the cursor smears into the Compile outline", async ({page}) => {
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto("./?intro=typewriter&playIntro=1");
  await page.waitForFunction(()=>document.documentElement.dataset.intro === "blinking");
  const result=await page.evaluate(async()=>{
    const text=document.querySelector(".terminal-text");
    const view=document.querySelector(".terminal-view");
    const samples=[], impacts=new Set(), flightWidths=[];
    let downward=0,rebound=0,tilt=0,punch=1;
    let length=0;
    const observer=new MutationObserver(()=>{
      const source=text.textContent;
      if(source.length===length)return;
      length=source.length;
      samples.push({at:performance.now(),line:source.split("\n").length,last:source.at(-1)});
    });
    observer.observe(text,{subtree:true,characterData:true,childList:true});
    while(document.documentElement.dataset.intro!=="compile-ready") {
      await new Promise(resolve=>requestAnimationFrame(resolve));
      if(getComputedStyle(view).transform!=="none") {
        impacts.add(text.textContent.split("\n").length);
        const matrix=new DOMMatrix(getComputedStyle(view).transform);
        downward=Math.max(downward,matrix.f);
        rebound=Math.min(rebound,matrix.f);
        const angle=Math.atan2(matrix.b,matrix.a)*180/Math.PI;
        tilt=Math.max(tilt,Math.abs(angle));
        punch=Math.max(punch,Math.hypot(matrix.a,matrix.b));
      }
      if(document.documentElement.dataset.intro==="cursor-jump")flightWidths.push(document.querySelector(".terminal-cursor-smear path").getBBox().width);
    }
    observer.disconnect();
    const intervals={};
    for(let i=1;i<samples.length;i++) {
      const a=samples[i-1],b=samples[i];
      if(a.line===b.line && /[A-Za-z]/.test(a.last) && /[A-Za-z]/.test(b.last))
        (intervals[b.line]??=[]).push(b.at-a.at);
    }
    const medians=Object.fromEntries(Object.entries(intervals).map(([line,values])=>{
      values.sort((a,b)=>a-b);
      return [line,values[Math.floor(values.length/2)]];
    }));
    const cursor=document.querySelector(".terminal-cursor"),ring=cursor.getBoundingClientRect(),button=document.querySelector(".terminal-compile").getBoundingClientRect();
    return {medians,impacts:[...impacts],downward,rebound,tilt,punch,reset:getComputedStyle(view).transform,flightWidths,
      xError:Math.abs(ring.x+ring.width/2-button.x-button.width/2),
      yError:Math.abs(ring.y+ring.height/2-button.y-button.height/2),
      surrounds:ring.left<button.left && ring.right>button.right && ring.top<button.top && ring.bottom>button.bottom,
      blink:document.querySelector(".terminal-cursor").getAnimations()
        .filter(animation=>animation.playState==="running")
        .map(animation=>animation.effect.getTiming().duration)};
  });
  expect(result.medians[3]).toBeLessThan(result.medians[2]*.9);
  expect(result.medians[4]).toBeLessThan(result.medians[3]*.9);
  expect(result.impacts).toEqual(expect.arrayContaining([2,3,4,5]));
  expect(result.downward).toBeLessThanOrEqual(6);
  expect(result.rebound).toBeGreaterThanOrEqual(-6);
  expect(result.tilt).toBeGreaterThan(.05);
  expect(result.tilt).toBeLessThan(.3);
  expect(result.punch).toBeCloseTo(1,5);
  expect(result.reset).toBe("none");
  expect(result.blink).toEqual([]);
  expect(Math.max(...result.flightWidths)-Math.min(...result.flightWidths)).toBeGreaterThan(100);
  expect(result.xError).toBeLessThan(1);
  expect(result.yError).toBeLessThan(1);
  expect(result.surrounds).toBe(true);
  const beat=await page.evaluate(async()=>{
    const button=document.querySelector(".terminal-compile");
    const width=button.getBoundingClientRect().width;
    const ringWidth=document.querySelector(".terminal-cursor").getBoundingClientRect().width;
    let minRingWidth=ringWidth, lastRingWidth=ringWidth, centerError=0, heldFrames=0, earlyReveal=false;
    let darkIntervals=0,visible=true;
    while(document.documentElement.dataset.intro==="compile-ready") {
      const on=Number(getComputedStyle(document.querySelector(".terminal-cursor")).opacity)>.5;
      if(!on && visible)darkIntervals++;
      visible=on;
      await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    const pressedAt=performance.now();
    const widthChange=Math.abs(button.getBoundingClientRect().width-width);
    const color=getComputedStyle(button).color;
    let pressedShade=255,revealAt=null;
    const radii=[];
    while(!document.querySelector(".terminal-cursor").hidden) {
      if(document.documentElement.dataset.intro==="compile-pressed") {
        heldFrames++;
        earlyReveal ||= getComputedStyle(document.querySelector(".terminal-result")).visibility!=="hidden";
      }
      if(document.documentElement.dataset.intro==="revealing") {
        revealAt??=performance.now();
        radii.push({at:performance.now(),radius:Number(getComputedStyle(document.querySelector(".terminal-result")).clipPath.match(/circle\(([\d.]+)px/)[1])});
      }
      pressedShade=Math.min(pressedShade,Number(getComputedStyle(button).backgroundColor.match(/\d+/)[0]));
      const ring=document.querySelector(".terminal-cursor").getBoundingClientRect(),box=button.getBoundingClientRect();
      minRingWidth=Math.min(minRingWidth,ring.width);
      lastRingWidth=ring.width;
      centerError=Math.max(centerError,Math.abs(ring.x+ring.width/2-box.x-box.width/2),Math.abs(ring.y+ring.height/2-box.y-box.height/2));
      await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    return {darkIntervals,widthChange,color,pressedShade,radii,revealDelay:revealAt-pressedAt,contraction:ringWidth-minRingWidth,releasedWidth:lastRingWidth,ringWidth,heldFrames,earlyReveal,centerError,duration:performance.now()-pressedAt};
  });
  expect(beat.darkIntervals).toBe(0);
  expect(beat.widthChange).toBeLessThan(.01);
  expect(beat.color).toBe("rgb(24, 24, 27)");
  expect(beat.pressedShade).toBeLessThan(245);
  expect(beat.contraction).toBeGreaterThan(6);
  expect(beat.releasedWidth).toBeGreaterThan(beat.ringWidth-2);
  expect(beat.heldFrames).toBeGreaterThan(3);
  expect(beat.earlyReveal).toBe(false);
  expect(beat.centerError).toBeLessThan(1);
  expect(beat.revealDelay).toBeGreaterThan(120);
  expect(beat.revealDelay).toBeLessThan(240);
  expect(beat.duration).toBeGreaterThan(280);
  expect(beat.duration).toBeLessThan(440);
  expect(beat.radii.length).toBeGreaterThan(5);
  expect(beat.radii.slice(1).every((sample,i)=>sample.radius>beat.radii[i].radius)).toBe(true);
});

test("reduced motion presents the completed terminal result and keyboard entry works", async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: "reduce"});
  await page.goto("./?intro=typewriter");
  const scene = page.locator(".intro-scene");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  await expect(scene.locator(".reaction")).toHaveCSS("clip-path", "none");
  await expect(scene.locator(".terminal-view")).toBeHidden();
  await expect(scene.locator(".reaction")).toBeVisible();
  await page.clock.install();
  await page.clock.fastForward(120000);
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  await page.keyboard.press("Tab");
  await expect(scene.getByRole("button", {name: "Preview only"})).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(scene.getByRole("link", {name: "Beta is now available"})).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(scene.getByRole("link", {name: "GitHub"})).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(scene.getByRole("button", {name: "Scroll down to learn more"})).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(scene).toHaveCount(0);
  await expect(page.locator(".site-header .brand")).toBeFocused();
});

test("the landing download action works without entering the main screen", async ({page}) => {
  await page.emulateMedia({reducedMotion: "reduce"});
  await page.goto("./?intro=typewriter");
  await page.locator(".intro-scene").getByRole("link", {name: "Beta is now available"}).click();
  await expect(page.getByRole("heading", {name: "Welcome to Catalex."})).toBeVisible();
});

test("touch scroll accumulation enters while pinch and horizontal wheel do not", async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: "reduce"});
  await page.goto("./?intro=typewriter");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  await page.locator(".intro-scene").dispatchEvent("wheel", {deltaY: 400, ctrlKey: true});
  await page.locator(".intro-scene").dispatchEvent("wheel", {deltaX: 400, deltaY: 0});
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  const touch = (type, y) => page.evaluate(({type, y}) => {
    const target = document.querySelector(".intro-scene");
    const point = new Touch({identifier: 1, target, clientX: 190, clientY: y});
    target.dispatchEvent(new TouchEvent(type, {touches: [point], bubbles: true, cancelable: true}));
  }, {type, y});
  await touch("touchstart", 700);
  await touch("touchmove", 580);
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  await touch("touchmove", 430);
  await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
});

test("line-mode wheel input and reverse scrolling use the same entry threshold", async ({page}) => {
  await page.emulateMedia({reducedMotion: "reduce"});
  await page.goto("./?intro=typewriter");
  const scene = page.locator(".intro-scene");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  await scene.dispatchEvent("wheel", {deltaY: 10, deltaMode: 1});
  await scene.dispatchEvent("wheel", {deltaY: -6, deltaMode: 1});
  await scene.dispatchEvent("wheel", {deltaY: 10, deltaMode: 1});
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  await scene.dispatchEvent("wheel", {deltaY: 3, deltaMode: 1});
  await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
});

test("resize and live reduced motion settle the screen without entering", async ({page}) => {
  await page.emulateMedia({reducedMotion: "no-preference"});
  await page.goto("./?intro=typewriter&playIntro=1");
  await page.waitForFunction(()=>document.documentElement.dataset.intro === "cursor-jump", null, {timeout:12000});
  await page.emulateMedia({reducedMotion: "reduce"});
  await expect(page.locator(".terminal-cursor-flight")).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-intro", "ready");
  await page.setViewportSize({width: 844, height: 390});
  const scene = page.locator(".intro-scene");
  // The viewport API resolves before the application's resize listener remeasures.
  await expect.poll(() => scene.evaluate(el => {
    const buttons = el.querySelector('.terminal-actions').getBoundingClientRect();
    const hint = el.querySelector('.terminal-scroll').getBoundingClientRect();
    return buttons.bottom < hint.top - 8;
  })).toBe(true);
  const buttons = await scene.locator(".terminal-actions").boundingBox();
  const hint = await scene.locator(".terminal-scroll").boundingBox();
  expect(buttons.y + buttons.height).toBeLessThan(hint.y - 8);
  const formula = await scene.locator(".reaction").boundingBox();
  expect(formula.x).toBeGreaterThan(0);
  expect(formula.x + formula.width).toBeLessThan(844);
  expect(await page.locator("#main").evaluate(el => el.inert)).toBe(true);
  await page.keyboard.press("PageDown");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "complete");
});

test("an unavailable terminal module falls back to the usable homepage", async ({page}) => {
  await page.route("**/typewriter.js", route=>route.abort());
  await page.goto("./?intro=typewriter");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "complete", {timeout:10000});
  await expect(page.locator(".intro-scene")).toHaveCount(0);
  expect(await page.locator("#main").evaluate(el=>el.inert)).toBe(false);
  await page.locator(".header-download").click();
  await expect(page.getByRole("heading",{name:"Welcome to Catalex."})).toBeVisible();
});


test("returning homepage skips Intro, with explicit replay available",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("./");
  const root=page.locator("html");
  await expect(root).toHaveAttribute("data-intro","ready");
  await page.getByRole("button",{name:"Scroll down to learn more"}).click();
  await expect(root).toHaveAttribute("data-intro","complete");
  await page.evaluate(() => scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'}));
  await page.locator(".site-header .brand").click();
  expect(new URL(page.url()).search).toBe("");
  expect(new URL(page.url()).hash).toBe("#top");
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.reload();
  await expect(root).toHaveAttribute("data-intro","ready");
  await expect(page.locator(".terminal-view")).toBeHidden();
  await page.screenshot({path:"output/home-intro-welcome.png"});
  await page.goto("./?playIntro=0#top");
  await expect(root).toHaveAttribute("data-intro","ready");
  await expect(page.locator(".terminal-view")).toBeHidden();
  await page.goto("./?playIntro=1#top");
  await expect(root).toHaveAttribute("data-intro","blinking");
  await expect(page.locator(".terminal-view")).toBeVisible();
  await expect(page.locator(".intro-letter")).toHaveCount(0);
  await page.screenshot({path:"output/home-header-refresh-intro.png"});
});
