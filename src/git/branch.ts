import { $ } from "bun";
import { CACHE_TTL, cache } from "../cache.ts";

// Git 브랜치 가져오기 (캐싱)
export const getBranchCached = async (): Promise<string> => {
	if (Date.now() - cache.branch.timestamp < CACHE_TTL.branch) {
		return cache.branch.value;
	}
	try {
		const result = await $`git branch --show-current 2>/dev/null`.text();
		cache.branch = { value: result.trim(), timestamp: Date.now() };
		return cache.branch.value;
	} catch {
		return cache.branch.value;
	}
};
