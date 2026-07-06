import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureDiffServer, resetEnsureCache } from "../diff-server/ensure.ts";

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
		// Use an unlikely port so the probe fails fast and no real daemon interferes.
		const result = ensureDiffServer("/some/repo", {
			XDG_CACHE_HOME: cacheHome,
			CC_STATUSLINE_DIFF_PORT: "59999",
		});
		// No token persisted yet on the very first call.
		expect(result).toBeNull();
	});

	test("returns the token+port once a token file exists", async () => {
		cacheHome = mkdtempSync(join(tmpdir(), "cc-ensure-"));
		const { ensureToken } = await import("../diff-server/token.ts");
		const env = { XDG_CACHE_HOME: cacheHome, CC_STATUSLINE_DIFF_PORT: "59999" };
		const token = ensureToken(env);
		resetEnsureCache();
		const result = ensureDiffServer("/some/repo", env);
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
