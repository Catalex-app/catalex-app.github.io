import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildDocs } from "./build-docs.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
test("GitHub source renders guides and rewrites links for a pinned revision", async (t) => {
	const output = await mkdtemp(path.join(tmpdir(), "catalex-docs-"));
	const before = {
		ref: process.env.CATALEX_DOCS_REF,
		local: process.env.CATALEX_DOCS_DIR,
	};
	t.after(async () => {
		for (const [key, value] of [
			["CATALEX_DOCS_REF", before.ref],
			["CATALEX_DOCS_DIR", before.local],
		]) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		await rm(output, { recursive: true, force: true });
	});
	delete process.env.CATALEX_DOCS_DIR;
	process.env.CATALEX_DOCS_REF = "v0.1.0";
	const requested = [];
	const sources = {
		"navigation.json": JSON.stringify(["README.md", "writing.md"]),
		"README.md":
			"# Documentation\n\n[Write](writing.md#compile) and [contribute](../CONTRIBUTING.md).\n",
		"writing.md":
			"# Writing\n\n## Compile\n\n[Home](README.md).\n\n```sh\nlatexmk main.tex\n```\n",
	};
	t.mock.method(globalThis, "fetch", async (url) => {
		requested.push(url);
		const filename = String(url).split("/").at(-1);
		return new Response(sources[filename], {
			status: filename in sources ? 200 : 404,
		});
	});
	await buildDocs(root, output);
	const home = await readFile(path.join(output, "docs/index.html"), "utf8");
	const writing = await readFile(
		path.join(output, "docs/writing/index.html"),
		"utf8",
	);
	assert.match(home, /<title>Overview — Catalex<\/title>/);
	assert.match(home, /<h1 id="overview">Overview<\/h1>/);
	assert.match(home, /aria-current="page">Overview<\/a>/);
	assert.match(home, /href="writing\/#compile"/);
	assert.match(
		home,
		/href="https:\/\/github.com\/Catalex-app\/Catalex\/blob\/v0.1.0\/CONTRIBUTING.md"/,
	);
	assert.match(writing, /<h2 id="compile">Compile<\/h2>/);
	assert.match(writing, /href="\.\.\/">Home<\/a>/);
	assert.match(writing, /<code class="language-sh">latexmk main.tex/);
	assert.equal(requested.length, 3);
	assert.ok(
		requested.every((url) =>
			url.startsWith(
				"https://raw.githubusercontent.com/Catalex-app/Catalex/v0.1.0/docs/",
			),
		),
	);
	// No requests are needed by a reader: all content has been rendered into the HTML.
	assert.doesNotMatch(writing, /<script|CATALEX_DOCS_DIR/);
	t.mock.method(
		globalThis,
		"fetch",
		async () => new Response("Missing", { status: 404 }),
	);
	await assert.rejects(
		buildDocs(root, output),
		/Cannot load Catalex docs.*HTTP 404/,
	);
});

test("developer guides retain nested routes, relative links, and separate navigation", async (t) => {
	const output = await mkdtemp(path.join(tmpdir(), "catalex-developer-docs-"));
	const before = {
		ref: process.env.CATALEX_DOCS_REF,
		local: process.env.CATALEX_DOCS_DIR,
	};
	t.after(async () => {
		for (const [key, value] of [
			["CATALEX_DOCS_REF", before.ref],
			["CATALEX_DOCS_DIR", before.local],
		]) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		await rm(output, { recursive: true, force: true });
	});
	delete process.env.CATALEX_DOCS_DIR;
	process.env.CATALEX_DOCS_REF = "main";
	const sections = [
		{ title: "User guide", pages: ["README.md", "writing.md"] },
		{
			title: "Development",
			pages: [
				"development/README.md",
				"development/setup.md",
				"testing/README.md",
			],
		},
	];
	const sources = {
		"navigation.json": JSON.stringify(sections),
		"README.md": "# Documentation\n\n[Development](development/README.md).\n",
		"writing.md": "# Writing\n\n## Compile\n",
		"development/README.md":
			"# Developer documentation\n\n[Setup](setup.md).\n",
		"development/setup.md":
			"# Setup\n\n[Writing](../writing.md#compile), [testing](../testing/README.md), [architecture](architecture.md), and [contributing](../../CONTRIBUTING.md).\n",
		"testing/README.md": "# Testing\n\n[Setup](../development/setup.md).\n",
	};
	t.mock.method(globalThis, "fetch", async (url) => {
		const file = String(url).split("/main/docs/")[1];
		return new Response(sources[file], { status: file in sources ? 200 : 404 });
	});
	await buildDocs(root, output);
	const home = await readFile(path.join(output, "docs/index.html"), "utf8");
	const setup = await readFile(
		path.join(output, "docs/development/setup/index.html"),
		"utf8",
	);
	const development = await readFile(
		path.join(output, "docs/development/index.html"),
		"utf8",
	);
	const testing = await readFile(
		path.join(output, "docs/testing/index.html"),
		"utf8",
	);
	assert.match(development, /<h1 id="overview">Overview<\/h1>/);
	assert.match(development, /aria-current="page">Overview<\/a>/);
	assert.match(testing, /<h1 id="testing">Testing<\/h1>/);
	const writing = await readFile(
		path.join(output, "docs/writing/index.html"),
		"utf8",
	);
	assert.match(home, /href="development\/">Development<\/a>/);
	assert.match(home, /aria-label="User guide"/);
	assert.match(home, /aria-label="Development"/);
	assert.match(setup, /href="\.\.\/\.\.\/\.\.\/styles.css"/);
	assert.match(setup, /href="\.\.\/\.\.\/writing\/#compile"/);
	assert.match(setup, /href="\.\.\/\.\.\/testing\/"/);
	assert.match(
		setup,
		/href="https:\/\/github.com\/Catalex-app\/Catalex\/blob\/main\/docs\/development\/architecture.md"/,
	);
	assert.match(
		setup,
		/href="https:\/\/github.com\/Catalex-app\/Catalex\/blob\/main\/CONTRIBUTING.md"/,
	);
	assert.match(
		setup,
		/href="https:\/\/github.com\/Catalex-app\/Catalex\/blob\/main\/docs\/development\/setup.md"/,
	);
	assert.match(setup, /rel="prev"/);
	assert.doesNotMatch(writing, /rel="next"/);
	for (const invalid of [
		[{ title: "User guide", pages: ["README.md", "../secret.md"] }],
		[
			{
				title: "User guide",
				pages: ["README.md", "development.md", "development/README.md"],
			},
		],
		[
			{ title: "User guide", pages: ["README.md"] },
			{ title: "Development", pages: ["README.md"] },
		],
	]) {
		sources["navigation.json"] = JSON.stringify(invalid);
		await assert.rejects(
			buildDocs(root, output),
			/Invalid Catalex docs\/navigation.json/,
		);
	}
});
