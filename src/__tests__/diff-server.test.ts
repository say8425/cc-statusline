import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { startDiffServer } from "../diff-server/server.ts";

let repo: string;
let viewerDir: string;
let cacheHome: string;
let handle: ReturnType<typeof startDiffServer>;
let base: string;

beforeEach(async () => {
	repo = mkdtempSync(join(tmpdir(), "cc-srv-repo-"));
	await $`git -C ${repo} init -q`;
	await $`git -C ${repo} config user.email t@t.co`;
	await $`git -C ${repo} config user.name test`;
	writeFileSync(join(repo, "a.txt"), "one\n");
	await $`git -C ${repo} add a.txt`;
	await $`git -C ${repo} commit -qm init`;
	writeFileSync(join(repo, "a.txt"), "two\n");

	viewerDir = mkdtempSync(join(tmpdir(), "cc-srv-view-"));
	writeFileSync(join(viewerDir, "index.html"), "<html>viewer</html>");

	cacheHome = mkdtempSync(join(tmpdir(), "cc-srv-cache-"));
	handle = startDiffServer({
		port: 0,
		viewerDir,
		env: { XDG_CACHE_HOME: cacheHome },
		idleTimeoutMs: 0,
	});
	base = `http://127.0.0.1:${handle.server.port}`;
});

afterEach(() => {
	handle.stop();
	for (const d of [repo, viewerDir, cacheHome])
		rmSync(d, { recursive: true, force: true });
});

describe("diff server", () => {
	test("ping returns 204 with marker header", async () => {
		const res = await fetch(`${base}/api/ping`);
		expect(res.status).toBe(204);
		expect(res.headers.get("x-cc-statusline")).toBe("1");
	});

	test("serves index.html at / with no-store so the viewer is never stale", async () => {
		const res = await fetch(`${base}/`);
		expect(res.status).toBe(200);
		expect(res.headers.get("cache-control")).toBe("no-store");
		expect(await res.text()).toContain("viewer");
	});

	test("api/diff rejects a bad token with 403", async () => {
		const res = await fetch(
			`${base}/api/diff?repo=${encodeURIComponent(repo)}&token=wrong`,
		);
		expect(res.status).toBe(403);
	});

	test("api/diff returns the diff with the correct token and no CORS header", async () => {
		const url = `${base}/api/diff?repo=${encodeURIComponent(repo)}&token=${handle.token}`;
		const res = await fetch(url);
		expect(res.status).toBe(200);
		expect(res.headers.get("access-control-allow-origin")).toBeNull();
		expect(res.headers.get("content-type")).toContain("application/json");
		const files = (await res.json()) as Array<{
			name: string;
			status: string;
			newContents: string;
		}>;
		const file = files.find((f) => f.name === "a.txt");
		expect(file?.status).toBe("modified");
		expect(file?.newContents).toContain("two");
	});

	test("api/diff rejects a non-repo path with 400", async () => {
		const plain = mkdtempSync(join(tmpdir(), "cc-srv-plain-"));
		const url = `${base}/api/diff?repo=${encodeURIComponent(plain)}&token=${handle.token}`;
		const res = await fetch(url);
		expect(res.status).toBe(400);
		rmSync(plain, { recursive: true, force: true });
	});

	test("blocks path traversal on static files", async () => {
		const res = await fetch(`${base}/../../etc/passwd`);
		expect([403, 404]).toContain(res.status);
	});

	test("blocks an un-normalized absolute path with a real 403 over the wire", async () => {
		// fetch() normalizes "/../../etc/passwd" client-side before it ever hits
		// the server, so the request above never reaches the 403 branch in
		// createHandler (it 404s on a literal "../../etc/passwd" file instead).
		// A raw socket lets us send a path Bun's URL parser won't collapse:
		// a double leading slash. `url.pathname` keeps it as "//etc/passwd", so
		// `rel` becomes the absolute path "/etc/passwd", and
		// `path.resolve(viewerRoot, "/etc/passwd")` escapes viewerRoot entirely,
		// exercising the real traversal guard.
		const response = await new Promise<string>(
			(resolvePromise, rejectPromise) => {
				let buffer = "";
				Bun.connect({
					hostname: "127.0.0.1",
					port: handle.server.port,
					socket: {
						open(socket) {
							socket.write(
								"GET //etc/passwd HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n",
							);
						},
						data(_socket, data) {
							buffer += data.toString();
						},
						close() {
							resolvePromise(buffer);
						},
						error(_socket, error) {
							rejectPromise(error);
						},
						connectError(_socket, error) {
							rejectPromise(error);
						},
					},
				}).catch(rejectPromise);
			},
		);

		const statusLine = response.split("\r\n")[0] ?? "";
		expect(statusLine).toContain("403");
	});
});

describe("diff server base mode", () => {
	test("mode=base diffs against the base branch and sets X-Diff-Base", async () => {
		await $`git -C ${repo} branch -M main`;
		await $`git -C ${repo} checkout -qb feature`;
		writeFileSync(join(repo, "c.txt"), "committed on branch\n");
		await $`git -C ${repo} add c.txt`;
		await $`git -C ${repo} commit -qm branch-commit`;

		const url = `${base}/api/diff?repo=${encodeURIComponent(repo)}&token=${handle.token}&mode=base`;
		const res = await fetch(url);
		expect(res.status).toBe(200);
		expect(res.headers.get("x-diff-base")).toBe("main");
		const files = (await res.json()) as Array<{ name: string; status: string }>;
		expect(files.some((f) => f.name === "c.txt" && f.status === "added")).toBe(
			true,
		);
	});

	test("working mode still sets X-Diff-Base for the dropdown label", async () => {
		await $`git -C ${repo} branch -M main`;
		const url = `${base}/api/diff?repo=${encodeURIComponent(repo)}&token=${handle.token}`;
		const res = await fetch(url);
		expect(res.status).toBe(200);
		expect(res.headers.get("x-diff-base")).toBe("main");
	});
});
