import { renderPageHeader } from "./site-header.mjs";
import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const project = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const root = process.argv.includes("--dist")
	? path.join(project, "dist")
	: project;
const port = Number(process.env.PORT || 4321);
const base = process.env.BASE_PATH || "/";
if (!base.startsWith("/") || !base.endsWith("/"))
	throw new Error("BASE_PATH must start and end with /");
const types = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".mp4": "video/mp4",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".txt": "text/plain; charset=utf-8",
	".wasm": "application/wasm",
	".json": "application/json",
};
const server = http.createServer(async (request, response) => {
	try {
		const pathname = decodeURIComponent(
			new URL(request.url, "http://localhost").pathname,
		);
		if (!["GET", "HEAD"].includes(request.method)) {
			response.writeHead(405);
			response.end();
			return;
		}
		if (!pathname.startsWith(base)) {
			response.writeHead(404);
			response.end("Not found");
			return;
		}
		const route = pathname.slice(base.length);
		if (route === "download" || route === "changelog" || /^docs(?:\/[a-z][a-z0-9-]*)*$/.test(route)) {
            response.writeHead(301, { Location: `${pathname}/` });
            response.end();
            return;
        }
        const relative = (pathname.endsWith("/") ? `${pathname}index.html` : pathname).slice(base.length);
		// Only public site files are served, even in development.
		if (
			!["index.html", "download/index.html", "changelog/index.html", "styles.css", "app.js", "typewriter.js", "navigation.js", "docs-live.js", "docs.css"].includes(relative) &&
			!relative.startsWith("assets/") &&
            !/^docs\/(?:[a-z][a-z0-9-]*\/)*index\.html$/.test(relative)
		) {
			response.writeHead(404);
			response.end("Not found");
			return;
		}
		const publicRoot = relative.startsWith("assets/content/") || relative.startsWith("docs/") || relative === "changelog/index.html" ? path.join(project, "dist") : root;
		const resolved = path.resolve(publicRoot, relative);
		if (!resolved.startsWith(`${root}${path.sep}`)) {
			response.writeHead(404);
			response.end("Not found");
			return;
		}
		let data = await readFile(resolved);
        if (["index.html", "download/index.html"].includes(relative)) {
            data = Buffer.from(renderPageHeader(data.toString(), relative === "index.html" ? "home" : "download"));
        }
		const headers = {
			"Content-Type": types[path.extname(resolved)] || "application/octet-stream",
			"Content-Length": data.length,
			"Cache-Control": "no-cache",
			"X-Content-Type-Options": "nosniff",
			"Accept-Ranges": "bytes",
		};
		// WebKit probes MP4s with bytes=0-1 and requires a real partial response.
		if (request.headers.range) {
			const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
			const first = match?.[1] ? Number(match[1]) : null;
			const last = match?.[2] ? Number(match[2]) : null;
			const start = first ?? Math.max(0, data.length - (last ?? 0));
			const end = first === null ? data.length - 1 : Math.min(last ?? data.length - 1, data.length - 1);
			if (!match || (first === null && !(last > 0)) ||
				!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
				start < 0 || start >= data.length || end < start) {
				response.writeHead(416, {...headers, "Content-Length": 0, "Content-Range": `bytes */${data.length}`});
				response.end();
				return;
			}
			response.writeHead(206, {...headers, "Content-Length": end - start + 1, "Content-Range": `bytes ${start}-${end}/${data.length}`});
			response.end(request.method === "HEAD" ? undefined : data.subarray(start, end + 1));
			return;
		}
		response.writeHead(200, headers);
		response.end(request.method === "HEAD" ? undefined : data);
	} catch {
		response.writeHead(404);
		response.end("Not found");
	}
});
server.listen(port, "127.0.0.1", () =>
	console.log(`Catalex site: http://127.0.0.1:${port}${base}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
	process.on(signal, () => server.close(() => process.exit(0)));
