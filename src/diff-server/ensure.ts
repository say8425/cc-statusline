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

const ENSURE_TTL_MS = 5_000;
const LOCK_STALE_MS = 30_000;

let checkedAt = 0;

export function resetEnsureCache(): void {
	checkedAt = 0;
}

async function probeOurServer(port: number): Promise<boolean> {
	try {
		const res = await fetch(`http://127.0.0.1:${port}/api/ping`, {
			signal: AbortSignal.timeout(150),
		});
		return res.headers.get("x-cc-statusline") === "1";
	} catch {
		return false;
	}
}

function acquireSpawnLock(env: Env): boolean {
	const lock = join(getCacheDir(env), "diff-server.lock");
	mkdirSync(getCacheDir(env), { recursive: true });
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
}

function spawnDaemon(port: number): void {
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
			env: { ...process.env, CC_STATUSLINE_DIFF_PORT: String(port) },
			stdin: "ignore",
			stdout: "ignore",
			stderr: "ignore",
		},
	).unref();
}

async function maybeSpawn(port: number, env: Env): Promise<void> {
	if (await probeOurServer(port)) return;
	if (acquireSpawnLock(env)) spawnDaemon(port);
}

export async function ensureDiffServer(
	repo: string,
	env: Env = process.env,
): Promise<EnsureResult> {
	if (isDiffViewerDisabled(env)) return null;
	const port = resolveDiffPort(env);

	const now = Date.now();
	if (now - checkedAt >= ENSURE_TTL_MS) {
		checkedAt = now;
		// Fire-and-forget: never block the statusline hot path on the probe/spawn.
		void maybeSpawn(port, env);
	}

	const token = readTokenSync(env);
	return token ? { port, token } : null;
}
