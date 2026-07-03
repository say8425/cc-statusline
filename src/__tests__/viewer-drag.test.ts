import { describe, expect, test } from "bun:test";
import { movedBeyondThreshold } from "../viewer/drag.ts";

describe("movedBeyondThreshold", () => {
	test("no movement is not a drag", () => {
		expect(movedBeyondThreshold({ x: 10, y: 10 }, { x: 10, y: 10 }, 6)).toBe(
			false,
		);
	});
	test("movement within threshold is not a drag", () => {
		expect(movedBeyondThreshold({ x: 0, y: 0 }, { x: 5, y: 0 }, 6)).toBe(false);
	});
	test("movement exactly at threshold is not a drag (strict >)", () => {
		expect(movedBeyondThreshold({ x: 0, y: 0 }, { x: 6, y: 0 }, 6)).toBe(false);
	});
	test("movement beyond threshold is a drag", () => {
		expect(movedBeyondThreshold({ x: 0, y: 0 }, { x: 7, y: 0 }, 6)).toBe(true);
	});
	test("diagonal distance is euclidean (3,4 -> 5)", () => {
		expect(movedBeyondThreshold({ x: 0, y: 0 }, { x: 3, y: 4 }, 6)).toBe(false);
		expect(movedBeyondThreshold({ x: 0, y: 0 }, { x: 3, y: 4 }, 4)).toBe(true);
	});
});
