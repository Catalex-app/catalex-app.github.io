import {test, expect} from "@playwright/test";

for (const [width,height,mode,motion] of [
  [1440,1000,"preview","no-preference"],
  [390,844,"preview","no-preference"],
  [844,390,"preview","no-preference"],
  [1440,1000,"split","no-preference"],
  [390,844,"code","no-preference"],
  [1440,1000,"preview","reduce"],
]) {
  test(`Welcome docks its buttons and keeps the brand still: ${width}px ${mode} ${motion}`, async({page})=>{
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:motion});
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto("./?playIntro=0#top");
    await expect(page.locator("html")).toHaveAttribute("data-intro","ready");
    const brand=page.locator(".site-header .brand");
    await expect(brand).toBeVisible();
    await expect(brand.locator(".catalex-mark > span")).toBeHidden();
    await expect(page.getByRole("link",{name:"Replay intro"})).toBeVisible();
    await expect(page.locator(".header-download")).toBeHidden();
    await expect(page.locator(".terminal-actions a").first()).toBeVisible();
    const headerBox=await page.locator(".site-header").boundingBox();
    expect((await page.locator(".welcome-views").boundingBox()).y).toBeGreaterThan(headerBox.y+headerBox.height);
    if(mode!=="preview") {
      await page.getByRole("button",{name:mode==="code" ? "Code only" : "Split view"}).click();
      await page.waitForFunction(()=>document.querySelector(".welcome-code").getAnimations().length===0);
    }
    const original=await page.evaluate(()=>{
      window.savedButtons=[...document.querySelectorAll(".terminal-actions a")];
      window.savedBrand=document.querySelector(".site-header .catalex-mark");
      window.savedWordmark=document.querySelector(".reaction .catalex-mark > span");
      const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
      return {buttons:window.savedButtons.map(rect),brand:rect(window.savedBrand)};
    });
    await page.screenshot({path:`output/floating-welcome-${width}-${mode}.png`});
    await page.getByRole("button",{name:"Scroll down to learn more"}).dispatchEvent("click");
    if(motion!=="reduce") {
      const frames=await page.evaluate(()=>{
        for(const a of document.getAnimations()){a.pause();a.currentTime=0;}
        const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
        const first=window.savedButtons.map(rect);
        for(const a of document.getAnimations())a.currentTime=525;
        return {first,middle:window.savedButtons.map(rect),brand:rect(window.savedBrand),same:window.savedButtons.every(el=>el.matches(".action-flight"))};
      });
      expect(frames.same).toBe(true);
      expect(frames.brand).toEqual(original.brand);
      for(let i=0;i<2;i++){
        for(const key of ["x","y","width","height"])expect(Math.abs(frames.first[i][key]-original.buttons[i][key])).toBeLessThan(1);
        expect(frames.middle[i].y).toBeLessThan(original.buttons[i].y);
      }
      await page.screenshot({path:`output/action-flight-${width}-${mode}.png`});
      await page.evaluate(()=>{for(const a of document.getAnimations())a.play()});
    }
    await expect(page.locator("html")).toHaveAttribute("data-intro","complete");
    await expect(page.locator(".action-flight,.wordmark-flight,.intro-scene")).toHaveCount(0);
    expect(await page.evaluate(()=>window.savedButtons.every(el=>el.parentElement.matches(".header-actions")) && document.querySelector(".site-header .catalex-mark")===window.savedBrand)).toBe(true);
    expect(await brand.locator(".catalex-mark > span").evaluate(el=>el===window.savedWordmark)).toBe(true);
    await expect(brand.locator(".catalex-mark > span")).toBeVisible();
    await expect(page.getByRole("link",{name:"Replay intro"})).toBeHidden();
    await expect(page.locator(".header-download")).toHaveAccessibleName("Beta download");
    await expect(page.locator(".header-download")).toHaveAttribute("href","./download/");
    await expect(page.locator(".header-github")).toHaveAccessibleName("GitHub");
    await expect(page.locator(".header-github")).toHaveAttribute("href","https://github.com/Catalex-app/Catalex");
    await expect(page.locator(".header-actions")).toBeVisible();
    await page.screenshot({path:`output/floating-main-${width}-${mode}.png`});
    await page.evaluate(()=>scrollTo({top:document.body.scrollHeight,behavior:"instant"}));
    await brand.click();
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
    expect(errors).toEqual([]);
  });
}

for(const interruption of ["resize","reduced motion"]) {
  test(`button docking settles safely on ${interruption}`,async({page})=>{
    await page.goto("./?playIntro=0");
    await expect(page.locator("html")).toHaveAttribute("data-intro","ready");
    await page.getByRole("button",{name:"Scroll down to learn more"}).dispatchEvent("click");
    await expect(page.locator("html")).toHaveAttribute("data-intro","docking");
    if(interruption==="resize")await page.setViewportSize({width:390,height:844});
    else await page.emulateMedia({reducedMotion:"reduce"});
    await expect(page.locator("html")).toHaveAttribute("data-intro","complete");
    await expect(page.locator(".action-flight,.wordmark-flight,.intro-scene")).toHaveCount(0);
    await expect(page.locator(".header-download")).toBeVisible();
    await expect(page.locator(".header-github")).toBeVisible();
    expect(await page.locator("#main").evaluate(el=>el.inert)).toBe(false);
  });
}

test("Welcome header brand stays on Welcome and the terminal keeps the header hidden",async({page})=>{
  await page.goto("./?playIntro=1");
  await expect(page.locator("html")).toHaveAttribute("data-intro",/blinking|typing/);
  await expect(page.locator(".site-header")).toBeHidden();
  await page.goto("./?playIntro=0");
  await expect(page.locator("html")).toHaveAttribute("data-intro","ready");
  await page.locator(".site-header .brand").click();
  await expect(page.locator("html")).toHaveAttribute("data-intro","ready");
  await expect(page.locator(".header-download")).toBeHidden();
});

test("scrolling over the floating header also enters Main",async({page})=>{
  await page.goto("./?playIntro=0");
  await expect(page.locator("html")).toHaveAttribute("data-intro","ready");
  await page.locator(".site-header").dispatchEvent("wheel",{deltaY:300});
  await expect(page.locator("html")).toHaveAttribute("data-intro","complete");
  await page.locator(".header-download").click();
  await expect(page).toHaveURL(/\/download\/$/);
});

test("Replay intro reveals the header with the same expanding circle as Welcome",async({page})=>{
  await page.goto("./?playIntro=0");
  await expect(page.locator("html")).toHaveAttribute("data-intro","ready");
  await page.getByRole("link",{name:"Replay intro"}).click();
  await expect(page.locator("html")).toHaveAttribute("data-intro",/blinking|typing/);
  await expect(page.locator(".site-header")).toBeHidden();
  await page.waitForFunction(()=>document.documentElement.dataset.intro==="revealing",{},{timeout:15000});
  const geometry=await page.evaluate(()=>{
    const result=document.querySelector(".terminal-result");
    const header=document.querySelector(".site-header");
    const a=result.getAnimations().find(a=>a.effect.getKeyframes()[0].clipPath);
    const b=header.getAnimations().find(a=>a.effect.getKeyframes()[0].clipPath);
    a.pause(); b.pause(); a.currentTime=b.currentTime=650;
    const clip=el=>getComputedStyle(el).clipPath.match(/circle\(([\d.]+)px at ([\d.-]+)px ([\d.-]+)px\)/).slice(1).map(Number);
    const box=header.getBoundingClientRect();
    return {result:clip(result),header:clip(header),x:box.x,y:box.y};
  });
  expect(Math.abs(geometry.result[0]-geometry.header[0])).toBeLessThan(.1);
  expect(Math.abs(geometry.result[1]-geometry.header[1]-geometry.x)).toBeLessThan(.1);
  expect(Math.abs(geometry.result[2]-geometry.header[2]-geometry.y)).toBeLessThan(.1);
  await page.screenshot({path:"output/header-during-intro-reveal.png"});
  await page.evaluate(()=>{for(const el of document.querySelectorAll(".terminal-result,.site-header"))for(const a of el.getAnimations())a.play()});
  await expect(page.locator("html")).toHaveAttribute("data-intro","ready");
  await expect(page.getByRole("link",{name:"Replay intro"})).toBeVisible();
  await expect(page.locator(".site-header")).toHaveCSS("clip-path","none");
});
