import { beforeEach, describe, expect, test } from "bun:test";
import {
	CACHE_TTL,
	cache,
	getAccessToken,
	getAccessTokenCached,
	getBranchCached,
	getGitChangesCached,
	getPrUrlCached,
	getUsageCached,
	resetCache,
} from "../lib.ts";

// 이 테스트들은 실제 git/gh 명령어를 실행합니다.
// CI 환경에서는 git repo가 있어야 하고, gh가 설치되어 있어야 합니다.

describe("async functions (integration)", () => {
	beforeEach(() => {
		resetCache();
	});

	describe("getBranchCached", () => {
		test("returns current git branch", async () => {
			const branch = await getBranchCached();
			// Should return a string (might be empty if not in a git repo)
			expect(typeof branch).toBe("string");
		});

		test("caches result on subsequent calls", async () => {
			const branch1 = await getBranchCached();
			const timestamp1 = cache.branch.timestamp;

			// Second call should use cache
			const branch2 = await getBranchCached();
			const timestamp2 = cache.branch.timestamp;

			expect(branch1).toBe(branch2);
			expect(timestamp1).toBe(timestamp2); // Same timestamp = cache hit
		});

		test("refreshes after TTL expires", async () => {
			await getBranchCached();
			const oldTimestamp = cache.branch.timestamp;

			// Manually expire cache
			cache.branch.timestamp = Date.now() - CACHE_TTL.branch - 1000;

			await getBranchCached();
			const newTimestamp = cache.branch.timestamp;

			expect(newTimestamp).toBeGreaterThan(oldTimestamp);
		});
	});

	describe("getGitChangesCached", () => {
		test("returns git changes object", async () => {
			const changes = await getGitChangesCached();

			expect(typeof changes.files).toBe("number");
			expect(typeof changes.insertions).toBe("number");
			expect(typeof changes.deletions).toBe("number");
		});

		test("fetches fresh data on every call (TTL=0, no cache)", async () => {
			const changes1 = await getGitChangesCached();
			const timestamp1 = cache.gitChanges.timestamp;

			const changes2 = await getGitChangesCached();
			const timestamp2 = cache.gitChanges.timestamp;

			expect(changes1.files).toBe(changes2.files);
			// TTL이 0이므로 매번 새로 fetch하여 timestamp가 갱신됨
			expect(timestamp2).toBeGreaterThanOrEqual(timestamp1);
		});
	});

	describe("getPrUrlCached", () => {
		test("returns PR URL or null", async () => {
			const prUrl = await getPrUrlCached();

			// Should be string (URL) or null
			expect(prUrl === null || typeof prUrl === "string").toBe(true);
		});

		test("caches result on subsequent calls", async () => {
			await getPrUrlCached();
			const timestamp1 = cache.prUrl.timestamp;

			await getPrUrlCached();
			const timestamp2 = cache.prUrl.timestamp;

			expect(timestamp1).toBe(timestamp2);
		});
	});

	describe("getAccessToken", () => {
		test("returns a string or null", async () => {
			const token = await getAccessToken();
			expect(token === null || typeof token === "string").toBe(true);
		});
	});

	describe("getAccessTokenCached", () => {
		test("returns a string or null", async () => {
			const token = await getAccessTokenCached();
			expect(token === null || typeof token === "string").toBe(true);
		});

		test("caches result on subsequent calls", async () => {
			// Pre-populate cache to avoid Keychain call
			cache.accessToken = { value: "test-token-123", timestamp: Date.now() };

			await getAccessTokenCached();
			const timestamp1 = cache.accessToken.timestamp;

			await getAccessTokenCached();
			const timestamp2 = cache.accessToken.timestamp;

			expect(timestamp1).toBe(timestamp2);
			expect(cache.accessToken.value).toBe("test-token-123");
		});
	});

	describe("getUsageCached", () => {
		test("returns BlockUsageInfo or null", async () => {
			const usage = await getUsageCached();

			// Should return BlockUsageInfo object or null (if no token/API fails)
			if (usage !== null) {
				expect(usage).toHaveProperty("utilization");
				expect(usage).toHaveProperty("sevenDayUtilization");
				expect(usage).toHaveProperty("resetTime");
			}
		});

		test("caches result on subsequent calls", async () => {
			// Pre-populate cache to avoid API call
			cache.blockUsage = {
				value: {
					resetTime: null,
					utilization: 56,
					sevenDayUtilization: 37,
				},
				timestamp: Date.now(),
			};

			await getUsageCached();
			const timestamp1 = cache.blockUsage.timestamp;

			await getUsageCached();
			const timestamp2 = cache.blockUsage.timestamp;

			expect(timestamp1).toBe(timestamp2);
		});
	});
});
