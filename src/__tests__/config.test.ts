import { describe, expect, test } from "bun:test";
import { isCostVisible } from "../config.ts";

describe("isCostVisible", () => {
	test("defaults to false when the env var is unset", () => {
		expect(isCostVisible({})).toBe(false);
	});

	test("returns true when CC_STATUSLINE_SHOW_COST is 1", () => {
		expect(isCostVisible({ CC_STATUSLINE_SHOW_COST: "1" })).toBe(true);
	});

	test("returns false for any other value", () => {
		// "1" 리터럴만 참 — CC_STATUSLINE_DIFF_DISABLE과 같은 규칙
		expect(isCostVisible({ CC_STATUSLINE_SHOW_COST: "0" })).toBe(false);
		expect(isCostVisible({ CC_STATUSLINE_SHOW_COST: "true" })).toBe(false);
		expect(isCostVisible({ CC_STATUSLINE_SHOW_COST: "" })).toBe(false);
	});
});
