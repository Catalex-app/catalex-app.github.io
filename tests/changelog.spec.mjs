import {test, expect} from "@playwright/test";

for (const width of [390, 1440]) {
  test(`Changelog uses the shared shell and navigable version headings at ${width}px`, async ({page, request}) => {
    await page.setViewportSize({width, height:950});
    await page.emulateMedia({reducedMotion:"reduce"});
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const route of ["./#main", "./download/", "./docs/development/"]) {
      await page.goto(route);
      if(width<=760) {
        await page.locator('.mobile-navigation summary').click();
        await page.locator('.mobile-navigation').getByRole('link', {name:'Changelog',exact:true}).click();
      } else await page.locator(".header-changelog").click();
      await expect(page).toHaveURL(/\/changelog\/$/);
      await expect(page.getByRole("heading", {level:1})).toHaveText("Changelog");
      await expect(page.locator('.header-nav [aria-current="page"]')).toHaveText("Changelog");
    }
    const links = page.getByRole("navigation", {name:"Versions"}).getByRole("link");
    expect(await links.count()).toBe(await page.locator(".docs-article h2").count());
    for (const href of await links.evaluateAll(links => links.map(link => link.getAttribute("href")))) {
      expect(await page.evaluate(href => Boolean(document.getElementById(href.slice(1))), href)).toBe(true);
    }
    await links.last().click();
    await expect(page).toHaveURL(/\/changelog\/#.+/);
    await expect(page.locator(".docs-source")).toHaveAttribute("href", "https://github.com/Catalex-app/Catalex/blob/main/CHANGELOG.md");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto("./changelog/");
    await page.screenshot({path:`output/changelog-${width}.png`, fullPage:true});
    const response = await request.get("./changelog", {maxRedirects:0});
    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe("/catalex.github.io/changelog/");
    expect(errors).toEqual([]);
  });
}

test("source dev server serves the generated changelog", async ({request}) => {
  const response = await request.get("http://127.0.0.1:4323/changelog/");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("Changelog — Catalex");
});
