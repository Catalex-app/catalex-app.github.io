import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const html = await readFile(path.join(root, "index.html"), "utf8");
const css = await readFile(path.join(root, "styles.css"), "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
if (new Set(ids).size !== ids.length) throw new Error("Duplicate HTML IDs");
for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) {
	if (!ids.includes(anchor)) throw new Error(`Missing section: #${anchor}`);
}
const refs = [
	...[...html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map(
		(match) => match[1],
	),
	...[...css.matchAll(/url\(['"]?(\.\/[^)'" ]+)['"]?\)/g)].map(
		(match) => match[1],
	),
	"./assets/workspace-classic.jpg",
];
for (const ref of refs) await readFile(path.join(root, ref));
const output = path.join(root, "dist");
await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const file of ["index.html", "styles.css", "app.js", "assets"]) {
	await cp(path.join(root, file), path.join(output, file), { recursive: true, filter: (source) => source !== path.join(root, "assets/workspace") });
}
await writeFile(path.join(output, ".nojekyll"), "");
console.log(
	`Built dist/ · ${new Set(refs).size} local references checked · internal anchors valid`,
);
