import { afterEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { getTokenPath, readTokenSync } from "../diff-server/token.ts";

const TMP = "/tmp/cc-statusline-token-test";
const env = { XDG_CACHE_HOME: TMP };

afterEach(() => {
	rmSync(TMP, { recursive: true, force: true });
});

describe("token module", () => {
	test("readTokenSync returns null when absent", () => {
		expect(readTokenSync(env)).toBeNull();
	});

	test("getTokenPath is under diffdeck's cache dir", () => {
		expect(getTokenPath(env)).toBe(`${TMP}/diffdeck/diff-server.token`);
	});
});
