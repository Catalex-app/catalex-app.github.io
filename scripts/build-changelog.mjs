import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {escapeHtml, renderMarkdown} from "./markdown.mjs";
import {renderSiteHeader} from "./site-header.mjs";

export async function buildChangelog(_root, output) {
  const ref = process.env.CATALEX_DOCS_REF || "main";
  const repository = "Catalex-app/Catalex";
  const raw = `https://raw.githubusercontent.com/${repository}/${encodeURIComponent(ref)}/`;
  const github = `https://github.com/${repository}/blob/${encodeURIComponent(ref)}/`;
  const local = process.env.CATALEX_CHANGELOG_FILE || (process.env.CATALEX_DOCS_DIR
    ? path.resolve(process.env.CATALEX_DOCS_DIR, "../CHANGELOG.md") : null);
  let markdown;
  if (local) markdown = await readFile(local, "utf8");
  else {
    let response;
    try { response = await fetch(`${raw}CHANGELOG.md`, {signal:AbortSignal.timeout(20_000)}); }
    catch (cause) { throw new Error(`Cannot load Catalex CHANGELOG.md at ${ref}. Check network access or set CATALEX_CHANGELOG_FILE for local preview.`, {cause}); }
    if (!response.ok) throw new Error(`Cannot load Catalex CHANGELOG.md at ${ref} (HTTP ${response.status}). Publish the source first, or set CATALEX_CHANGELOG_FILE for local preview.`);
    markdown = await response.text();
  }
  if (!/^# .+/m.test(markdown)) throw new Error("Missing title in Catalex CHANGELOG.md");
  const {body, headings} = renderMarkdown(markdown, (href, image) => {
    if (href.startsWith("#") || /^[a-z][a-z\d+.-]*:|^\/\//i.test(href)) return href;
    return new URL(href, image ? raw : github).href;
  }, heading => {
    const label = heading.tokens.length === 1 ? heading.tokens[0].text : heading.text;
    return heading.depth === 2 && /^\[?unreleased\]?$/i.test(label.trim());
  });
  const versions = headings.filter(heading => heading.depth === 2);
  const navigation = versions.map(({id, text}) =>
    `<a href="#${escapeHtml(id)}">${escapeHtml(text.replace(/^\[([^\]]+)\]/, "$1"))}</a>`).join("\n");
  const header = renderSiteHeader({page:"changelog", prefix:"../"});
  const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Changelog — Catalex</title><meta name="description" content="What’s new in Catalex. Version history and release notes."/>
<link rel="icon" href="../assets/favicon.png"/><link rel="stylesheet" href="../styles.css"/><link rel="stylesheet" href="../docs.css"/>
</head><body class="docs-page changelog-page"><a class="skip-link" href="#main">Skip to content</a>${header}
<div class="docs-layout"><aside class="docs-sidebar"><a class="docs-label" href="./">Changelog</a><nav aria-label="Versions">${navigation}</nav></aside>
<main id="main" class="docs-article">${body}<a class="docs-source" href="${github}CHANGELOG.md">View this page on GitHub ↗</a></main></div>
</body></html>\n`;
  const directory = path.join(output, "changelog");
  await mkdir(directory, {recursive:true});
  await writeFile(path.join(directory, "index.html"), html);
  console.log(`Rendered changelog from ${repository} (${local ? "local preview" : ref})`);
}
