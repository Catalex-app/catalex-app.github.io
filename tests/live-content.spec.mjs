import {test, expect} from '@playwright/test';

const raw = 'https://raw.githubusercontent.com/Catalex-app/Catalex/main/';

for (const width of [390,1280]) {
  test(`Docs show fallback first, then refresh safely at ${width}px`, async({page}) => {
    await page.setViewportSize({width,height:960});
    let release;
    const gate = new Promise(resolve => { release=resolve; });
    let requests=0;
    await page.route(`${raw}docs/getting-started.md`, async route => {
      requests++;
      await gate;
      await route.fulfill({contentType:'text/plain',body:`# Getting started, refreshed

This content was updated in the app repository.

## Install

See [comments](comments.md#notes) and a [new guide](future-guide.md).

<script>window.injected = true</script>

## Install

Second section.
`});
    });
    await page.goto('./docs/getting-started/');
    const content=page.locator('.docs-content');
    await expect(content).toHaveAttribute('data-refresh','loading');
    await expect(content.locator('h1')).toHaveText('Getting started');
    await page.evaluate(()=>{window.originalHeader=document.querySelector('.site-header');window.originalFooter=document.querySelector('.docs-pagination');});
    release();
    await expect(content).toHaveAttribute('data-refresh','fresh');
    await expect(content.locator('h1')).toHaveText('Getting started, refreshed');
    await expect(page).toHaveTitle('Getting started, refreshed — Catalex');
    await expect(page.locator('.docs-sidebar [aria-current="page"]')).toHaveText('Getting started, refreshed');
    await expect(content.getByRole('link',{name:'comments',exact:true})).toHaveAttribute('href','../comments/#notes');
    await expect(content.getByRole('link',{name:'new guide'})).toHaveAttribute('href','https://github.com/Catalex-app/Catalex/blob/main/docs/future-guide.md');
    await expect(content.locator('#install-1')).toHaveText('Install');
    await expect(content.locator('script')).toHaveCount(0);
    expect(await page.evaluate(()=>window.injected)).toBeUndefined();
    expect(await page.evaluate(()=>window.originalHeader===document.querySelector('.site-header') && window.originalFooter===document.querySelector('.docs-pagination'))).toBe(true);
    expect(requests).toBe(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`output/live-docs-${width}.png`,fullPage:true});
  });
}

test('Live changelog updates version navigation and omits Unreleased', async({page}) => {
  await page.route(`${raw}CHANGELOG.md`, route=>route.fulfill({contentType:'text/plain',body:`# Changelog

## [Unreleased]
- Not public yet.

## [0.9.0]
- New published notes without a build link.

## [0.1.0-beta]
- Earlier notes.
`}));
  await page.goto('./changelog/');
  await expect(page.locator('.docs-content')).toHaveAttribute('data-refresh','fresh');
  await expect(page.getByRole('navigation',{name:'Versions'}).getByRole('link')).toHaveText(['0.9.0','0.1.0-beta']);
  await expect(page.locator('.docs-content')).not.toContainText('Not public yet');
  await page.getByRole('navigation',{name:'Versions'}).getByRole('link',{name:'0.9.0',exact:true}).click();
  await expect(page).toHaveURL(/#090$/);
  await expect(page.locator('[id="090"]')).toBeInViewport();
  await page.screenshot({path:'output/live-changelog.png',fullPage:true});
});

for (const failure of ['network','404','unsafe','invalid','timeout']) {
  test(`Live ${failure} failure retains the complete bundled page`, async({page}) => {
    let release;
    const gate=new Promise(resolve=>{release=resolve;});
    await page.route(`${raw}docs/getting-started.md`, async route=>{
      await gate;
      if(failure==='network' || failure==='timeout') return route.abort();
      if(failure==='404') return route.fulfill({status:404,body:'Missing'});
      return route.fulfill({body:failure==='unsafe' ? '# Unsafe\n\n[Run](javascript:alert%281%29)' : 'No valid title'});
    });
    if(failure==='timeout') await page.clock.install();
    await page.goto('./docs/getting-started/');
    const content=page.locator('.docs-content');
    const fallback=await content.innerHTML();
    if(failure==='timeout') {
      await page.clock.runFor(5100);
      await expect(content).toHaveAttribute('data-refresh','fallback');
      release();
    } else release();
    await expect(content).toHaveAttribute('data-refresh','fallback');
    expect(await content.innerHTML()).toBe(fallback);
    await expect(content.locator('h1')).toHaveText('Getting started');
    await expect(page.locator('.docs-pagination')).toBeVisible();
  });
}

test('Reading position is preserved when refresh adds content above the current section', async({page})=>{
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const headings=[];
  await page.route(`${raw}docs/getting-started.md`,async route=>{
    await gate;
    await route.fulfill({body:`# Getting started\n\n${'A new paragraph.\n\n'.repeat(35)}\n## ${headings[0]}\n\n${'More content.\n\n'.repeat(35)}`});
  });
  await page.goto('./docs/getting-started/');
  const heading=page.locator('.docs-content h2').first();
  headings.push(await heading.textContent());
  await heading.evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
  const before=(await heading.boundingBox()).y;
  release();
  await expect(page.locator('.docs-content')).toHaveAttribute('data-refresh','fresh');
  expect(Math.abs((await page.locator('.docs-content h2').first().boundingBox()).y-before)).toBeLessThan(2);
});
