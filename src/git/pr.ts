import { $ } from "bun";
import { CACHE_TTL, cache } from "../cache.ts";

// PR URL 가져오기 (캐싱)
export const getPrUrlCached = async (): Promise<string | null> => {
	if (Date.now() - cache.prUrl.timestamp < CACHE_TTL.prUrl) {
		return cache.prUrl.value;
	}
	try {
		const result = await $`gh pr view --json url -q .url 2>/dev/null`.text();
		cache.prUrl = { value: result.trim() || null, timestamp: Date.now() };
		return cache.prUrl.value;
	} catch {
		return cache.prUrl.value;
	}
};
