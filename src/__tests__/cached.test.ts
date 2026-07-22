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

	describe("mainProject cache", () => {
		test("cache hit when timestamp is fresh", () => {
			cache.mainProject = {
				value: { name: "cc-statusline", path: "/Users/test/cc-statusline" },
				timestamp: Date.now(),
			};

			const isFresh =
				Date.now() - cache.mainProject.timestamp < CACHE_TTL.mainProject;
			expect(isFresh).toBe(true);
			expect(cache.mainProject.value).toEqual({
				name: "cc-statusline",
				path: "/Users/test/cc-statusline",
			});
		});

		test("cache miss when timestamp is stale", () => {
			const now = Date.now();
			setSystemTime(now);

			cache.mainProject = {
				value: { name: "cc-statusline", path: "/Users/test/cc-statusline" },
				timestamp: now - CACHE_TTL.mainProject - 1000,
			};

			const isFresh = now - cache.mainProject.timestamp < CACHE_TTL.mainProject;
			expect(isFresh).toBe(false);
		});

		test("cache stores null for non-worktree repo", () => {
			cache.mainProject = { value: null, timestamp: Date.now() };
			expect(cache.mainProject.value).toBeNull();
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
			cache.mainProject = {
				value: { name: "cc-statusline", path: "/Users/test/cc-statusline" },
				timestamp: Date.now(),
			};
			cache.ultracode = { value: true, timestamp: Date.now() };

			resetCache();

			expect(cache.branch).toEqual({ value: "", timestamp: 0 });
			expect(cache.gitChanges).toEqual({
				files: 0,
				insertions: 0,
				deletions: 0,
				timestamp: 0,
			});
			expect(cache.prUrl).toEqual({ value: null, timestamp: 0 });
			expect(cache.mainProject).toEqual({ value: null, timestamp: 0 });
			expect(cache.ultracode).toEqual({ value: false, timestamp: 0 });
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

	test("mainProject TTL is 300 seconds (5 minutes)", () => {
		expect(CACHE_TTL.mainProject).toBe(300000);
	});

	test("ultracode TTL is 5 seconds", () => {
		expect(CACHE_TTL.ultracode).toBe(5000);
	});
});
