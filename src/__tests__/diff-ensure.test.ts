import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDiffdeckCacheDir } from "../diff-server/config.ts";
import {
	type EnsureDeps,
	ensureDiffServer,
	maybeSpawn,
	resetEnsureCache,
} from "../diff-server/ensure.ts";

// diffdeck writes its own token to its own cache dir; ensureDiffServer only
// reads it, so tests seed the token file there directly (no ensureToken helper
// exists on the cc-statusline side anymore).
const seedDiffdeckToken = (env: { XDG_CACHE_HOME: string }): string => {
	const token = crypto.randomUUID().replaceAll("-", "");
	const dir = getDiffdeckCacheDir(env);
	mkdirSync(dir, { recursive: true, mode: 0o700 });
	writeFileSync(join(dir, "diff-server.token"), token, { mode: 0o600 });
	return token;
};

let cacheHome: string;

const throwingSpawn = (): void => {
	throw new Error("spawn EMFILE: simulated spawn failure");
};

afterEach(() => {
	resetEnsureCache();
	if (cacheHome) rmSync(cacheHome, { recursive: true, force: true });
});

describe("ensureDiffServer", () => {
	test("returns null when disabled", () => {
		const result = ensureDiffServer("/some/repo", {
			CC_STATUSLINE_DIFF_DISABLE: "1",
		});
		expect(result).toBeNull();
	});

	test("returns null on the first tick when no token exists yet", () => {
		cacheHome = mkdtempSync(join(tmpdir(), "cc-ensure-"));
		// No-op spawner so this read-only assertion never launches a real diffdeck.
		const result = ensureDiffServer(
			"/some/repo",
			{ XDG_CACHE_HOME: cacheHome, CC_STATUSLINE_DIFF_PORT: "59999" },
			{ spawn: () => {} },
		);
		// No token persisted yet on the very first call.
		expect(result).toBeNull();
	});

	test("returns the token+port once a token file exists", () => {
		cacheHome = mkdtempSync(join(tmpdir(), "cc-ensure-"));
		const env = { XDG_CACHE_HOME: cacheHome, CC_STATUSLINE_DIFF_PORT: "59999" };
		const token = seedDiffdeckToken(env);
		resetEnsureCache();
		// Inject a no-op spawner: this test covers only the token/port read, and
		// the default spawner would launch a real detached diffdeck process.
		const result = ensureDiffServer("/some/repo", env, { spawn: () => {} });
		expect(result).toEqual({ port: 59999, token });
	});

	test("does not throw/reject when the injected spawner throws (spawn failure)", async () => {
		cacheHome = mkdtempSync(join(tmpdir(), "cc-ensure-"));
		const env = { XDG_CACHE_HOME: cacheHome, CC_STATUSLINE_DIFF_PORT: "59997" };

		// Must resolve (not throw) even though the injected spawner always throws,
		// and the fire-and-forget probe/spawn promise must never surface as an
		// unhandled rejection.
		const result = ensureDiffServer("/some/repo", env, {
			spawn: throwingSpawn,
		});
		expect(result).toBeNull();

		// Give the fire-and-forget maybeSpawn() microtask a chance to run so a
		// regression (missing try/catch) would show up as an unhandled rejection
		// during this test rather than leaking into a later one.
		await new Promise((resolve) => setTimeout(resolve, 10));
	});
});

// The daemon is detached and long-lived, so a diffdeck upgrade on disk does not
// upgrade what answers the port. maybeSpawn compares the responder's reported
// version against the one we resolved from node_modules and, on a mismatch (or
// a legacy daemon that reports no version at all), retires the port's real
// owner — found via the OS, never the wire-reported pid — before spawning the
// current build in its place.
const PORT = 51737;

// A fresh temp cache dir per call so acquireSpawnLock always succeeds (the lock
// dir never pre-exists) — isolating the retirement logic from lock contention.
const withCache = (over: Partial<EnsureDeps>): Partial<EnsureDeps> => {
	cacheHome = mkdtempSync(join(tmpdir(), "cc-retire-"));
	return over;
};
const envFor = (): { XDG_CACHE_HOME: string } => ({
	XDG_CACHE_HOME: cacheHome,
});

describe("maybeSpawn: retiring a stale daemon", () => {
	test("spawns when nothing is listening", async () => {
		const spawn = mock(() => {});
		const kill = mock(() => {});
		await maybeSpawn(
			PORT,
			envFor(),
			withCache({
				spawn,
				kill,
				probe: () => Promise.resolve(null),
				currentVersion: () => "0.2.2",
			}),
		);
		expect(kill).not.toHaveBeenCalled();
		expect(spawn).toHaveBeenCalledTimes(1);
	});

	test("leaves a current-version daemon untouched", async () => {
		const spawn = mock(() => {});
		const kill = mock(() => {});
		await maybeSpawn(
			PORT,
			envFor(),
			withCache({
				spawn,
				kill,
				probe: () => Promise.resolve({ version: "0.2.2", pid: 111 }),
				currentVersion: () => "0.2.2",
			}),
		);
		expect(kill).not.toHaveBeenCalled();
		expect(spawn).not.toHaveBeenCalled();
	});

	test("retires a stale diffdeck then spawns the current one", async () => {
		const spawn = mock(() => {});
		const kill = mock(() => {});
		let probes = 0;
		await maybeSpawn(
			PORT,
			envFor(),
			withCache({
				spawn,
				kill,
				// stale on the first probe, gone once we've killed it
				probe: () =>
					Promise.resolve(
						probes++ === 0 ? { version: "0.1.0", pid: 111 } : null,
					),
				portOwner: () => 111,
				sleep: () => Promise.resolve(),
				currentVersion: () => "0.2.2",
			}),
		);
		expect(kill).toHaveBeenCalledWith(111);
		expect(spawn).toHaveBeenCalledTimes(1);
	});

	test("retires a legacy daemon that reports no version", async () => {
		const spawn = mock(() => {});
		const kill = mock(() => {});
		let probes = 0;
		await maybeSpawn(
			PORT,
			envFor(),
			withCache({
				spawn,
				kill,
				// version:null models a pre-0.2.2 diffdeck or the old embedded server
				probe: () =>
					Promise.resolve(probes++ === 0 ? { version: null, pid: null } : null),
				portOwner: () => 222,
				sleep: () => Promise.resolve(),
				currentVersion: () => "0.2.2",
			}),
		);
		expect(kill).toHaveBeenCalledWith(222);
		expect(spawn).toHaveBeenCalledTimes(1);
	});

	test("refuses to kill when the reported pid is not the real port owner", async () => {
		const spawn = mock(() => {});
		const kill = mock(() => {});
		await maybeSpawn(
			PORT,
			envFor(),
			withCache({
				spawn,
				kill,
				// A squatter could answer the marker with someone else's pid; the
				// OS says a different process owns the port, so we touch neither.
				probe: () => Promise.resolve({ version: "0.1.0", pid: 999 }),
				portOwner: () => 111,
				sleep: () => Promise.resolve(),
				currentVersion: () => "0.2.2",
			}),
		);
		expect(kill).not.toHaveBeenCalled();
		expect(spawn).not.toHaveBeenCalled();
	});

	test("does nothing when the port owner cannot be identified", async () => {
		const spawn = mock(() => {});
		const kill = mock(() => {});
		await maybeSpawn(
			PORT,
			envFor(),
			withCache({
				spawn,
				kill,
				probe: () => Promise.resolve({ version: "0.1.0", pid: null }),
				portOwner: () => null,
				sleep: () => Promise.resolve(),
				currentVersion: () => "0.2.2",
			}),
		);
		expect(kill).not.toHaveBeenCalled();
		expect(spawn).not.toHaveBeenCalled();
	});

	test("does not spawn if the port never frees after the kill", async () => {
		const spawn = mock(() => {});
		const kill = mock(() => {});
		await maybeSpawn(
			PORT,
			envFor(),
			withCache({
				spawn,
				kill,
				// The daemon keeps answering even after SIGTERM — never freed.
				probe: () => Promise.resolve({ version: "0.1.0", pid: 111 }),
				portOwner: () => 111,
				sleep: () => Promise.resolve(),
				currentVersion: () => "0.2.2",
			}),
		);
		expect(kill).toHaveBeenCalledWith(111);
		expect(spawn).not.toHaveBeenCalled();
	});

	test("leaves the daemon alone when the current version is unknown", async () => {
		const spawn = mock(() => {});
		const kill = mock(() => {});
		await maybeSpawn(
			PORT,
			envFor(),
			withCache({
				spawn,
				kill,
				// resolveDiffdeck() failed (dep missing/broken): with no version to
				// compare against we cannot call anything stale, so don't retire.
				probe: () => Promise.resolve({ version: "0.1.0", pid: 111 }),
				portOwner: () => 111,
				currentVersion: () => null,
			}),
		);
		expect(kill).not.toHaveBeenCalled();
		expect(spawn).not.toHaveBeenCalled();
	});
});
