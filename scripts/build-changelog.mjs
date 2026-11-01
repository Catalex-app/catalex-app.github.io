import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {renderRepositoryMarkdown, contentMarkup, versionNavigation} from "./repository-markdown.mjs";
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
  const config = {kind:"changelog", ref, file:"CHANGELOG.md", directory:"changelog"};
  const {body, headings} = renderRepositoryMarkdown(markdown, config);
  const navigation = versionNavigation(headings);
  const header = renderSiteHeader({page:"changelog", prefix:"../"});
  const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Changelog — Catalex</title><meta name="description" content="What’s new in Catalex. Version history and release notes."/>
<link rel="icon" href="../assets/favicon.png"/><link rel="stylesheet" href="../styles.css"/><link rel="stylesheet" href="../docs.css"/>
</head><body class="docs-page changelog-page"><a class="skip-link" href="#main">Skip to content</a>${header}
<div class="docs-layout"><aside class="docs-sidebar"><a class="docs-label" href="./">Changelog</a><nav aria-label="Versions">${navigation}</nav></aside>
<main id="main" class="docs-article">${contentMarkup(body, config)}<a class="docs-source" href="${github}CHANGELOG.md">View this page on GitHub ↗</a></main></div>
<script type="module" src="../docs-live.js"></script></body></html>\n`;
  const directory = path.join(output, "changelog");
  await mkdir(directory, {recursive:true});
  await writeFile(path.join(directory, "index.html"), html);
  console.log(`Rendered changelog from ${repository} (${local ? "local preview" : ref})`);
}
