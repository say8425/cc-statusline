import { describe, expect, test } from "bun:test";
import { aggregateCiStatus } from "../git/ciStatus.ts";

describe("aggregateCiStatus", () => {
	test("returns null for an empty array", () => {
		expect(aggregateCiStatus([])).toBeNull();
	});

	test("returns success with a count when all CheckRuns succeed", () => {
		expect(
			aggregateCiStatus([
				{ status: "COMPLETED", conclusion: "SUCCESS" },
				{ status: "COMPLETED", conclusion: "NEUTRAL" },
			]),
		).toEqual({ conclusion: "success", count: 2 });
	});

	test("returns failure with the failed count when some CheckRuns fail", () => {
		expect(
			aggregateCiStatus([
				{ status: "COMPLETED", conclusion: "SUCCESS" },
				{ status: "COMPLETED", conclusion: "FAILURE" },
				{ status: "COMPLETED", conclusion: "FAILURE" },
			]),
		).toEqual({ conclusion: "failure", count: 2 });
	});

	test("returns pending with the pending count when CheckRuns are still in progress", () => {
		expect(
			aggregateCiStatus([
				{ status: "COMPLETED", conclusion: "SUCCESS" },
				{ status: "IN_PROGRESS" },
				{ status: "QUEUED" },
			]),
		).toEqual({ conclusion: "pending", count: 2 });
	});

	test("returns success with a count for a passing legacy StatusContext", () => {
		expect(aggregateCiStatus([{ state: "SUCCESS" }])).toEqual({
			conclusion: "success",
			count: 1,
		});
	});

	test("returns failure with a count for a failing legacy StatusContext", () => {
		expect(aggregateCiStatus([{ state: "ERROR" }])).toEqual({
			conclusion: "failure",
			count: 1,
		});
	});

	test("returns pending with a count for a pending legacy StatusContext", () => {
		expect(aggregateCiStatus([{ state: "PENDING" }])).toEqual({
			conclusion: "pending",
			count: 1,
		});
	});

	test("handles a mix of CheckRun and StatusContext items", () => {
		expect(
			aggregateCiStatus([
				{ status: "COMPLETED", conclusion: "SUCCESS" },
				{ state: "SUCCESS" },
			]),
		).toEqual({ conclusion: "success", count: 2 });
	});

	test("failure wins over pending, and the count reflects only the failed items", () => {
		expect(
			aggregateCiStatus([
				{ status: "IN_PROGRESS" },
				{ state: "ERROR" },
				{ status: "COMPLETED", conclusion: "FAILURE" },
			]),
		).toEqual({ conclusion: "failure", count: 2 });
	});
});
