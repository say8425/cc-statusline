// 캐시 구조
export const cache = {
	branch: { value: "", timestamp: 0 },
	gitChanges: { files: 0, insertions: 0, deletions: 0, timestamp: 0 },
	prUrl: { value: null as string | null, timestamp: 0 },
	mainProjectName: { value: null as string | null, timestamp: 0 },
};

// 캐시 초기화 (테스트용)
export function resetCache(): void {
	cache.branch = { value: "", timestamp: 0 };
	cache.gitChanges = { files: 0, insertions: 0, deletions: 0, timestamp: 0 };
	cache.prUrl = { value: null, timestamp: 0 };
	cache.mainProjectName = { value: null, timestamp: 0 };
}

// 캐시 TTL (ms)
export const CACHE_TTL = {
	branch: 5000, // 5초
	gitChanges: 0, // 캐시 없음 - git diff는 충분히 빠름
	prUrl: 30000, // 30초
	mainProjectName: 300000, // 5분 (워크트리는 세션 중 불변)
};
