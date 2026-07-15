import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDiffdeckCacheDir } from "../diff-server/config.ts";
import { ensureDiffServer, resetEnsureCache } from "../diff-server/ensure.ts";

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
			() => {},
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
		const result = ensureDiffServer("/some/repo", env, () => {});
		expect(result).toEqual({ port: 59999, token });
	});

	test("does not throw/reject when the injected spawner throws (spawn failure)", async () => {
		cacheHome = mkdtempSync(join(tmpdir(), "cc-ensure-"));
		const env = { XDG_CACHE_HOME: cacheHome, CC_STATUSLINE_DIFF_PORT: "59997" };

		// Must resolve (not throw) even though the injected spawner always throws,
		// and the fire-and-forget probe/spawn promise must never surface as an
		// unhandled rejection.
		const result = ensureDiffServer("/some/repo", env, throwingSpawn);
		expect(result).toBeNull();

		// Give the fire-and-forget maybeSpawn() microtask a chance to run so a
		// regression (missing try/catch) would show up as an unhandled rejection
		// during this test rather than leaking into a later one.
		await new Promise((resolve) => setTimeout(resolve, 10));
	});
});
