import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import {
	C,
	calculateBurnRate,
	formatNumber,
	formatTime,
	formatTokensK,
	getTimeUntilReset,
	getUsageColor,
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
