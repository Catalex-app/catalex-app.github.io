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
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
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
		const relative = pathname.slice(base.length) || "index.html";
		// Only public site files are served, even in development.
		if (
			!["index.html", "styles.css", "app.js"].includes(relative) &&
			!relative.startsWith("assets/")
		) {
			response.writeHead(404);
			response.end("Not found");
			return;
		}
		const resolved = path.resolve(root, relative);
		if (!resolved.startsWith(`${root}${path.sep}`)) {
			response.writeHead(404);
			response.end("Not found");
			return;
		}
		const data = await readFile(resolved);
		response.writeHead(200, {
			"Content-Type":
				types[path.extname(resolved)] || "application/octet-stream",
			"Cache-Control": "no-cache",
			"X-Content-Type-Options": "nosniff",
		});
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
