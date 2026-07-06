import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CACHE_TTL, cache, resetCache } from "../cache.ts";
import {
	MANAGED_SETTINGS_PATH,
	getUltracodeCached,
	resolveUltracodeFromFiles,
	ultracodeSettingsPaths,
} from "../ultracode.ts";

const writeSettings = (path: string, content: string): void => {
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(path, content);
};

describe("ultracode settings", () => {
	let dir: string;

	beforeEach(() => {
		resetCache();
		dir = mkdtempSync(join(tmpdir(), "cc-statusline-ultracode-"));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	describe("ultracodeSettingsPaths", () => {
		test("orders managed > local > project > user", () => {
			const paths = ultracodeSettingsPaths("/proj", "/home/u");
			expect(paths).toEqual([
				MANAGED_SETTINGS_PATH,
				"/proj/.claude/settings.local.json",
				"/proj/.claude/settings.json",
				"/home/u/.claude/settings.json",
			]);
		});

		test("skips project paths when projectDir is empty", () => {
			const paths = ultracodeSettingsPaths("", "/home/u");
			expect(paths).toEqual([
				MANAGED_SETTINGS_PATH,
				"/home/u/.claude/settings.json",
			]);
		});

		test("managed settings path is platform-specific and absolute", () => {
			expect(MANAGED_SETTINGS_PATH).toContain("managed-settings.json");
			// darwin: /Library/Application Support/ClaudeCode/managed-settings.json
			// linux: /etc/claude-code/managed-settings.json
			expect(MANAGED_SETTINGS_PATH.startsWith("/")).toBe(
				process.platform !== "win32",
			);
		});
	});

	describe("resolveUltracodeFromFiles", () => {
		test("returns false when no files exist", async () => {
			const result = await resolveUltracodeFromFiles([
				join(dir, "missing.json"),
			]);
			expect(result).toBe(false);
		});

		test("reads boolean ultracode key from first file that has it", async () => {
			const first = join(dir, "first.json");
			const second = join(dir, "second.json");
			writeSettings(first, JSON.stringify({ ultracode: true }));
			writeSettings(second, JSON.stringify({ ultracode: false }));

			expect(await resolveUltracodeFromFiles([first, second])).toBe(true);
		});

		test("first file with the key wins even when false", async () => {
			const first = join(dir, "first.json");
			const second = join(dir, "second.json");
			writeSettings(first, JSON.stringify({ ultracode: false }));
			writeSettings(second, JSON.stringify({ ultracode: true }));

			expect(await resolveUltracodeFromFiles([first, second])).toBe(false);
		});

		test("falls through files without the key", async () => {
			const first = join(dir, "first.json");
			const second = join(dir, "second.json");
			writeSettings(first, JSON.stringify({ other: 1 }));
			writeSettings(second, JSON.stringify({ ultracode: true }));

			expect(await resolveUltracodeFromFiles([first, second])).toBe(true);
		});

		test("skips invalid JSON and non-boolean values", async () => {
			const broken = join(dir, "broken.json");
			const nonBool = join(dir, "nonbool.json");
			const valid = join(dir, "valid.json");
			writeSettings(broken, "{not json");
			writeSettings(nonBool, JSON.stringify({ ultracode: "yes" }));
			writeSettings(valid, JSON.stringify({ ultracode: true }));

			expect(await resolveUltracodeFromFiles([broken, nonBool, valid])).toBe(
				true,
			);
		});
	});

	describe("getUltracodeCached", () => {
		test("reads user settings when project has none", async () => {
			const home = join(dir, "home");
			writeSettings(
				join(home, ".claude", "settings.json"),
				JSON.stringify({ ultracode: true }),
			);

			expect(await getUltracodeCached(join(dir, "proj"), home)).toBe(true);
		});

		test("project local settings override user settings", async () => {
			const home = join(dir, "home");
			const proj = join(dir, "proj");
			writeSettings(
				join(home, ".claude", "settings.json"),
				JSON.stringify({ ultracode: true }),
			);
			writeSettings(
				join(proj, ".claude", "settings.local.json"),
				JSON.stringify({ ultracode: false }),
			);

			expect(await getUltracodeCached(proj, home)).toBe(false);
		});

		test("returns cached value within TTL without re-reading", async () => {
			const home = join(dir, "home");
			const settingsPath = join(home, ".claude", "settings.json");
			writeSettings(settingsPath, JSON.stringify({ ultracode: true }));

			expect(await getUltracodeCached("", home)).toBe(true);

			// 파일이 바뀌어도 TTL 내에서는 캐시 값 유지
			writeSettings(settingsPath, JSON.stringify({ ultracode: false }));
			expect(await getUltracodeCached("", home)).toBe(true);
		});

		test("re-reads after cache expires", async () => {
			const home = join(dir, "home");
			const settingsPath = join(home, ".claude", "settings.json");
			writeSettings(settingsPath, JSON.stringify({ ultracode: true }));

			expect(await getUltracodeCached("", home)).toBe(true);

			writeSettings(settingsPath, JSON.stringify({ ultracode: false }));
			cache.ultracode.timestamp = Date.now() - CACHE_TTL.ultracode - 1000;
			expect(await getUltracodeCached("", home)).toBe(false);
		});
	});
});
