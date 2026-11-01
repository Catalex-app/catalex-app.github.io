import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { escapeHtml } from "./markdown.mjs";
import {renderRepositoryMarkdown, contentMarkup} from "./repository-markdown.mjs";
import { renderSiteHeader } from "./site-header.mjs";

const repository = "Catalex-app/Catalex";
const slug = (file) =>
	file.replace(/(^|\/)README\.md$/, "").replace(/\.md$/, "");

export async function buildDocs(_root, output) {
	const ref = process.env.CATALEX_DOCS_REF || "main";
	const local = process.env.CATALEX_DOCS_DIR;
	const raw = `https://raw.githubusercontent.com/${repository}/${encodeURIComponent(ref)}/`;
	const github = `https://github.com/${repository}/blob/${encodeURIComponent(ref)}/`;
	async function source(file) {
		if (local) return readFile(path.join(local, file), "utf8");
		let response;
		try {
			response = await fetch(`${raw}docs/${file}`, {
				signal: AbortSignal.timeout(20_000),
			});
		} catch (cause) {
			throw new Error(
				`Cannot load Catalex docs at ${ref}: ${file}. Check network access or set CATALEX_DOCS_DIR to a local docs folder for preview.`,
				{ cause },
			);
		}
		if (!response.ok)
			throw new Error(
				`Cannot load Catalex docs at ${ref}: ${file} (HTTP ${response.status}). Publish the source first, or set CATALEX_DOCS_DIR to a local docs folder for preview.`,
			);
		return response.text();
	}
	const manifest = JSON.parse(await source("navigation.json"));
	// Existing tagged guides use a flat list; current guides have audience groups.
	const sections =
		Array.isArray(manifest) &&
		manifest.every((file) => typeof file === "string")
			? [{ title: "User guide", pages: manifest }]
			: manifest;
	if (
		!Array.isArray(sections) ||
		!sections.length ||
		!sections.every(
			(section) =>
				section &&
				typeof section.title === "string" &&
				section.title.trim() &&
				Array.isArray(section.pages) &&
				section.pages.length,
		)
	) {
		throw new Error(
			"Invalid Catalex docs/navigation.json: expected documentation groups.",
		);
	}
	const files = sections.flatMap((section) => section.pages);
	if (
		files[0] !== "README.md" ||
		new Set(files).size !== files.length ||
		!files.every(
			(file) =>
				typeof file === "string" &&
				/^(?:[a-z][a-z0-9-]*\/)*(?:README|[a-z][a-z0-9-]*)\.md$/.test(file),
		) ||
		new Set(files.map(slug)).size !== files.length
	) {
		throw new Error(
			"Invalid Catalex docs/navigation.json: expected unique Markdown paths and routes, starting with README.md.",
		);
	}
	const pages = await Promise.all(
		files.map(async (file) => {
			const markdown = await source(file);
			const sourceTitle = markdown.match(/^# ([^\n]+)$/m)?.[1];
			if (!sourceTitle) throw new Error(`Missing document title: ${file}`);
			// Keep descriptive repository headings; each audience starts with an Overview.
			const isOverview =
				file === "README.md" || file === "development/README.md";
			const title = isOverview ? "Overview" : sourceTitle;
			return {
				file,
				section: sections.find((section) => section.pages.includes(file)),
				markdown: isOverview
					? markdown.replace(/^# [^\n]+$/m, "# Overview")
					: markdown,
				title,
				directory: path.posix.join("docs", slug(file)),
			};
		}),
	);
	for (const page of pages) {
		const prefix = "../".repeat(page.directory.split("/").length);
		const config = {kind:"docs", ref, file:`docs/${page.file}`, directory:page.directory,
      routes:Object.fromEntries(pages.map(entry => [`docs/${entry.file}`, entry.directory]))};
    const {body} = renderRepositoryMarkdown(page.markdown, config);
		const hrefTo = (entry) =>
			`${path.posix.relative(page.directory, entry.directory) || "."}/`;
		const navigation = sections
			.map((section) => {
				const links = pages
					.filter((entry) => entry.section === section)
					.map(
						(entry) =>
							`<a href="${escapeHtml(hrefTo(entry))}"${entry === page ? ' aria-current="page"' : ""}>${escapeHtml(entry.title)}</a>`,
					)
					.join("\n");
				return `<nav class="docs-nav-group" aria-label="${escapeHtml(section.title)}"><p class="docs-nav-title">${escapeHtml(section.title)}</p>${links}</nav>`;
			})
			.join("\n");
		const siblings = pages.filter((entry) => entry.section === page.section);
		const position = siblings.indexOf(page);
		const previous = siblings[position - 1],
			next = siblings[position + 1];
		const footer = [
			previous
				? `<a rel="prev" href="${escapeHtml(hrefTo(previous))}"><span>Previous</span>${escapeHtml(previous.title)}</a>`
				: "<span></span>",
			next
				? `<a rel="next" href="${escapeHtml(hrefTo(next))}"><span>Next</span>${escapeHtml(next.title)}</a>`
				: "",
		].join("\n");
		const header = renderSiteHeader({ page: "docs", prefix });
		const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(page.title)} — Catalex</title><meta name="description" content="${escapeHtml(page.title)}. Catalex documentation."/>
<link rel="icon" href="${prefix}assets/favicon.png"/><link rel="stylesheet" href="${prefix}styles.css"/><link rel="stylesheet" href="${prefix}docs.css"/>
</head><body class="docs-page"><a class="skip-link" href="#main">Skip to content</a>${header}
<div class="docs-layout"><aside class="docs-sidebar"><a class="docs-label" href="${prefix}docs/">Documentation</a>${navigation}<a class="docs-contributing" href="${github}CONTRIBUTING.md">Contributing ↗</a></aside>
<main id="main" class="docs-article">${contentMarkup(body, config)}<nav class="docs-pagination" aria-label="Page navigation">${footer}</nav><a class="docs-source" href="${github}docs/${page.file}">View this page on GitHub ↗</a></main></div>
<script type="module" src="${prefix}docs-live.js"></script></body></html>\n`;
		const directory = path.join(output, page.directory);
		await mkdir(directory, { recursive: true });
		await writeFile(path.join(directory, "index.html"), html);
	}
	console.log(
		`Rendered ${pages.length} documentation pages from ${repository} (${local ? "local preview" : ref})`,
	);
}
