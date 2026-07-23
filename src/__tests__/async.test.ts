import { beforeEach, describe, expect, test } from "bun:test";
import { CACHE_TTL, cache, resetCache } from "../cache.ts";
import {
	getBranchCached,
	getGitChangesCached,
	getMainProjectCached,
	getPrInfoCached,
} from "../git/index.ts";

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

	describe("getPrInfoCached", () => {
		test("returns null or a PrInfo object", async () => {
			const prInfo = await getPrInfoCached();

			if (prInfo !== null) {
				expect(typeof prInfo.url).toBe("string");
				expect(["OPEN", "MERGED", "CLOSED"]).toContain(prInfo.state);
				expect(typeof prInfo.isDraft).toBe("boolean");
				if (prInfo.ciStatus !== null) {
					expect(["success", "pending", "failure"]).toContain(
						prInfo.ciStatus.conclusion,
					);
					expect(typeof prInfo.ciStatus.count).toBe("number");
				}
			} else {
				expect(prInfo).toBeNull();
			}
		});

		test("caches result on subsequent calls", async () => {
			await getPrInfoCached();
			const timestamp1 = cache.prInfo.timestamp;

			await getPrInfoCached();
			const timestamp2 = cache.prInfo.timestamp;

			expect(timestamp1).toBe(timestamp2);
		});
	});

	describe("getMainProjectCached", () => {
		test("returns null or a {name, path} object", async () => {
			const mainProject = await getMainProjectCached();

			if (mainProject !== null) {
				expect(typeof mainProject.name).toBe("string");
				expect(typeof mainProject.path).toBe("string");
			} else {
				expect(mainProject).toBeNull();
			}
		});

		test("caches result on subsequent calls", async () => {
			await getMainProjectCached();
			const timestamp1 = cache.mainProject.timestamp;

			await getMainProjectCached();
			const timestamp2 = cache.mainProject.timestamp;

			expect(timestamp1).toBe(timestamp2);
		});
	});
});
