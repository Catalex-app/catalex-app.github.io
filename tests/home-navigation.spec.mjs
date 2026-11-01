import {test,expect,webkit} from "@playwright/test";

const seen = page => page.evaluate(()=>localStorage.getItem("catalex.introSeen"));
const ready = page => expect(page.locator("html")).toHaveAttribute("data-intro","ready");
const main = page => expect(page.locator("html")).toHaveAttribute("data-intro","complete");

test("first visit records Intro once; refresh and later visits open Welcome",async({page,context})=>{
  await page.goto("./");
  await expect(page.locator("html")).toHaveAttribute("data-intro",/blinking|typing/);
  expect(await seen(page)).toBe("1");
  await page.reload();
  await ready(page);
  const second=await context.newPage();
  await second.goto("./");
  await ready(second);
  await page.evaluate(()=>localStorage.removeItem("catalex.introSeen"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-intro",/blinking|typing/);
  expect(await seen(page)).toBe("1");
});

for(const flag of [null,"1"]) {
  test(`Replay is one-time and leaves the seen flag unchanged (${flag})`,async({page})=>{
    await page.goto("./?playIntro=0");
    await ready(page);
    if(flag)await page.evaluate(()=>localStorage.setItem("catalex.introSeen","1"));
    await page.getByRole("link",{name:"Replay intro"}).click();
    await expect(page.locator("html")).toHaveAttribute("data-intro",/blinking|typing/);
    expect(new URL(page.url()).searchParams.has("playIntro")).toBe(false);
    expect(await seen(page)).toBe(flag);
    await expect(page.locator("html")).toHaveAttribute("data-intro","ready",{timeout:15000});
    await page.reload();
    await ready(page);
    expect(await seen(page)).toBe(flag);
  });
}

for(const width of [1440,390]) {
  test(`Main refresh preserves its screen and scroll; logo returns to Welcome at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    await page.emulateMedia({reducedMotion:"reduce"});
    await page.goto("./");
    await ready(page);
    await page.getByRole("button",{name:"Scroll down to learn more"}).click();
    await main(page);
    await expect(page).toHaveURL(/#main$/);
    await page.evaluate(()=>scrollTo({top:900,behavior:"instant"}));
    await page.reload();
    await main(page);
    await expect(page.locator(".intro-scene")).toHaveCount(0);
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(900);
    await expect(page.locator(".hero-caption > span")).toHaveCount(1);
    await page.locator(".site-header .brand").click();
    await ready(page);
    await expect(page).toHaveURL(/#top$/);
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
    await page.reload();
    await ready(page);
    await page.screenshot({path:`output/navigation-welcome-${width}.png`});
  });
}

test("Back, Forward, download refresh, and download logo preserve the right screen",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("./");
  await ready(page);
  await page.getByRole("button",{name:"Scroll down to learn more"}).click();
  await main(page);
  await page.goBack();
  await ready(page);
  await page.goForward();
  await main(page);
  await page.locator(".header-download").click();
  await expect(page).toHaveURL(/\/download\/$/);
  await page.reload();
  await expect(page.getByRole("heading",{name:"Welcome to Catalex."})).toBeVisible();
  await page.goBack();
  await main(page);
  await page.locator(".header-download").click();
  await page.locator(".site-header .brand").click();
  await ready(page);
  await page.getByRole("link",{name:"Beta is now available"}).click();
  await page.goBack();
  await ready(page);
});

test("unavailable browser storage does not block navigation",async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(window,"localStorage",{get(){throw new DOMException("Blocked","SecurityError")}});
  });
  await page.goto("./");
  await expect(page.locator("html")).toHaveAttribute("data-intro",/blinking|typing/);
  await page.reload();
  await ready(page);
});

test("logo returns in place with a downward fade, including repeated visits",async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto("./#main");
  await main(page);
  await page.evaluate(()=>{window.returnDocumentMarker="same document";});
  for(let visit=0;visit<2;visit++) {
    await page.evaluate(()=>scrollTo({top:1500,behavior:"instant"}));
    await page.locator(".site-header .brand").dispatchEvent("click",{button:0});
    await expect(page.locator("html")).toHaveAttribute("data-intro","returning");
    const during=await page.evaluate(()=>{
      const scene=document.querySelector(".intro-scene");
      const main=document.querySelector("#main");
      for(const element of [scene,main]) {
        for(const motion of element.getAnimations()) {motion.pause();motion.currentTime=180;}
      }
      return {
        scroll:scrollY,
        sceneY:scene.getBoundingClientRect().top,
        mainY:new DOMMatrix(getComputedStyle(main).transform).m42,
        sceneOpacity:Number(getComputedStyle(scene).opacity),
        mainOpacity:Number(getComputedStyle(main).opacity),
        headerY:document.querySelector(".site-header").getBoundingClientRect().top,
        marker:window.returnDocumentMarker,
      };
    });
    expect(during.scroll).toBe(1500);
    expect(during.sceneY).toBeLessThan(0);
    expect(during.sceneY).toBeGreaterThan(-1000);
    expect(during.mainY).toBeGreaterThan(0);
    expect(during.sceneOpacity).toBeGreaterThan(0);
    expect(during.mainOpacity).toBeGreaterThan(0);
    expect(during.headerY).toBe(16);
    expect(during.marker).toBe("same document");
    await page.evaluate(()=>{
      for(const element of document.querySelectorAll(".intro-scene, #main"))
        for(const motion of element.getAnimations())motion.play();
    });
    await ready(page);
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
    await expect(page.getByRole("link",{name:"Replay intro"})).toBeVisible();
    await page.getByRole("button",{name:"Split view",exact:true}).click();
    await page.getByRole("button",{name:"Scroll down to learn more"}).click();
    await main(page);
    expect(await page.evaluate(()=>window.returnDocumentMarker)).toBe("same document");
    await expect(page.locator(".hero-caption > span")).toHaveCount(1);
  }
});

test("WebKit restores Main scroll on refresh and returns to Welcome via the logo",async({baseURL})=>{
  const browser=await webkit.launch();
  try {
    const page=await browser.newPage({reducedMotion:"reduce"});
    await page.goto(baseURL);
    await ready(page);
    await page.getByRole("button",{name:"Scroll down to learn more"}).click();
    await main(page);
    await page.evaluate(()=>scrollTo({top:900,behavior:"instant"}));
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(900);
    await page.reload();
    await main(page);
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(900);
    await page.locator(".site-header .brand").click();
    await ready(page);
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
  } finally { await browser.close(); }
});
