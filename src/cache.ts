// 캐시 구조
export const cache = {
	branch: { value: "", timestamp: 0 },
	gitChanges: { files: 0, insertions: 0, deletions: 0, timestamp: 0 },
	prUrl: { value: null as string | null, timestamp: 0 },
	mainProject: {
		value: null as { name: string; path: string } | null,
		timestamp: 0,
	},
	baseRef: {
		value: null as { base: string | null; ref: string | null } | null,
		timestamp: 0,
	},
	ultracode: { value: false, timestamp: 0 },
};

// 캐시 초기화 (테스트용)
export const resetCache = (): void => {
	cache.branch = { value: "", timestamp: 0 };
	cache.gitChanges = { files: 0, insertions: 0, deletions: 0, timestamp: 0 };
	cache.prUrl = { value: null, timestamp: 0 };
	cache.mainProject = { value: null, timestamp: 0 };
	cache.baseRef = { value: null, timestamp: 0 };
	cache.ultracode = { value: false, timestamp: 0 };
};

// 캐시 TTL (ms)
export const CACHE_TTL = {
	branch: 5000, // 5초
	gitChanges: 0, // 캐시 없음 - git diff는 충분히 빠름
	prUrl: 30000, // 30초
	mainProject: 300000, // 5분 (워크트리는 세션 중 불변)
	baseRef: 30000, // 30초 (base 해결은 gh 호출이라 느림)
	ultracode: 5000, // 5초 (설정 파일 로컬 읽기 — /config 토글 반영용)
};
