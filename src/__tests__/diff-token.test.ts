import { afterEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import {
	ensureToken,
	generateToken,
	getTokenPath,
	readTokenSync,
} from "../diff-server/token.ts";

const TMP = "/tmp/cc-statusline-token-test";
const env = { XDG_CACHE_HOME: TMP };

afterEach(() => {
	rmSync(TMP, { recursive: true, force: true });
});

describe("token module", () => {
	test("generateToken returns a non-empty hex-ish string", () => {
		const t = generateToken();
		expect(t.length).toBeGreaterThan(16);
		expect(t).not.toContain("-");
	});

	test("readTokenSync returns null when absent", () => {
		expect(readTokenSync(env)).toBeNull();
	});

	test("ensureToken persists a token and readTokenSync returns it", () => {
		const t = ensureToken(env);
		expect(readTokenSync(env)).toBe(t);
	});

	test("ensureToken reuses an existing token", () => {
		const first = ensureToken(env);
		const second = ensureToken(env);
		expect(second).toBe(first);
	});

	test("getTokenPath is under the cache dir", () => {
		expect(getTokenPath(env)).toBe(`${TMP}/cc-statusline/diff-server.token`);
	});
});
