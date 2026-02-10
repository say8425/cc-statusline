import { describe, expect, test } from "bun:test";
import { parseCliArgs } from "../lib.ts";

describe("parseCliArgs", () => {
	test("returns showUsage false by default", () => {
		const result = parseCliArgs([]);
		expect(result).toEqual({
			showUsage: false,
		});
	});

	test("parses --show-usage flag", () => {
		const result = parseCliArgs(["--show-usage"]);
		expect(result.showUsage).toBe(true);
	});

	test("ignores unknown flags", () => {
		const result = parseCliArgs(["--unknown", "--other"]);
		expect(result.showUsage).toBe(false);
	});

	test("handles --show-usage with other args", () => {
		const result = parseCliArgs(["--show-usage", "--other"]);
		expect(result.showUsage).toBe(true);
	});
});
