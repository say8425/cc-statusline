import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import {
	C,
	calculateBurnRate,
	findActiveBlockEntries,
	formatNumber,
	formatTime,
	formatTokensK,
	getTimeUntilReset,
	getUsageColor,
	type JSONLAssistantEntry,
} from "../lib.ts";

describe("getUsageColor", () => {
	test("returns WHITE for 0%", () => {
		expect(getUsageColor(0)).toBe(C.WHITE);
	});

	test("returns WHITE for 49%", () => {
		expect(getUsageColor(49)).toBe(C.WHITE);
	});

	test("returns YELLOW for 50%", () => {
		expect(getUsageColor(50)).toBe(C.YELLOW);
	});

	test("returns YELLOW for 79%", () => {
		expect(getUsageColor(79)).toBe(C.YELLOW);
	});

	test("returns RED for 80%", () => {
		expect(getUsageColor(80)).toBe(C.RED);
	});

	test("returns RED for 100%", () => {
		expect(getUsageColor(100)).toBe(C.RED);
	});
});

describe("formatNumber", () => {
	test("formats 0", () => {
		expect(formatNumber(0)).toBe("0");
	});

	test("formats 100", () => {
		expect(formatNumber(100)).toBe("100");
	});

	test("formats 1234 with comma", () => {
		expect(formatNumber(1234)).toBe("1,234");
	});

	test("formats 1234567 with commas", () => {
		expect(formatNumber(1234567)).toBe("1,234,567");
	});
});

describe("formatTime", () => {
	test("formats (0, 0) as 00:00", () => {
		expect(formatTime(0, 0)).toBe("00:00");
	});

	test("formats (1, 5) as 01:05", () => {
		expect(formatTime(1, 5)).toBe("01:05");
	});

	test("formats (12, 45) as 12:45", () => {
		expect(formatTime(12, 45)).toBe("12:45");
	});
});

describe("formatTokensK", () => {
	test("formats 0 as '0'", () => {
		expect(formatTokensK(0)).toBe("0");
	});

	test("formats 500 as '500'", () => {
		expect(formatTokensK(500)).toBe("500");
	});

	test("formats 999 as '999'", () => {
		expect(formatTokensK(999)).toBe("999");
	});

	test("formats 1000 as '1K'", () => {
		expect(formatTokensK(1000)).toBe("1K");
	});

	test("formats 1500 as '2K' (rounds)", () => {
		expect(formatTokensK(1500)).toBe("2K");
	});

	test("formats 450000 as '450K'", () => {
		expect(formatTokensK(450000)).toBe("450K");
	});
});

describe("getTimeUntilReset", () => {
	afterEach(() => {
		setSystemTime(); // Reset to real time
	});

	test("returns hours and minutes for future time (2h later)", () => {
		const now = new Date("2024-01-01T10:00:00Z");
		setSystemTime(now);

		const resetTime = new Date("2024-01-01T12:00:00Z");
		expect(getTimeUntilReset(resetTime)).toEqual({ hours: 2, minutes: 0 });
	});

	test("returns hours and minutes for future time (30m later)", () => {
		const now = new Date("2024-01-01T10:00:00Z");
		setSystemTime(now);

		const resetTime = new Date("2024-01-01T10:30:00Z");
		expect(getTimeUntilReset(resetTime)).toEqual({ hours: 0, minutes: 30 });
	});

	test("returns 0:0 for past time", () => {
		const now = new Date("2024-01-01T12:00:00Z");
		setSystemTime(now);

		const resetTime = new Date("2024-01-01T10:00:00Z");
		expect(getTimeUntilReset(resetTime)).toEqual({ hours: 0, minutes: 0 });
	});

	test("returns mixed hours and minutes", () => {
		const now = new Date("2024-01-01T10:00:00Z");
		setSystemTime(now);

		const resetTime = new Date("2024-01-01T12:45:00Z");
		expect(getTimeUntilReset(resetTime)).toEqual({ hours: 2, minutes: 45 });
	});
});

describe("calculateBurnRate", () => {
	afterEach(() => {
		setSystemTime(); // Reset to real time
	});

	test("returns 0 when blockStartTime is null", () => {
		expect(calculateBurnRate(10000, null)).toBe(0);
	});

	test("returns 0 when blockTokens is 0", () => {
		const startTime = Date.now() - 5 * 60 * 1000; // 5 minutes ago
		expect(calculateBurnRate(0, startTime)).toBe(0);
	});

	test("returns 0 when elapsed time is less than 1 minute", () => {
		const now = Date.now();
		setSystemTime(now);

		const startTime = now - 30 * 1000; // 30 seconds ago
		expect(calculateBurnRate(10000, startTime)).toBe(0);
	});

	test("calculates correct burn rate for normal case", () => {
		const now = Date.now();
		setSystemTime(now);

		const startTime = now - 5 * 60 * 1000; // 5 minutes ago
		const tokens = 10000;

		// 10000 tokens / 5 minutes = 2000 tokens/min
		expect(calculateBurnRate(tokens, startTime)).toBe(2000);
	});

	test("rounds burn rate to nearest integer", () => {
		const now = Date.now();
		setSystemTime(now);

		const startTime = now - 3 * 60 * 1000; // 3 minutes ago
		const tokens = 10000;

		// 10000 tokens / 3 minutes = 3333.33... tokens/min -> rounds to 3333
		expect(calculateBurnRate(tokens, startTime)).toBe(3333);
	});
});

describe("findActiveBlockEntries", () => {
	function makeEntry(timestamp: string): JSONLAssistantEntry {
		return {
			type: "assistant",
			timestamp,
			message: {
				model: "claude-sonnet-4-20250514",
				usage: {
					input_tokens: 100,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
					output_tokens: 50,
				},
			},
		};
	}

	afterEach(() => {
		setSystemTime();
	});

	test("returns empty array for empty input", () => {
		expect(findActiveBlockEntries([])).toEqual([]);
	});

	test("returns entries within a single block", () => {
		const now = new Date("2024-01-01T12:30:00Z");
		setSystemTime(now);

		const entries = [
			makeEntry("2024-01-01T10:15:00Z"),
			makeEntry("2024-01-01T11:00:00Z"),
			makeEntry("2024-01-01T12:00:00Z"),
		];

		const result = findActiveBlockEntries(entries);
		expect(result.length).toBe(3);
	});

	test("returns empty array when current time is past block end", () => {
		// Block: 10:15 → floor=10:00 → blockEnd=15:00
		// now = 16:00 → past blockEnd
		const now = new Date("2024-01-01T16:00:00Z");
		setSystemTime(now);

		const entries = [
			makeEntry("2024-01-01T10:15:00Z"),
			makeEntry("2024-01-01T11:00:00Z"),
		];

		const result = findActiveBlockEntries(entries);
		expect(result.length).toBe(0);
	});

	test("starts new block when cumulative time exceeds 5 hours", () => {
		// Entry at 01:30, then entries continue until 06:27
		// blockStartTs = 01:30, timeSinceBlockStart at 06:30 = 5h → new block
		const now = new Date("2024-01-01T07:00:00Z");
		setSystemTime(now);

		const entries = [
			makeEntry("2024-01-01T01:30:00Z"), // block1 start
			makeEntry("2024-01-01T03:00:00Z"),
			makeEntry("2024-01-01T05:00:00Z"),
			makeEntry("2024-01-01T06:30:00Z"), // 5h from 01:30 → new block
			makeEntry("2024-01-01T06:45:00Z"),
		];

		const result = findActiveBlockEntries(entries);
		// Only the last 2 entries (new block starting at 06:30)
		expect(result.length).toBe(2);
		expect(result[0].timestamp).toBe("2024-01-01T06:30:00Z");
		expect(result[1].timestamp).toBe("2024-01-01T06:45:00Z");
	});

	test("starts new block on inactivity gap >= 5 hours", () => {
		const now = new Date("2024-01-01T19:00:00Z");
		setSystemTime(now);

		const entries = [
			makeEntry("2024-01-01T08:00:00Z"), // block1
			makeEntry("2024-01-01T09:00:00Z"),
			// 5h+ gap
			makeEntry("2024-01-01T15:00:00Z"), // block2 start (6h gap from 09:00)
			makeEntry("2024-01-01T16:00:00Z"),
		];

		const result = findActiveBlockEntries(entries);
		expect(result.length).toBe(2);
		expect(result[0].timestamp).toBe("2024-01-01T15:00:00Z");
	});

	test("continuous activity spanning 5h boundary creates new block (real scenario)", () => {
		// Simulates the real bug: 383 entries from 01:34~06:27 UTC continuous activity
		// /usage says block is 06:00~11:00 → entries after 06:34 (5h from 01:34) should be new block
		const now = new Date("2024-01-01T06:51:00Z");
		setSystemTime(now);

		const entries = [
			makeEntry("2024-01-01T01:34:00Z"), // block1 start
			makeEntry("2024-01-01T02:00:00Z"),
			makeEntry("2024-01-01T03:00:00Z"),
			makeEntry("2024-01-01T04:00:00Z"),
			makeEntry("2024-01-01T05:00:00Z"),
			makeEntry("2024-01-01T06:00:00Z"),
			makeEntry("2024-01-01T06:27:00Z"),
			// At 06:34, timeSinceBlockStart = 5h from 01:34 → new block
			makeEntry("2024-01-01T06:34:00Z"), // new block starts here
			makeEntry("2024-01-01T06:45:00Z"),
		];

		const result = findActiveBlockEntries(entries);
		// New block: 06:34 onwards, blockStart floor = 06:00, blockEnd = 11:00
		// now (06:51) < blockEnd (11:00) → returns entries
		expect(result.length).toBe(2);
		expect(result[0].timestamp).toBe("2024-01-01T06:34:00Z");
	});

	test("sorts entries by timestamp before processing", () => {
		const now = new Date("2024-01-01T12:00:00Z");
		setSystemTime(now);

		// Out of order
		const entries = [
			makeEntry("2024-01-01T11:00:00Z"),
			makeEntry("2024-01-01T10:00:00Z"),
			makeEntry("2024-01-01T10:30:00Z"),
		];

		const result = findActiveBlockEntries(entries);
		expect(result.length).toBe(3);
		// Should be sorted
		expect(result[0].timestamp).toBe("2024-01-01T10:00:00Z");
		expect(result[1].timestamp).toBe("2024-01-01T10:30:00Z");
		expect(result[2].timestamp).toBe("2024-01-01T11:00:00Z");
	});

	test("single entry within block window", () => {
		const now = new Date("2024-01-01T11:00:00Z");
		setSystemTime(now);

		const entries = [makeEntry("2024-01-01T10:30:00Z")];

		const result = findActiveBlockEntries(entries);
		expect(result.length).toBe(1);
	});
});
