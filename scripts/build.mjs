import { renderPageHeader } from "./site-header.mjs";
import { buildDocs } from "./build-docs.mjs";
import { buildChangelog } from "./build-changelog.mjs";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const refs = new Set();
const renderedPages = new Map();
for (const page of ["index.html", "download/index.html"]) {
  const html = renderPageHeader(await readFile(path.join(root, page), "utf8"), page === "index.html" ? "home" : "download");
  renderedPages.set(page, html);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate HTML IDs: ${page}`);
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) {
    if (!ids.includes(anchor)) throw new Error(`Missing section: ${page}#${anchor}`);
  }
  for (const [, ref] of html.matchAll(/(?:src|href)="(\.\.?\/[^"#]*)"/g)) {
    refs.add(path.resolve(root, path.dirname(page), ref.split("?")[0]));
  }
}
const css = await readFile(path.join(root, "styles.css"), "utf8");
for (const [, ref] of css.matchAll(/url\(['"]?(\.\/[^)'" ]+)['"]?\)/g)) refs.add(path.resolve(root, ref));
refs.add(path.join(root, "assets/workspace-classic.jpg"));
for (const ref of refs) {
  if (["docs", "changelog"].some(route => ref === path.join(root, route))) continue; // Generated from canonical Markdown below.
  const info = await stat(ref);
  await readFile(info.isDirectory() ? path.join(ref, "index.html") : ref);
}
const output = path.join(root, "dist");
await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const file of ["index.html", "download", "styles.css", "app.js", "typewriter.js", "navigation.js", "docs-live.js", "assets", "docs.css"]) {
	await cp(path.join(root, file), path.join(output, file), { recursive: true, filter: (source) => source !== path.join(root, "assets/workspace") });
}
for (const [page, html] of renderedPages) await writeFile(path.join(output, page), html);
// Ship the same renderer locally; visitors do not depend on a JavaScript CDN.
const runtime = path.join(output, "assets/content");
await mkdir(runtime, {recursive:true});
await cp(path.join(root, "node_modules/marked/lib/marked.esm.js"), path.join(runtime, "marked.js"));
await cp(path.join(root, "node_modules/marked/LICENSE"), path.join(runtime, "LICENSE.md"));
const markdownModule = await readFile(path.join(root, "scripts/markdown.mjs"), "utf8");
await writeFile(path.join(runtime, "markdown.mjs"), markdownModule.replace('from "marked"', 'from "./marked.js"'));
await cp(path.join(root, "scripts/repository-markdown.mjs"), path.join(runtime, "repository-markdown.mjs"));
await buildDocs(root, output);
await buildChangelog(root, output);
await writeFile(path.join(output, ".nojekyll"), "");
console.log(
	`Built dist/ · ${refs.size} local references checked · internal anchors valid`,
);
