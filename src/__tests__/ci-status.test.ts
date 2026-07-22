import { describe, expect, test } from "bun:test";
import { aggregateCiStatus } from "../git/ciStatus.ts";

describe("aggregateCiStatus", () => {
	test("returns null for an empty array", () => {
		expect(aggregateCiStatus([])).toBeNull();
	});

	test("returns success when all CheckRuns succeed", () => {
		expect(
			aggregateCiStatus([
				{ status: "COMPLETED", conclusion: "SUCCESS" },
				{ status: "COMPLETED", conclusion: "NEUTRAL" },
			]),
		).toBe("success");
	});

	test("returns failure when any CheckRun fails", () => {
		expect(
			aggregateCiStatus([
				{ status: "COMPLETED", conclusion: "SUCCESS" },
				{ status: "COMPLETED", conclusion: "FAILURE" },
			]),
		).toBe("failure");
	});

	test("returns pending when a CheckRun is still in progress", () => {
		expect(
			aggregateCiStatus([
				{ status: "COMPLETED", conclusion: "SUCCESS" },
				{ status: "IN_PROGRESS" },
			]),
		).toBe("pending");
	});

	test("returns success for a passing legacy StatusContext", () => {
		expect(aggregateCiStatus([{ state: "SUCCESS" }])).toBe("success");
	});

	test("returns failure for a failing legacy StatusContext", () => {
		expect(aggregateCiStatus([{ state: "ERROR" }])).toBe("failure");
	});

	test("returns pending for a pending legacy StatusContext", () => {
		expect(aggregateCiStatus([{ state: "PENDING" }])).toBe("pending");
	});

	test("handles a mix of CheckRun and StatusContext items", () => {
		expect(
			aggregateCiStatus([
				{ status: "COMPLETED", conclusion: "SUCCESS" },
				{ state: "SUCCESS" },
			]),
		).toBe("success");
	});

	test("failure from any item wins over pending from another", () => {
		expect(
			aggregateCiStatus([{ status: "IN_PROGRESS" }, { state: "ERROR" }]),
		).toBe("failure");
	});
});
