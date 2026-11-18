import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	appendFileSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	INITIAL_SCAN_BYTES,
	lastUltracodeMarker,
	readTranscriptUltracode,
} from "../transcriptUltracode.ts";

// Claude Code(2.1.308~2.1.327)가 실제로 쓰는 줄 모양
const enterLine = (reminderType = "full"): string =>
	`${JSON.stringify({
		parentUuid: "p",
		isSidechain: false,
		attachment: { type: "ultra_effort_enter", reminderType },
		type: "attachment",
		uuid: "u",
	})}\n`;
const exitLine = (): string =>
	`${JSON.stringify({
		parentUuid: "p",
		isSidechain: false,
		attachment: { type: "ultra_effort_exit" },
		type: "attachment",
		uuid: "u",
	})}\n`;
const userLine = (text: string): string =>
	`${JSON.stringify({ type: "user", message: { role: "user", content: text } })}\n`;

describe("lastUltracodeMarker", () => {
	test("returns null without any marker", () => {
		expect(lastUltracodeMarker(Buffer.from(userLine("hi")))).toBeNull();
	});

	test("returns true for an enter marker", () => {
		expect(lastUltracodeMarker(Buffer.from(enterLine()))).toBe(true);
	});

	test("the last marker wins", () => {
		const buf = Buffer.from(enterLine() + exitLine() + userLine("x"));
		expect(lastUltracodeMarker(buf)).toBe(false);
		const again = Buffer.from(exitLine() + enterLine("sparse"));
		expect(lastUltracodeMarker(again)).toBe(true);
	});

	test("skips an unknown ultra_effort_* subtype and keeps looking back", () => {
		const unknown = `${JSON.stringify({
			attachment: { type: "ultra_effort_future" },
			type: "attachment",
		})}\n`;
		expect(lastUltracodeMarker(Buffer.from(enterLine() + unknown))).toBe(true);
		expect(lastUltracodeMarker(Buffer.from(unknown))).toBeNull();
	});

	test("ignores the marker quoted inside a string (escaped quotes)", () => {
		// 도구 출력에 인용된 attachment 줄은 JSONL에서 \" 로 이스케이프된다
		const quoted = userLine(enterLine());
		expect(lastUltracodeMarker(Buffer.from(exitLine() + quoted))).toBe(false);
		expect(lastUltracodeMarker(Buffer.from(quoted))).toBeNull();
	});
});

describe("readTranscriptUltracode", () => {
	let dir: string;
	let stateDir: string;
	let transcript: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "cc-statusline-transcript-"));
		stateDir = join(dir, "state");
		transcript = join(dir, "session.jsonl");
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	test("returns null without a transcript path", async () => {
		expect(await readTranscriptUltracode(undefined, stateDir)).toBeNull();
	});

	test("returns null when the transcript does not exist", async () => {
		expect(await readTranscriptUltracode(transcript, stateDir)).toBeNull();
	});

	test("returns null when the transcript has no marker", async () => {
		writeFileSync(transcript, userLine("hello"));
		expect(await readTranscriptUltracode(transcript, stateDir)).toBeNull();
	});

	test("reads enter as on and a later exit as off", async () => {
		writeFileSync(transcript, userLine("a") + enterLine());
		expect(await readTranscriptUltracode(transcript, stateDir)).toBe(true);

		appendFileSync(transcript, userLine("b") + exitLine());
		expect(await readTranscriptUltracode(transcript, stateDir)).toBe(false);
	});

	test("keeps the state across ticks when no new marker arrives", async () => {
		writeFileSync(transcript, enterLine());
		expect(await readTranscriptUltracode(transcript, stateDir)).toBe(true);

		appendFileSync(transcript, userLine("later"));
		expect(await readTranscriptUltracode(transcript, stateDir)).toBe(true);
		expect(await readTranscriptUltracode(transcript, stateDir)).toBe(true);
	});

	test("persists one state file per transcript", async () => {
		writeFileSync(transcript, enterLine());
		await readTranscriptUltracode(transcript, stateDir);
		const files = readdirSync(stateDir);
		expect(files).toHaveLength(1);
		expect(files[0]).toMatch(/^[0-9a-f]{32}\.json$/);
	});

	test("does not consume a partially written last line", async () => {
		const line = enterLine();
		writeFileSync(transcript, userLine("a") + line.slice(0, 30));
		expect(await readTranscriptUltracode(transcript, stateDir)).toBeNull();

		appendFileSync(transcript, line.slice(30));
		expect(await readTranscriptUltracode(transcript, stateDir)).toBe(true);
	});

	test("rescans when the transcript shrinks below the saved offset", async () => {
		writeFileSync(transcript, userLine("a".repeat(500)) + enterLine());
		expect(await readTranscriptUltracode(transcript, stateDir)).toBe(true);

		writeFileSync(transcript, userLine("rewritten"));
		expect(await readTranscriptUltracode(transcript, stateDir)).toBeNull();
	});

	test("ignores a corrupt state file", async () => {
		writeFileSync(transcript, enterLine());
		await readTranscriptUltracode(transcript, stateDir);
		const [file] = readdirSync(stateDir);
		writeFileSync(join(stateDir, file ?? "x"), "{not json");
		expect(await readTranscriptUltracode(transcript, stateDir)).toBe(true);
	});

	test("first scan reads only the tail window", async () => {
		// 창보다 앞에 있는 enter는 첫 스캔에서 보이지 않는다
		const filler = userLine("x".repeat(INITIAL_SCAN_BYTES));
		writeFileSync(transcript, enterLine() + filler);
		expect(await readTranscriptUltracode(transcript, stateDir)).toBeNull();
	});

	test("still works when the state directory cannot be created", async () => {
		writeFileSync(transcript, enterLine());
		const blocked = join(dir, "blocked");
		writeFileSync(blocked, "a file, not a directory");
		expect(await readTranscriptUltracode(transcript, blocked)).toBe(true);
	});
});
