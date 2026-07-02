import { describe, expect, test } from "bun:test";
import { isLargeFile, LARGE_FILE_LINE_THRESHOLD } from "../viewer/largeFile.ts";

describe("isLargeFile", () => {
	test("known lockfile (by basename) is large regardless of size", () => {
		expect(isLargeFile("frontend/pnpm-lock.yaml", 0)).toBe(true);
		expect(isLargeFile("yarn.lock", 3)).toBe(true);
		expect(isLargeFile("go.sum", 1)).toBe(true);
	});
	test("non-lockfile under threshold is not large", () => {
		expect(isLargeFile("src/app.ts", 100)).toBe(false);
	});
	test("threshold is strict: exactly the threshold is not large", () => {
		expect(isLargeFile("src/app.ts", LARGE_FILE_LINE_THRESHOLD)).toBe(false);
	});
	test("non-lockfile over threshold is large", () => {
		expect(isLargeFile("src/generated.ts", LARGE_FILE_LINE_THRESHOLD + 1)).toBe(
			true,
		);
	});
	test("a name that merely contains a lockfile substring is not matched", () => {
		expect(isLargeFile("src/yarn.lock.ts", 5)).toBe(false);
	});
});
