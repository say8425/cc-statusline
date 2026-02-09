import { describe, expect, test } from "bun:test";
import { COST_LIMITS, parseCliArgs } from "../lib.ts";

describe("parseCliArgs", () => {
	test("returns null blockCostLimit when --plan is not specified", () => {
		const result = parseCliArgs([]);
		expect(result).toEqual({
			noUsage: false,
			blockCostLimit: null,
		});
	});

	test("parses --no-usage flag (blockCostLimit remains null)", () => {
		const result = parseCliArgs(["--no-usage"]);
		expect(result.noUsage).toBe(true);
		expect(result.blockCostLimit).toBeNull();
	});

	test("parses --plan max5x", () => {
		const result = parseCliArgs(["--plan", "max5x"]);
		expect(result.noUsage).toBe(false);
		expect(result.blockCostLimit).toBe(COST_LIMITS.max5x);
	});

	test("parses --plan max20x", () => {
		const result = parseCliArgs(["--plan", "max20x"]);
		expect(result.noUsage).toBe(false);
		expect(result.blockCostLimit).toBe(COST_LIMITS.max20x);
	});

	test("parses --plan pro explicitly", () => {
		const result = parseCliArgs(["--plan", "pro"]);
		expect(result.noUsage).toBe(false);
		expect(result.blockCostLimit).toBe(COST_LIMITS.pro);
	});

	test("falls back to pro for invalid plan", () => {
		const result = parseCliArgs(["--plan", "invalid"]);
		expect(result.blockCostLimit).toBe(COST_LIMITS.pro);
	});

	test("combines --no-usage with --plan", () => {
		const result = parseCliArgs(["--no-usage", "--plan", "max5x"]);
		expect(result.noUsage).toBe(true);
		expect(result.blockCostLimit).toBe(COST_LIMITS.max5x);
	});

	test("handles --plan at end without value (falls back to default)", () => {
		const result = parseCliArgs(["--plan"]);
		expect(result.blockCostLimit).toBe(COST_LIMITS.pro);
	});
});
