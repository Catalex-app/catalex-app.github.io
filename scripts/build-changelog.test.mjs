import assert from "node:assert/strict";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {test} from "node:test";
import {buildChangelog} from "./build-changelog.mjs";

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "catalex-changelog-"));
  const keys = ["CATALEX_DOCS_REF", "CATALEX_DOCS_DIR", "CATALEX_CHANGELOG_FILE"];
  const saved = keys.map(key => process.env[key]);
  for (const key of keys) delete process.env[key];
  t.after(async () => {
    keys.forEach((key, i) => saved[i] === undefined ? delete process.env[key] : process.env[key] = saved[i]);
    await rm(directory, {recursive:true, force:true});
  });
  return {directory, output:path.join(directory, "output")};
}

test("changelog uses the pinned GitHub Markdown with full version history and shared rendering", async t => {
  const {output} = await fixture(t);
  process.env.CATALEX_DOCS_REF = "v0.2.0";
  const requests = [];
  t.mock.method(globalThis, "fetch", async url => {
    requests.push(url);
    return new Response(`# Changelog

## [Unreleased]
- In progress.
## [0.2.0]
### Changed
- A version without a successful build remains visible.
## [0.1.0]
### Changed
- Earlier changes with [setup](docs/getting-started.md#install).

![Example](assets/example.png)

<script>alert(1)</script>

\`\`\`sh
echo hello
\`\`\`
`);
  });
  await buildChangelog(null, output);
  const html = await readFile(path.join(output, "changelog/index.html"), "utf8");
  assert.deepEqual(requests, ["https://raw.githubusercontent.com/Catalex-app/Catalex/v0.2.0/CHANGELOG.md"]);
  assert.match(html, /class="header-changelog" href="\.\.\/changelog\/" aria-current="page"/);
  assert.match(html, /href="#020">0.2.0/);
  assert.match(html, /href="#010">0.1.0/);
  assert.doesNotMatch(html, /Unreleased|In progress|#unreleased/i);
  assert.match(html, /without a successful build remains visible/);
  assert.match(html, /id="changed-1"/);
  assert.match(html, /href="https:\/\/github.com\/Catalex-app\/Catalex\/blob\/v0.2.0\/docs\/getting-started.md#install"/);
  assert.match(html, /src="https:\/\/raw.githubusercontent.com\/Catalex-app\/Catalex\/v0.2.0\/assets\/example.png"/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<code class="language-sh">echo hello/);
  assert.doesNotMatch(html, /<script/);
});

test("unreleased filtering respects Markdown sections, code fences and reference links", async t => {
  const {output} = await fixture(t);
  t.mock.method(globalThis, "fetch", async () => new Response(`# Changelog

## [Unreleased][pending]
### Added
- Draft-only note.
\`\`\`md
## [9.9.9]
Still draft content.
\`\`\`

## [0.1.0-beta]
- Read the [guide][guide].
\`\`\`md
## [Unreleased]
An example inside a released entry.
\`\`\`

[pending]: https://example.com/compare
[guide]: docs/README.md
`));
  await buildChangelog(null, output);
  const html = await readFile(path.join(output, "changelog/index.html"), "utf8");
  assert.doesNotMatch(html, /Draft-only|Still draft|9\.9\.9|href="#unreleased"/);
  assert.match(html, /href="#010-beta"/);
  assert.match(html, /An example inside a released entry/);
  assert.match(html, /href="https:\/\/github.com\/Catalex-app\/Catalex\/blob\/main\/docs\/README.md"/);
});

test("local preview reads the project changelog alongside its docs without networking", async t => {
  const {directory, output} = await fixture(t);
  await writeFile(path.join(directory, "CHANGELOG.md"), "# Changelog\n\n## [1.0.0]\n\nLocal source.\n");
  process.env.CATALEX_DOCS_DIR = path.join(directory, "docs");
  t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected network request"); });
  await buildChangelog(null, output);
  assert.match(await readFile(path.join(output, "changelog/index.html"), "utf8"), /Local source/);
});

test("missing sources and unsafe Markdown fail the build instead of publishing a misleading page", async t => {
  const {output} = await fixture(t);
  t.mock.method(globalThis, "fetch", async () => new Response("Missing", {status:404}));
  await assert.rejects(buildChangelog(null, output), /CHANGELOG.md.*HTTP 404/);
  t.mock.method(globalThis, "fetch", async () => new Response("# Changelog\n\n[Bad](javascript:alert%281%29)"));
  await assert.rejects(buildChangelog(null, output), /Unsupported Markdown link/);
});
