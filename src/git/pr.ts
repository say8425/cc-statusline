import { $ } from "bun";
import { CACHE_TTL, cache } from "../cache.ts";
import type { PrInfo, PrState } from "../types.ts";
import { aggregateCiStatus } from "./ciStatus.ts";

interface GhPrView {
	url: string;
	state: PrState;
	isDraft: boolean;
	statusCheckRollup?: Array<{
		status?: string;
		conclusion?: string | null;
		state?: string;
	}>;
}

// PR 정보 가져오기 (URL + 상태 + CI 롤업, 캐싱)
export const getPrInfoCached = async (): Promise<PrInfo | null> => {
	if (Date.now() - cache.prInfo.timestamp < CACHE_TTL.prInfo) {
		return cache.prInfo.value;
	}
	try {
		const result =
			await $`gh pr view --json url,state,isDraft,statusCheckRollup 2>/dev/null`.text();
		const parsed = JSON.parse(result) as GhPrView;
		const value: PrInfo = {
			url: parsed.url,
			state: parsed.state,
			isDraft: parsed.isDraft,
			ciStatus: aggregateCiStatus(parsed.statusCheckRollup ?? []),
		};
		cache.prInfo = { value, timestamp: Date.now() };
		return value;
	} catch {
		return cache.prInfo.value;
	}
};
