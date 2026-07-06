import { mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	getCacheDir,
	isDiffViewerDisabled,
	resolveDiffPort,
} from "./config.ts";
import { readTokenSync } from "./token.ts";

type Env = Record<string, string | undefined>;
type EnsureResult = { port: number; token: string } | null;
type SpawnFn = (port: number, env: Env) => void;

const ENSURE_TTL_MS = 5_000;
const LOCK_STALE_MS = 30_000;

let checkedAt = 0;

export const resetEnsureCache = (): void => {
	checkedAt = 0;
};

const probeOurServer = async (port: number): Promise<boolean> => {
	try {
		const res = await fetch(`http://127.0.0.1:${port}/api/ping`, {
			signal: AbortSignal.timeout(150),
		});
		return res.headers.get("x-cc-statusline") === "1";
	} catch {
		return false;
	}
};

const acquireSpawnLock = (env: Env): boolean => {
	const lock = join(getCacheDir(env), "diff-server.lock");
	mkdirSync(getCacheDir(env), { recursive: true, mode: 0o700 });
	try {
		mkdirSync(lock);
		return true;
	} catch {
		try {
			if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) {
				rmSync(lock, { recursive: true, force: true });
				mkdirSync(lock);
				return true;
			}
		} catch {}
		return false;
	}
};

const spawnDaemon = (port: number, env: Env): void => {
	const execPath = process.execPath;
	const selfPath = Bun.main;
	// nohup + & fully detaches so the daemon outlives this statusline process.
	Bun.spawn(
		[
			"sh",
			"-c",
			'nohup "$0" "$1" --diff-server >/dev/null 2>&1 &',
			execPath,
			selfPath,
		],
		{
			env: { ...process.env, ...env, CC_STATUSLINE_DIFF_PORT: String(port) },
			stdin: "ignore",
			stdout: "ignore",
			stderr: "ignore",
		},
	).unref();
};

const maybeSpawn = async (
	port: number,
	env: Env,
	spawn: SpawnFn = spawnDaemon,
): Promise<void> => {
	try {
		if (await probeOurServer(port)) return;
		if (!acquireSpawnLock(env)) return;
		spawn(port, env);
	} catch {
		// Any failure in this fire-and-forget path — the probe, lock-dir/lock
		// creation (mkdirSync can throw), or Bun.spawn itself (missing shell,
		// sandboxed fork/exec, EMFILE/ENOMEM, ...) — must never surface as an
		// unhandled rejection. This is called as bare `void maybeSpawn(...)`
		// from ensureDiffServer with no `.catch`, so an uncaught throw here
		// would crash the statusline hot path. Degrade to a silent no-op.
	}
};

// 동기 함수 — probe/spawn은 fire-and-forget이라 await할 것이 없다.
// 호출부의 `await`는 값에 대한 no-op이므로 시그니처를 굳이 Promise로 만들지 않는다.
export const ensureDiffServer = (
	_repo: string,
	env: Env = process.env,
	spawn: SpawnFn = spawnDaemon,
): EnsureResult => {
	if (isDiffViewerDisabled(env)) return null;
	const port = resolveDiffPort(env);

	const now = Date.now();
	if (now - checkedAt >= ENSURE_TTL_MS) {
		checkedAt = now;
		// Fire-and-forget: never block the statusline hot path on the probe/spawn.
		void maybeSpawn(port, env, spawn);
	}

	const token = readTokenSync(env);
	return token ? { port, token } : null;
};
