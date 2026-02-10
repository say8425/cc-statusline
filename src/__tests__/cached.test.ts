import {
	afterEach,
	beforeEach,
	describe,
	expect,
	setSystemTime,
	test,
} from "bun:test";
import { CACHE_TTL, cache, resetCache } from "../cache.ts";

describe("cache mechanism", () => {
	beforeEach(() => {
		resetCache();
	});

	afterEach(() => {
		setSystemTime(); // Reset to real time
	});

	describe("branch cache", () => {
		test("cache hit when timestamp is fresh", () => {
			cache.branch = { value: "cached-branch", timestamp: Date.now() };

			// Fresh cache should be used (within TTL)
			const isFresh = Date.now() - cache.branch.timestamp < CACHE_TTL.branch;
			expect(isFresh).toBe(true);
			expect(cache.branch.value).toBe("cached-branch");
		});

		test("cache miss when timestamp is stale", () => {
			const now = Date.now();
			setSystemTime(now);

			cache.branch = {
				value: "old-branch",
				timestamp: now - CACHE_TTL.branch - 1000,
			};

			// Stale cache should trigger refresh
			const isFresh = now - cache.branch.timestamp < CACHE_TTL.branch;
			expect(isFresh).toBe(false);
		});
	});

	describe("gitChanges cache", () => {
		test("always cache miss when TTL is 0", () => {
			cache.gitChanges = {
				files: 5,
				insertions: 20,
				deletions: 10,
				timestamp: Date.now(),
			};

			// TTL이 0이면 항상 cache miss
			const isFresh =
				Date.now() - cache.gitChanges.timestamp < CACHE_TTL.gitChanges;
			expect(isFresh).toBe(false);
			expect(CACHE_TTL.gitChanges).toBe(0);
		});
	});

	describe("prUrl cache", () => {
		test("cache hit when timestamp is fresh", () => {
			cache.prUrl = {
				value: "https://github.com/test/repo/pull/1",
				timestamp: Date.now(),
			};

			const isFresh = Date.now() - cache.prUrl.timestamp < CACHE_TTL.prUrl;
			expect(isFresh).toBe(true);
			expect(cache.prUrl.value).toBe("https://github.com/test/repo/pull/1");
		});

		test("cache miss when timestamp is stale", () => {
			const now = Date.now();
			setSystemTime(now);

			cache.prUrl = {
				value: "https://github.com/old/url/pull/1",
				timestamp: now - CACHE_TTL.prUrl - 1000,
			};

			const isFresh = now - cache.prUrl.timestamp < CACHE_TTL.prUrl;
			expect(isFresh).toBe(false);
		});

		test("cache stores null for no PR", () => {
			cache.prUrl = { value: null, timestamp: Date.now() };
			expect(cache.prUrl.value).toBeNull();
		});
	});

	describe("blockUsage cache", () => {
		test("cache hit when timestamp is fresh", () => {
			const blockUsageValue = {
				resetTime: new Date("2024-01-01T15:00:00Z"),
				utilization: 56,
				sevenDayUtilization: 37,
			};
			cache.blockUsage = { value: blockUsageValue, timestamp: Date.now() };

			const isFresh =
				Date.now() - cache.blockUsage.timestamp < CACHE_TTL.blockUsage;
			expect(isFresh).toBe(true);
			expect(cache.blockUsage.value).toEqual(blockUsageValue);
		});

		test("cache miss when timestamp is stale", () => {
			const now = Date.now();
			setSystemTime(now);

			cache.blockUsage = {
				value: {
					resetTime: null,
					utilization: 0,
					sevenDayUtilization: null,
				},
				timestamp: now - CACHE_TTL.blockUsage - 1000,
			};

			const isFresh = now - cache.blockUsage.timestamp < CACHE_TTL.blockUsage;
			expect(isFresh).toBe(false);
		});
	});

	describe("accessToken cache", () => {
		test("cache hit when timestamp is fresh", () => {
			cache.accessToken = { value: "test-token-123", timestamp: Date.now() };

			const isFresh =
				Date.now() - cache.accessToken.timestamp < CACHE_TTL.accessToken;
			expect(isFresh).toBe(true);
			expect(cache.accessToken.value).toBe("test-token-123");
		});

		test("cache miss when timestamp is stale", () => {
			const now = Date.now();
			setSystemTime(now);

			cache.accessToken = {
				value: "old-token",
				timestamp: now - CACHE_TTL.accessToken - 1000,
			};

			const isFresh = now - cache.accessToken.timestamp < CACHE_TTL.accessToken;
			expect(isFresh).toBe(false);
		});

		test("cache stores null when no token available", () => {
			cache.accessToken = { value: null, timestamp: Date.now() };
			expect(cache.accessToken.value).toBeNull();
		});
	});

	describe("resetCache", () => {
		test("resets all cache values to defaults", () => {
			// Populate all caches
			cache.branch = { value: "test-branch", timestamp: Date.now() };
			cache.gitChanges = {
				files: 10,
				insertions: 50,
				deletions: 20,
				timestamp: Date.now(),
			};
			cache.prUrl = { value: "https://example.com", timestamp: Date.now() };
			cache.blockUsage = {
				value: {
					resetTime: new Date(),
					utilization: 56,
					sevenDayUtilization: 37,
				},
				timestamp: Date.now(),
			};
			cache.accessToken = { value: "test-token", timestamp: Date.now() };

			resetCache();

			expect(cache.branch).toEqual({ value: "", timestamp: 0 });
			expect(cache.gitChanges).toEqual({
				files: 0,
				insertions: 0,
				deletions: 0,
				timestamp: 0,
			});
			expect(cache.prUrl).toEqual({ value: null, timestamp: 0 });
			expect(cache.blockUsage).toEqual({ value: null, timestamp: 0 });
			expect(cache.accessToken).toEqual({ value: null, timestamp: 0 });
		});
	});
});

describe("CACHE_TTL values", () => {
	test("branch TTL is 5 seconds", () => {
		expect(CACHE_TTL.branch).toBe(5000);
	});

	test("gitChanges TTL is 0 (no cache)", () => {
		expect(CACHE_TTL.gitChanges).toBe(0);
	});

	test("prUrl TTL is 30 seconds", () => {
		expect(CACHE_TTL.prUrl).toBe(30000);
	});

	test("blockUsage TTL is 120 seconds", () => {
		expect(CACHE_TTL.blockUsage).toBe(120000);
	});

	test("accessToken TTL is 300 seconds (5 minutes)", () => {
		expect(CACHE_TTL.accessToken).toBe(300000);
	});
});
