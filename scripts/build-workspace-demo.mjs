// Rebuild the local capture renderer when refreshing screenshots or the demo.
// Normal website builds use checked-in media and do not need the private app repo.
import { createRequire } from "node:module";
import {
	cp,
	mkdir,
	mkdtemp,
	realpath,
	readFile,
	symlink,
	rm,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
const site = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const app = path.resolve(process.argv[2] || "../Catalex");
const desktop = path.join(app, "apps/desktop");
const requireApp = createRequire(path.join(desktop, "package.json"));
const { build } = await import(requireApp.resolve("vite"));
const { default: react } = await import(
	requireApp.resolve("@vitejs/plugin-react")
);
const { default: tailwind } = await import(
	requireApp.resolve("@tailwindcss/postcss")
);
const { default: topLevelAwait } = await import(
	requireApp.resolve("vite-plugin-top-level-await")
);
const version = JSON.parse(
	await readFile(path.join(app, "package.json")),
).version;
const temporary = await realpath(
	await mkdtemp(path.join(os.tmpdir(), "catalex-web-workspace-")),
);
try {
	await cp(path.join(site, "workspace-demo"), temporary, { recursive: true });
	await symlink(
		path.join(app, "node_modules"),
		path.join(temporary, "node_modules"),
	);
	for (const font of [
		"geist-regular.ttf",
		"geist-semibold.ttf",
		"geist-mono-regular.ttf",
	])
		await cp(path.join(site, "assets/fonts", font), path.join(temporary, font));
	await build({
		configFile: false,
		root: temporary,
		base: "./",
		publicDir: false,
		plugins: [
			react(),
			{
				name: "website-fixture-exports",
				transform(code, id) {
					if (id.endsWith("/comment-workspace-demo.tsx"))
						return (
							code
								.replace(
									"Review the existing comments and update them where appropriate. Tell me what you plan to change first.",
									"Help me make the introduction clearer. Leave comments first.",
								)
								.replace(
									"Comments apply directly. Edit or resolve a comment, then use Undo in the source editor to restore it. This project is only a browser demo.",
									"Start with the main finding, then explain why it matters. I’ve left a note at the introduction.",
								)
								.replace(
									'title: "Review manuscript comments"',
									'title: "A clearer introduction"',
								) + "\nexport { initializeDemo as initializeWebsiteFixture };"
						);
					if (id.endsWith("/history-workspace-harness.tsx"))
						return code.replaceAll("/tmp/catalex-history-workspace-harness", "/browser-demo/Learning with structure");
					if (id.endsWith("/git-three-way-demo.tsx"))
						return code + "\nexport { initialize as initializeWebsiteGit };";
					if (id.endsWith("/agent-file-review-demo.tsx"))
						return code + "\nexport { initialize as initializeWebsiteReview };";
					// These app assets are absolute in Electron; the website also supports a subpath.
					if (id.includes("/src/renderer/"))
						return code
							.replaceAll('"/cat-leaf.svg"', '"./cat-leaf.svg"')
							.replaceAll('"/favicon.png"', '"./favicon.png"');
				},
			},
			{
				name: "website-dependency-notices",
				async generateBundle() {
					const roots = new Set([path.dirname(path.dirname(requireApp.resolve("mupdf")))]);
					for (const id of this.getModuleIds()) {
						const marker = id.lastIndexOf("/node_modules/");
						if (marker < 0) continue;
						const parts = id.slice(marker + 14).split("/");
						roots.add(
							id.slice(0, marker + 14) +
								parts.slice(0, parts[0].startsWith("@") ? 2 : 1).join("/"),
						);
					}
					const notices = [];
					for (const root of [...roots].sort()) {
						try {
							const pkg = JSON.parse(
								await readFile(path.join(root, "package.json"), "utf8"),
							);
							let licenseText = "";
							for (const file of [
								"LICENSE",
								"LICENSE.md",
								"LICENSE.txt",
								"license",
								"license.md",
								"LICENSE-MIT",
								"COPYING",
							]) {
								try {
									licenseText = await readFile(path.join(root, file), "utf8");
									break;
								} catch {}
							}
							notices.push(
								`${pkg.name} ${pkg.version} — ${typeof pkg.license === "string" ? pkg.license : JSON.stringify(pkg.license || pkg.licenses || "See package source")}\n${licenseText}`,
							);
						} catch {}
					}
					this.emitFile({
						type: "asset",
						fileName: "third-party-notices.txt",
						source: notices.join("\n\n" + "=".repeat(72) + "\n\n"),
					});
				},
			},
		],
		resolve: {
			alias: { "@": path.join(desktop, "src/renderer") },
			dedupe: ["react", "react-dom"],
		},
		css: {
			postcss: {
				plugins: [tailwind({ base: path.join(desktop, "src/renderer") })],
			},
		},
		worker: { plugins: () => [topLevelAwait()], format: "es" },
		define: { __APP_VERSION__: JSON.stringify(version) },
		esbuild: { supported: { "top-level-await": true } },
		build: {
			outDir: path.join(site, "assets/workspace"),
			emptyOutDir: true,
			target: "es2022",
			sourcemap: false,
		},
	});
	for (const asset of ["cat-leaf.svg", "favicon.png"])
		await cp(
			path.join(site, "assets", asset),
			path.join(site, "assets/workspace", asset),
		);
	await cp(
		path.join(site, "workspace-demo/paper.json"),
		path.join(site, "assets/workspace/paper.json"),
	);
	await writeFile(
		path.join(site, "assets/workspace/provenance.json"),
		JSON.stringify(
			{
				appVersion: version,
				source: "Catalex renderer; browser-only fixture adapter",
				generated: new Date().toISOString(),
			},
			null,
			2,
		),
	);
} finally {
	await rm(temporary, { recursive: true, force: true });
}
