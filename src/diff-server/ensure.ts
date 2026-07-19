import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	getCacheDir,
	isDiffViewerDisabled,
	resolveDiffPort,
} from "./config.ts";
import { readTokenSync } from "./token.ts";

type Env = Record<string, string | undefined>;
type EnsureResult = { port: number; token: string } | null;

/** What a `/api/ping` responder told us about itself. */
type Probe = { version: string | null; pid: number | null };

/**
 * Seams for `maybeSpawn`, all injectable so the retirement logic can be tested
 * without touching a real port, process, or the OS.
 */
export interface EnsureDeps {
	/** Launch a fresh diffdeck daemon on `port`. */
	spawn: (port: number, env: Env) => void;
	/** Ping the port; null when nothing of ours answers. */
	probe: (port: number) => Promise<Probe | null>;
	/** The pid actually holding the port, per the OS (lsof); null if unknown. */
	portOwner: (port: number) => number | null;
	/** Signal a pid (SIGTERM). */
	kill: (pid: number) => void;
	sleep: (ms: number) => Promise<void>;
	/** The diffdeck version installed in node_modules; null if unresolvable. */
	currentVersion: () => string | null;
}

const ENSURE_TTL_MS = 5_000;
const LOCK_STALE_MS = 30_000;
const PORT_FREE_TRIES = 20;
const PORT_FREE_INTERVAL_MS = 100;

let checkedAt = 0;

export const resetEnsureCache = (): void => {
	checkedAt = 0;
};

// A ping answers for our family if it carries the diffdeck marker or the old
// embedded cc-statusline marker. Either way it is ours to retire; only a build
// whose version matches the one on disk is left alone. A pre-0.2.2 diffdeck and
// the embedded server both report no version, so both read as stale.
export const probeServer = async (port: number): Promise<Probe | null> => {
	try {
		const res = await fetch(`http://127.0.0.1:${port}/api/ping`, {
			signal: AbortSignal.timeout(150),
		});
		const ours =
			res.headers.get("x-diffdeck") === "1" ||
			res.headers.get("x-cc-statusline") === "1";
		if (!ours) return null;
		const version = res.headers.get("x-diffdeck-version");
		const pidRaw = res.headers.get("x-diffdeck-pid");
		const pid = pidRaw == null ? null : Number.parseInt(pidRaw, 10);
		return { version, pid: Number.isInteger(pid) ? pid : null };
	} catch {
		return null;
	}
};

// The OS is the source of truth for who holds the port. We never signal the
// wire-reported pid directly — a squatter could report someone else's — only a
// pid lsof confirms is the actual listener.
const lsofPortOwner = (port: number): number | null => {
	try {
		const out = Bun.spawnSync(["lsof", "-ti", `tcp:${port}`, "-sTCP:LISTEN"]);
		if (out.exitCode !== 0) return null;
		const first = out.stdout.toString().trim().split("\n")[0] ?? "";
		const pid = Number.parseInt(first, 10);
		return Number.isInteger(pid) ? pid : null;
	} catch {
		return null;
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

// diffdeck의 bin 경로와 버전을 설치된 package.json에서 읽는다. import.meta.resolve는
// diffdeck의 package.json 자체를 resolvable node_modules 진입점으로 쓰고, 거기서 나온
// 디렉터리에 상대적으로 bin 경로를 조립한다.
export const resolveDiffdeck = (): { cli: string; version: string } => {
	const pkgDir = dirname(
		fileURLToPath(import.meta.resolve("@say8425/diffdeck/package.json")),
	);
	const pkg = JSON.parse(
		readFileSync(join(pkgDir, "package.json"), "utf8"),
	) as {
		version: string;
		bin: { diffdeck: string };
	};
	return { cli: join(pkgDir, pkg.bin.diffdeck), version: pkg.version };
};

const spawnDaemon = (port: number, env: Env): void => {
	const { cli } = resolveDiffdeck();
	// nohup + & fully detaches so the daemon outlives this statusline process.
	Bun.spawn(
		[
			"sh",
			"-c",
			'nohup "$0" "$1" --no-open --port "$2" >/dev/null 2>&1 &',
			process.execPath,
			cli,
			String(port),
		],
		{
			env: { ...process.env, ...env, DIFFDECK_PORT: String(port) },
			stdin: "ignore",
			stdout: "ignore",
			stderr: "ignore",
		},
	).unref();
};

const realDeps: EnsureDeps = {
	spawn: spawnDaemon,
	probe: probeServer,
	portOwner: lsofPortOwner,
	kill: (pid) => process.kill(pid, "SIGTERM"),
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	currentVersion: () => {
		try {
			return resolveDiffdeck().version;
		} catch {
			return null;
		}
	},
};

// Poll until the port stops answering (the daemon has exited), bounded so a
// wedged process can never hold the loop open. This runs inside the
// fire-and-forget maybeSpawn, whose pending timers keep the short-lived
// statusline process alive until it settles — but only on the one tick that
// triggers an upgrade. diffdeck shuts down gracefully on SIGTERM, so the port
// frees in a poll or two: measured +~180ms over a normal tick, not the full
// PORT_FREE_TRIES budget. Every later tick sees the current version and returns
// before this. The 2s cap only bites a daemon that ignores SIGTERM.
const waitPortFree = async (port: number, d: EnsureDeps): Promise<boolean> => {
	for (let i = 0; i < PORT_FREE_TRIES; i++) {
		// oxlint-disable-next-line no-await-in-loop -- a liveness poll is sequential by nature
		await d.sleep(PORT_FREE_INTERVAL_MS);
		// oxlint-disable-next-line no-await-in-loop -- ditto
		if ((await d.probe(port)) == null) return true;
	}
	return false;
};

// Fire-and-forget from ensureDiffServer's hot path; every failure mode degrades
// to a silent no-op. Exported for tests to drive the retirement branches
// deterministically.
export const maybeSpawn = async (
	port: number,
	env: Env,
	deps: Partial<EnsureDeps> = {},
): Promise<void> => {
	const d: EnsureDeps = { ...realDeps, ...deps };
	try {
		const found = await d.probe(port);
		const current = d.currentVersion();

		// Up to date, or we cannot tell what "current" even is (dep unresolvable)
		// — either way, leave whatever is there rather than churn it.
		if (found && (current == null || found.version === current)) return;

		if (!acquireSpawnLock(env)) return;

		if (found) {
			// Stale (or a versionless legacy daemon). Retire the real port owner,
			// not the wire-reported pid: if a responder claims a pid the OS says
			// does not own the port, it is not to be trusted — signal nothing.
			const owner = d.portOwner(port);
			if (owner == null) return;
			if (found.pid != null && found.pid !== owner) return;
			d.kill(owner);
			if (!(await waitPortFree(port, d))) return;
		}

		d.spawn(port, env);
	} catch {
		// The probe, lock/dir creation, lsof, kill, or spawn can all throw. This
		// runs as a bare `void maybeSpawn(...)` on the statusline hot path with no
		// `.catch`, so an uncaught throw would crash it. Degrade to a no-op.
	}
};

// 동기 함수 — probe/spawn/retire는 fire-and-forget이라 await할 것이 없다.
// 호출부의 `await`는 값에 대한 no-op이므로 시그니처를 Promise로 만들지 않는다.
export const ensureDiffServer = (
	_repo: string,
	env: Env = process.env,
	deps: Partial<EnsureDeps> = {},
): EnsureResult => {
	if (isDiffViewerDisabled(env)) return null;
	const port = resolveDiffPort(env);

	const now = Date.now();
	if (now - checkedAt >= ENSURE_TTL_MS) {
		checkedAt = now;
		// Fire-and-forget: never block the statusline hot path on probe/retire/spawn.
		void maybeSpawn(port, env, deps);
	}

	const token = readTokenSync(env);
	return token ? { port, token } : null;
};
