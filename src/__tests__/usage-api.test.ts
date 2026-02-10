import { describe, expect, test } from "bun:test";
import type { UsageAPIResponse } from "../types.ts";
import { usageResponseToBlockUsage } from "../usage/api.ts";

describe("usageResponseToBlockUsage", () => {
	test("extracts five_hour utilization and resets_at", () => {
		const data: UsageAPIResponse = {
			five_hour: { utilization: 56, resets_at: "2024-01-01T15:00:00Z" },
			seven_day: null,
			seven_day_oauth_apps: null,
			seven_day_opus: null,
			iguana_necktie: null,
		};

		const result = usageResponseToBlockUsage(data);

		expect(result.utilization).toBe(56);
		expect(result.resetTime).toEqual(new Date("2024-01-01T15:00:00Z"));
		expect(result.sevenDayUtilization).toBeNull();
	});

	test("handles five_hour.resets_at being null", () => {
		const data: UsageAPIResponse = {
			five_hour: { utilization: 30, resets_at: null },
			seven_day: null,
			seven_day_oauth_apps: null,
			seven_day_opus: null,
			iguana_necktie: null,
		};

		const result = usageResponseToBlockUsage(data);

		expect(result.utilization).toBe(30);
		expect(result.resetTime).toBeNull();
	});

	test("extracts seven_day utilization", () => {
		const data: UsageAPIResponse = {
			five_hour: { utilization: 56, resets_at: "2024-01-01T15:00:00Z" },
			seven_day: { utilization: 37, resets_at: "2024-01-07T00:00:00Z" },
			seven_day_oauth_apps: null,
			seven_day_opus: null,
			iguana_necktie: null,
		};

		const result = usageResponseToBlockUsage(data);

		expect(result.utilization).toBe(56);
		expect(result.sevenDayUtilization).toBe(37);
	});

	test("returns defaults when five_hour is null", () => {
		const data: UsageAPIResponse = {
			five_hour: null,
			seven_day: { utilization: 20, resets_at: null },
			seven_day_oauth_apps: null,
			seven_day_opus: null,
			iguana_necktie: null,
		};

		const result = usageResponseToBlockUsage(data);

		expect(result.utilization).toBe(0);
		expect(result.resetTime).toBeNull();
		expect(result.sevenDayUtilization).toBe(20);
	});

	test("returns all defaults when both are null", () => {
		const data: UsageAPIResponse = {
			five_hour: null,
			seven_day: null,
			seven_day_oauth_apps: null,
			seven_day_opus: null,
			iguana_necktie: null,
		};

		const result = usageResponseToBlockUsage(data);

		expect(result.utilization).toBe(0);
		expect(result.resetTime).toBeNull();
		expect(result.sevenDayUtilization).toBeNull();
	});
});
