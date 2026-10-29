import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const refs = new Set();
for (const page of ["index.html", "download/index.html"]) {
  const html = await readFile(path.join(root, page), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate HTML IDs: ${page}`);
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) {
    if (!ids.includes(anchor)) throw new Error(`Missing section: ${page}#${anchor}`);
  }
  for (const [, ref] of html.matchAll(/(?:src|href)="(\.\.?\/[^"#]*)"/g)) {
    refs.add(path.resolve(root, path.dirname(page), ref));
  }
}
const css = await readFile(path.join(root, "styles.css"), "utf8");
for (const [, ref] of css.matchAll(/url\(['"]?(\.\/[^)'" ]+)['"]?\)/g)) refs.add(path.resolve(root, ref));
refs.add(path.join(root, "assets/workspace-classic.jpg"));
refs.add(path.join(root, "assets/typewriter-intro.svg"));
refs.add(path.join(root, "assets/typewriter-head.svg"));
refs.add(path.join(root, "assets/typewriter-paper.svg"));
for (const ref of refs) {
  const info = await stat(ref);
  await readFile(info.isDirectory() ? path.join(ref, "index.html") : ref);
}
const output = path.join(root, "dist");
await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const file of ["index.html", "download", "styles.css", "app.js", "typewriter.js", "assets"]) {
	await cp(path.join(root, file), path.join(output, file), { recursive: true, filter: (source) => source !== path.join(root, "assets/workspace") });
}
await writeFile(path.join(output, ".nojekyll"), "");
console.log(
	`Built dist/ · ${refs.size} local references checked · internal anchors valid`,
);
