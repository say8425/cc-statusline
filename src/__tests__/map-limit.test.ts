import { describe, expect, test } from "bun:test";
import { mapWithLimit } from "../diff-server/mapLimit.ts";

describe("mapWithLimit", () => {
	test("preserves input order in results", async () => {
		const items = [50, 10, 30, 5, 40];
		const results = await mapWithLimit(items, 2, async (ms) => {
			await new Promise((resolve) => setTimeout(resolve, ms));
			return ms * 2;
		});
		expect(results).toEqual([100, 20, 60, 10, 80]);
	});

	test("never runs more than the limit concurrently", async () => {
		let inFlight = 0;
		let maxInFlight = 0;
		await mapWithLimit(
			Array.from({ length: 20 }, (_, i) => i),
			4,
			async (i) => {
				inFlight += 1;
				maxInFlight = Math.max(maxInFlight, inFlight);
				await new Promise((resolve) => setTimeout(resolve, 5));
				inFlight -= 1;
				return i;
			},
		);
		expect(maxInFlight).toBeLessThanOrEqual(4);
		expect(maxInFlight).toBeGreaterThan(1);
	});

	test("rejects when a task throws", async () => {
		let message = "";
		try {
			await mapWithLimit([1, 2, 3], 2, (i) => {
				if (i === 2) throw new Error("boom");
				return Promise.resolve(i);
			});
		} catch (e) {
			message = e instanceof Error ? e.message : String(e);
		}
		expect(message).toBe("boom");
	});

	test("handles an empty list", async () => {
		expect(await mapWithLimit([], 4, (i) => Promise.resolve(i))).toEqual([]);
	});
});
