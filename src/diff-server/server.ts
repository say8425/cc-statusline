import { resolve } from "node:path";
import type { Server } from "bun";
import {
	getDiffFiles,
	getFileBytes,
	isGitRepo,
	resolveBaseRef,
} from "./diff.ts";
import { imageContentType, isImagePath } from "./imageTypes.ts";
import { ensureToken } from "./token.ts";

type Env = Record<string, string | undefined>;

export interface DiffServerHandle {
	server: Server<undefined>;
	token: string;
	stop(): void;
}

// Base resolution runs `gh pr view`, which is slow — cache it per repo.
const BASE_TTL_MS = 10_000;
const baseCache = new Map<
	string,
	{ value: { base: string | null; ref: string | null }; at: number }
>();

const resolveBaseCached = async (
	repo: string,
): Promise<{ base: string | null; ref: string | null }> => {
	const now = Date.now();
	const hit = baseCache.get(repo);
	if (hit && now - hit.at < BASE_TTL_MS) return hit.value;
	const value = await resolveBaseRef(repo);
	baseCache.set(repo, { value, at: now });
	return value;
};

const createHandler = (cfg: { viewerDir: string; token: string }) => {
	const viewerRoot = resolve(cfg.viewerDir);
	return async (req: Request): Promise<Response> => {
		const url = new URL(req.url);

		if (url.pathname === "/api/ping") {
			return new Response(null, {
				status: 204,
				headers: { "x-cc-statusline": "1" },
			});
		}

		if (url.pathname === "/api/diff") {
			if (url.searchParams.get("token") !== cfg.token) {
				return new Response("forbidden", { status: 403 });
			}
			const repo = url.searchParams.get("repo") ?? "";
			if (!repo || !(await isGitRepo(repo))) {
				return new Response("not a git repository", { status: 400 });
			}
			const untracked = url.searchParams.get("untracked") === "1";
			const mode = url.searchParams.get("mode") === "base" ? "base" : "working";
			const { base, ref } = await resolveBaseCached(repo);
			const files =
				mode === "base"
					? await getDiffFiles(repo, {
							untracked,
							mode: "base",
							ref: ref ?? undefined,
						})
					: await getDiffFiles(repo, { untracked });
			// NOTE: intentionally no Access-Control-Allow-Origin — cross-origin pages must not read this.
			return new Response(JSON.stringify(files), {
				headers: {
					"content-type": "application/json; charset=utf-8",
					"x-diff-base": base ?? "",
				},
			});
		}

		if (url.pathname === "/api/blob") {
			if (url.searchParams.get("token") !== cfg.token) {
				return new Response("forbidden", { status: 403 });
			}
			const repo = url.searchParams.get("repo") ?? "";
			if (!repo || !(await isGitRepo(repo))) {
				return new Response("not a git repository", { status: 400 });
			}
			const path = url.searchParams.get("path") ?? "";
			// blob은 이미지 diff 전용 — 이미지 외 파일(빈 경로 포함)은 노출하지 않는다.
			if (!isImagePath(path)) {
				return new Response("not found", { status: 404 });
			}
			const side = url.searchParams.get("side") === "old" ? "old" : "new";
			const mode = url.searchParams.get("mode") === "base" ? "base" : "working";
			const ref = mode === "base" ? (await resolveBaseCached(repo)).ref : null;
			const bytes = await getFileBytes(
				repo,
				path,
				side,
				mode === "base" && ref ? { mode, ref } : {},
			);
			if (!bytes) return new Response("not found", { status: 404 });
			// no-store: 워킹트리 이미지는 저장할 때마다 바뀌므로 항상 새로 읽는다
			// (변경 감지는 blobVersion 캐시버스터가 담당).
			return new Response(bytes, {
				headers: {
					"content-type": imageContentType(path),
					"cache-control": "no-store",
				},
			});
		}

		const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
		const filePath = resolve(viewerRoot, rel);
		if (filePath !== viewerRoot && !filePath.startsWith(`${viewerRoot}/`)) {
			return new Response("forbidden", { status: 403 });
		}
		const file = Bun.file(filePath);
		// no-store: the viewer bundle is served from disk and changes on rebuild/
		// package update; never let the browser run a stale cached copy.
		if (await file.exists()) {
			return new Response(file, { headers: { "cache-control": "no-store" } });
		}
		return new Response("not found", { status: 404 });
	};
};

export const startDiffServer = (opts: {
	port: number;
	viewerDir: string;
	env?: Env;
	idleTimeoutMs?: number;
}): DiffServerHandle => {
	const env = opts.env ?? process.env;
	const token = ensureToken(env);
	let lastActivity = Date.now();
	const handler = createHandler({ viewerDir: opts.viewerDir, token });

	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: opts.port,
		fetch: (req) => {
			lastActivity = Date.now();
			return handler(req);
		},
	});

	let idleTimer: ReturnType<typeof setInterval> | undefined;
	const idleTimeoutMs = opts.idleTimeoutMs;
	if (idleTimeoutMs && idleTimeoutMs > 0) {
		idleTimer = setInterval(() => {
			if (Date.now() - lastActivity > idleTimeoutMs) {
				stop();
				process.exit(0);
			}
		}, 60_000);
		idleTimer.unref?.();
	}

	const stop = (): void => {
		if (idleTimer) clearInterval(idleTimer);
		// stop()은 종료 대기 Promise를 반환하지만 fire-and-forget으로 충분.
		void server.stop(true);
	};

	return { server, token, stop };
};
