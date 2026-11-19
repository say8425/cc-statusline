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
	lastUltracodeMarker,
	readTranscriptUltracode,
	type ScanLimits,
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

const filler = (bytes: number): string => userLine("x".repeat(bytes));

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

	describe("with small scan limits", () => {
		const limits: ScanLimits = { chunkBytes: 64, maxBackscanBytes: 2048 };

		test("finds a marker many chunks back on the first scan", async () => {
			writeFileSync(transcript, enterLine() + filler(1500));
			expect(await readTranscriptUltracode(transcript, stateDir, limits)).toBe(
				true,
			);
		});

		test("finds a marker that straddles a chunk boundary", async () => {
			// 바늘이 어느 위치에서 잘리든 찾아야 한다
			for (let pad = 0; pad < 64; pad++) {
				rmSync(stateDir, { recursive: true, force: true });
				writeFileSync(
					transcript,
					`${"y".repeat(pad)}\n${enterLine()}${filler(100)}`,
				);
				expect(
					await readTranscriptUltracode(transcript, stateDir, limits),
				).toBe(true);
			}
		});

		test("gives up beyond the backscan limit", async () => {
			writeFileSync(transcript, enterLine() + filler(3000));
			expect(
				await readTranscriptUltracode(transcript, stateDir, limits),
			).toBeNull();
		});

		test("a stale offset reads only the bounded tail and finds a new exit", async () => {
			writeFileSync(transcript, enterLine());
			expect(await readTranscriptUltracode(transcript, stateDir, limits)).toBe(
				true,
			);
			// statusline이 돌지 않는 동안 transcript가 한도보다 크게 자란 경우
			appendFileSync(transcript, filler(5000) + exitLine() + userLine("x"));
			expect(await readTranscriptUltracode(transcript, stateDir, limits)).toBe(
				false,
			);
		});

		test("a stale offset without new markers keeps the previous state", async () => {
			writeFileSync(transcript, enterLine());
			expect(await readTranscriptUltracode(transcript, stateDir, limits)).toBe(
				true,
			);
			appendFileSync(transcript, filler(5000));
			expect(await readTranscriptUltracode(transcript, stateDir, limits)).toBe(
				true,
			);
		});
	});

	test("rejects a state file with an invalid offset", async () => {
		writeFileSync(transcript, enterLine());
		await readTranscriptUltracode(transcript, stateDir);
		const [file] = readdirSync(stateDir);
		writeFileSync(
			join(stateDir, file ?? "x"),
			JSON.stringify({ path: transcript, offset: -5, marker: false }),
		);
		expect(await readTranscriptUltracode(transcript, stateDir)).toBe(true);
	});

	test("still works when the state directory cannot be created", async () => {
		writeFileSync(transcript, enterLine());
		const blocked = join(dir, "blocked");
		writeFileSync(blocked, "a file, not a directory");
		expect(await readTranscriptUltracode(transcript, blocked)).toBe(true);
	});
});
