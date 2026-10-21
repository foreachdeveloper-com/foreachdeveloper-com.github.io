// Local dev server with live reload: `bun run dev`
// CSS changes are swapped in place; anything else reloads the page.
import { readdirSync, statSync } from "node:fs";
import { join, normalize, relative } from "node:path";

const root = import.meta.dir;
const port = Number(process.env.PORT ?? 3000);
const ignored = /(^|\/)(\.git|\.playwright-mcp|node_modules)(\/|$)|^dev\.ts$|^package\.json$|~$|\.sw[px]$|(^|\/)4913$/;

const clients = new Set<ReadableStreamDefaultController>();
const encoder = new TextEncoder();

const client = `<script>
(() => {
	const es = new EventSource("/__live");
	es.onmessage = (e) => {
		if (e.data.endsWith(".css")) {
			for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
				const url = new URL(link.href);
				if (url.origin !== location.origin) continue;
				url.searchParams.set("t", Date.now());
				link.href = url;
			}
		} else {
			location.reload();
		}
	};
})();
</script>`;

// Poll mtimes instead of fs.watch: editors save by renaming a temp file over
// the original, which drops inotify watches on the old inode.
function snapshot(dir = root, out = new Map<string, number>()) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		const rel = relative(root, path);
		if (ignored.test(rel)) continue;
		if (entry.isDirectory()) snapshot(path, out);
		else if (entry.isFile()) out.set(rel, statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? 0);
	}
	return out;
}

let seen = snapshot();
setInterval(() => {
	const now = snapshot();
	const files = [...now].filter(([f, t]) => seen.get(f) !== t).map(([f]) => f);
	for (const f of seen.keys()) if (!now.has(f)) files.push(f);
	seen = now;
	if (!files.length) return;
	const msg = files.every((f) => f.endsWith(".css")) ? files[0] : "reload";
	console.log(`changed: ${files.join(", ")}`);
	for (const c of clients) c.enqueue(encoder.encode(`data: ${msg}\n\n`));
}, 250);

Bun.serve({
	port,
	idleTimeout: 0,
	async fetch(req) {
		const { pathname } = new URL(req.url);

		if (pathname === "/__live") {
			let self: ReadableStreamDefaultController;
			const stream = new ReadableStream({
				start(c) {
					self = c;
					clients.add(c);
					c.enqueue(encoder.encode(": connected\n\n"));
				},
				cancel() {
					clients.delete(self);
				},
			});
			return new Response(stream, {
				headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
			});
		}

		let path = normalize(join(root, decodeURIComponent(pathname)));
		if (relative(root, path).startsWith("..")) return new Response("Forbidden", { status: 403 });
		if (pathname.endsWith("/")) path = join(path, "index.html");

		const file = Bun.file(path);
		if (!(await file.exists())) return new Response("Not found", { status: 404 });

		const headers = { "Cache-Control": "no-store" };
		if (path.endsWith(".html")) {
			const html = (await file.text()).replace("</body>", `${client}</body>`);
			return new Response(html, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
		}
		return new Response(file, { headers });
	},
});

console.log(`forEach developer → http://localhost:${port}`);
