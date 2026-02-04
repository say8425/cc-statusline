import { describe, expect, test } from "bun:test";
import { PLAN_LIMITS, parseCliArgs } from "../lib.ts";

describe("parseCliArgs", () => {
	test("returns default values for empty args", () => {
		const result = parseCliArgs([]);
		expect(result).toEqual({
			noUsage: false,
			blockTokenLimit: PLAN_LIMITS.pro,
		});
	});

	test("parses --no-usage flag", () => {
		const result = parseCliArgs(["--no-usage"]);
		expect(result.noUsage).toBe(true);
		expect(result.blockTokenLimit).toBe(PLAN_LIMITS.pro);
	});

	test("parses --plan max5x", () => {
		const result = parseCliArgs(["--plan", "max5x"]);
		expect(result.noUsage).toBe(false);
		expect(result.blockTokenLimit).toBe(PLAN_LIMITS.max5x);
	});

	test("parses --plan max20x", () => {
		const result = parseCliArgs(["--plan", "max20x"]);
		expect(result.noUsage).toBe(false);
		expect(result.blockTokenLimit).toBe(PLAN_LIMITS.max20x);
	});

	test("parses --plan pro explicitly", () => {
		const result = parseCliArgs(["--plan", "pro"]);
		expect(result.noUsage).toBe(false);
		expect(result.blockTokenLimit).toBe(PLAN_LIMITS.pro);
	});

	test("falls back to pro for invalid plan", () => {
		const result = parseCliArgs(["--plan", "invalid"]);
		expect(result.blockTokenLimit).toBe(PLAN_LIMITS.pro);
	});

	test("combines --no-usage with --plan", () => {
		const result = parseCliArgs(["--no-usage", "--plan", "max5x"]);
		expect(result.noUsage).toBe(true);
		expect(result.blockTokenLimit).toBe(PLAN_LIMITS.max5x);
	});

	test("handles --plan at end without value (falls back to default)", () => {
		const result = parseCliArgs(["--plan"]);
		expect(result.blockTokenLimit).toBe(PLAN_LIMITS.pro);
	});
});
