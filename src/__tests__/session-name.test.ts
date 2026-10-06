import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSessionName, sessionsDir } from "../sessionName.ts";

const SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

describe("session name", () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "cc-statusline-sessions-"));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	const writeEntry = (file: string, entry: unknown): void => {
		writeFileSync(join(dir, file), JSON.stringify(entry));
	};

	describe("sessionsDir", () => {
		test("defaults to ~/.claude/sessions", () => {
			expect(sessionsDir({}, "/home/u")).toBe("/home/u/.claude/sessions");
		});

		test("follows CLAUDE_CONFIG_DIR when set", () => {
			expect(sessionsDir({ CLAUDE_CONFIG_DIR: "/srv/a" }, "/home/u")).toBe(
				"/srv/a/sessions",
			);
		});

		test("ignores an empty CLAUDE_CONFIG_DIR", () => {
			expect(sessionsDir({ CLAUDE_CONFIG_DIR: "" }, "/home/u")).toBe(
				"/home/u/.claude/sessions",
			);
		});
	});

	describe("readSessionName", () => {
		test("returns the name of the entry whose sessionId matches", async () => {
			writeEntry("111.json", { sessionId: "other", name: "someone-else" });
			writeEntry("222.json", { sessionId: SESSION_ID, name: "cc업글" });
			expect(await readSessionName(SESSION_ID, dir)).toBe("cc업글");
		});

		test("returns derived default names too (they are mention addresses)", async () => {
			writeEntry("333.json", {
				sessionId: SESSION_ID,
				name: "penguin-01",
				nameSource: "derived",
			});
			expect(await readSessionName(SESSION_ID, dir)).toBe("penguin-01");
		});

		test("prefers the most recently updated entry when several match", async () => {
			writeEntry("1.json", {
				sessionId: SESSION_ID,
				name: "old",
				updatedAt: 1,
			});
			writeEntry("2.json", {
				sessionId: SESSION_ID,
				name: "new",
				updatedAt: 2,
			});
			expect(await readSessionName(SESSION_ID, dir)).toBe("new");
		});

		test("returns null when no entry matches", async () => {
			writeEntry("1.json", { sessionId: "other", name: "x" });
			expect(await readSessionName(SESSION_ID, dir)).toBeNull();
		});

		test("returns null when sessionId is missing or empty", async () => {
			writeEntry("1.json", { sessionId: SESSION_ID, name: "x" });
			expect(await readSessionName(undefined, dir)).toBeNull();
			expect(await readSessionName("", dir)).toBeNull();
		});

		test("returns null when the directory does not exist", async () => {
			expect(await readSessionName(SESSION_ID, join(dir, "nope"))).toBeNull();
		});

		test("skips broken JSON, non-json files, and blank or non-string names", async () => {
			writeFileSync(join(dir, "1.json"), "{not json");
			writeFileSync(join(dir, "2.key"), SESSION_ID);
			writeEntry("3.json", { sessionId: SESSION_ID, name: "   " });
			writeEntry("4.json", { sessionId: SESSION_ID, name: 42 });
			writeEntry("5.json", null);
			expect(await readSessionName(SESSION_ID, dir)).toBeNull();
			writeEntry("6.json", { sessionId: SESSION_ID, name: " ok " });
			expect(await readSessionName(SESSION_ID, dir)).toBe("ok");
		});
	});
});
