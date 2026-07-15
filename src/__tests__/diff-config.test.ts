import { describe, expect, test } from "bun:test";
import {
	DEFAULT_DIFF_PORT,
	getCacheDir,
	getDiffdeckCacheDir,
	isDiffViewerDisabled,
	resolveDiffPort,
} from "../diff-server/config.ts";

describe("resolveDiffPort", () => {
	test("defaults when unset", () => {
		expect(resolveDiffPort({})).toBe(DEFAULT_DIFF_PORT);
	});
	test("uses valid override", () => {
		expect(resolveDiffPort({ CC_STATUSLINE_DIFF_PORT: "51000" })).toBe(51000);
	});
	test("falls back on invalid override", () => {
		expect(resolveDiffPort({ CC_STATUSLINE_DIFF_PORT: "abc" })).toBe(
			DEFAULT_DIFF_PORT,
		);
		expect(resolveDiffPort({ CC_STATUSLINE_DIFF_PORT: "70000" })).toBe(
			DEFAULT_DIFF_PORT,
		);
		expect(resolveDiffPort({ CC_STATUSLINE_DIFF_PORT: "0" })).toBe(
			DEFAULT_DIFF_PORT,
		);
	});
});

describe("isDiffViewerDisabled", () => {
	test("true only when exactly '1'", () => {
		expect(isDiffViewerDisabled({ CC_STATUSLINE_DIFF_DISABLE: "1" })).toBe(
			true,
		);
		expect(isDiffViewerDisabled({ CC_STATUSLINE_DIFF_DISABLE: "0" })).toBe(
			false,
		);
		expect(isDiffViewerDisabled({})).toBe(false);
	});
});

describe("getCacheDir", () => {
	test("respects XDG_CACHE_HOME", () => {
		expect(getCacheDir({ XDG_CACHE_HOME: "/tmp/xdg" })).toBe(
			"/tmp/xdg/cc-statusline",
		);
	});
	test("falls back to ~/.cache", () => {
		const dir = getCacheDir({ HOME: "/home/x" });
		expect(dir.endsWith("/cc-statusline")).toBe(true);
	});
});

describe("getDiffdeckCacheDir", () => {
	test("respects XDG_CACHE_HOME", () => {
		expect(getDiffdeckCacheDir({ XDG_CACHE_HOME: "/tmp/xdg" })).toBe(
			"/tmp/xdg/diffdeck",
		);
	});
	test("falls back to ~/.cache", () => {
		const dir = getDiffdeckCacheDir({ HOME: "/home/x" });
		expect(dir.endsWith("/diffdeck")).toBe(true);
	});
});
