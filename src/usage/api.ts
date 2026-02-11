import { CACHE_TTL, cache } from "../cache.ts";
import type { BlockUsageInfo, UsageAPIResponse } from "../types.ts";
import { getAccessTokenCached } from "./token.ts";

// Usage API 호출
export async function fetchUsageFromAPI(
	accessToken: string,
): Promise<UsageAPIResponse | null> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000);

		const response = await fetch("https://api.anthropic.com/api/oauth/usage", {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"anthropic-beta": "oauth-2025-04-20",
			},
			signal: controller.signal,
		});

		clearTimeout(timeout);

		if (!response.ok) return null;

		return (await response.json()) as UsageAPIResponse;
	} catch {
		return null;
	}
}

// Usage API 결과를 BlockUsageInfo로 변환
export function usageResponseToBlockUsage(
	data: UsageAPIResponse,
): BlockUsageInfo {
	const result: BlockUsageInfo = {
		resetTime: null,
		utilization: 0,
		sevenDayUtilization: null,
		sevenDayResetTime: null,
	};

	if (data.five_hour) {
		result.utilization = data.five_hour.utilization;
		if (data.five_hour.resets_at) {
			result.resetTime = new Date(data.five_hour.resets_at);
		}
	}

	if (data.seven_day) {
		result.sevenDayUtilization = data.seven_day.utilization;
		if (data.seven_day.resets_at) {
			result.sevenDayResetTime = new Date(data.seven_day.resets_at);
		}
	}

	return result;
}

// Usage 가져오기 (캐싱) — getBlockUsageCached 대체
export async function getUsageCached(): Promise<BlockUsageInfo | null> {
	if (Date.now() - cache.blockUsage.timestamp < CACHE_TTL.blockUsage) {
		return cache.blockUsage.value;
	}

	const token = await getAccessTokenCached();
	if (!token) {
		cache.blockUsage = { value: null, timestamp: Date.now() };
		return null;
	}

	const data = await fetchUsageFromAPI(token);
	if (!data) {
		cache.blockUsage = { value: null, timestamp: Date.now() };
		return null;
	}

	const blockUsage = usageResponseToBlockUsage(data);
	cache.blockUsage = { value: blockUsage, timestamp: Date.now() };
	return blockUsage;
}
