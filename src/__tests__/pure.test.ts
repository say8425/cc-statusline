import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { C, getUsageColor } from "../colors.ts";
import {
	ciStatusIcon,
	formatNumber,
	formatResetDate,
	formatTime,
	getTimeUntilReset,
	prStateColor,
	prStateText,
	toFileUrl,
} from "../format/index.ts";

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

describe("formatResetDate", () => {
	test("formats date as MM/DD HH:MM", () => {
		const date = new Date(2024, 1, 15, 17, 0);
		expect(formatResetDate(date)).toBe("02/15 17:00");
	});

	test("zero-pads month, day, hours, minutes", () => {
		const date = new Date(2024, 0, 5, 3, 7);
		expect(formatResetDate(date)).toBe("01/05 03:07");
	});

	test("handles midnight", () => {
		const date = new Date(2024, 2, 1, 0, 0);
		expect(formatResetDate(date)).toBe("03/01 00:00");
	});

	test("handles end of day", () => {
		const date = new Date(2024, 11, 31, 23, 59);
		expect(formatResetDate(date)).toBe("12/31 23:59");
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

describe("toFileUrl", () => {
	test("converts a POSIX absolute path", () => {
		expect(toFileUrl("/Users/test/my-project")).toBe(
			"file:///Users/test/my-project",
		);
	});

	test("percent-encodes spaces", () => {
		expect(toFileUrl("/Users/test/my project")).toBe(
			"file:///Users/test/my%20project",
		);
	});

	test("converts a Windows path with a drive letter", () => {
		expect(toFileUrl("C:\\Users\\test\\project")).toBe(
			"file:///C:/Users/test/project",
		);
	});

	test("converts a Windows UNC-style backslash path under a drive", () => {
		expect(toFileUrl("D:\\work\\my project")).toBe(
			"file:///D:/work/my%20project",
		);
	});

	test("returns file:/// for an empty string (callers guard against this)", () => {
		expect(toFileUrl("")).toBe("file:///");
	});

	test("does not throw for a path containing an unpaired surrogate", () => {
		const path = "/Users/test/\uD800-weird";
		expect(() => toFileUrl(path)).not.toThrow();
		expect(toFileUrl(path)).toBe("file:///Users/test/%EF%BF%BD-weird");
	});

	test("escapes control characters even when the fallback path is taken", () => {
		// Regression test for a terminal-escape-injection finding: when
		// encodeURI throws (unpaired surrogate), the fallback must still
		// percent-encode any raw BEL/ESC bytes in the path, or they could
		// break out of the OSC 8 hyperlink this URL gets embedded in.
		const path = "/foo\uD800\x07\x1b bar";
		const result = toFileUrl(path);
		expect(result).not.toContain("\x07");
		expect(result).not.toContain("\x1b");
		expect(result).toBe("file:///foo%EF%BF%BD%07%1B%20bar");
	});
});

describe("prStateText", () => {
	test("returns Open for a non-draft open PR", () => {
		expect(prStateText("OPEN", false)).toBe("Open");
	});

	test("returns Draft for a draft open PR", () => {
		expect(prStateText("OPEN", true)).toBe("Draft");
	});

	test("returns Merged for a merged PR", () => {
		expect(prStateText("MERGED", false)).toBe("Merged");
	});

	test("returns Closed for a closed PR", () => {
		expect(prStateText("CLOSED", false)).toBe("Closed");
	});

	test("returns Draft even when state is MERGED (draft always wins)", () => {
		expect(prStateText("MERGED", true)).toBe("Draft");
	});

	test("returns Draft even when state is CLOSED (draft always wins)", () => {
		expect(prStateText("CLOSED", true)).toBe("Draft");
	});
});

describe("prStateColor", () => {
	test("returns GREEN for a non-draft open PR", () => {
		expect(prStateColor("OPEN", false)).toBe(C.GREEN);
	});

	test("returns WHITE for a draft open PR", () => {
		expect(prStateColor("OPEN", true)).toBe(C.WHITE);
	});

	test("returns MAGENTA for a merged PR", () => {
		expect(prStateColor("MERGED", false)).toBe(C.MAGENTA);
	});

	test("returns RED for a closed PR", () => {
		expect(prStateColor("CLOSED", false)).toBe(C.RED);
	});

	test("returns WHITE even when state is MERGED (draft always wins)", () => {
		expect(prStateColor("MERGED", true)).toBe(C.WHITE);
	});

	test("returns WHITE even when state is CLOSED (draft always wins)", () => {
		expect(prStateColor("CLOSED", true)).toBe(C.WHITE);
	});
});

describe("ciStatusIcon", () => {
	test("returns a check mark for success", () => {
		expect(ciStatusIcon("success")).toBe("✅");
	});

	test("returns a yellow circle for pending", () => {
		expect(ciStatusIcon("pending")).toBe("🟡");
	});

	test("returns a cross mark for failure", () => {
		expect(ciStatusIcon("failure")).toBe("❌");
	});

	test("returns an empty string for null", () => {
		expect(ciStatusIcon(null)).toBe("");
	});
});
