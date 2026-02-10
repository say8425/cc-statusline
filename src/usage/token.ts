import { $ } from "bun";
import { CACHE_TTL, cache } from "../cache.ts";

// macOS Keychain에서 OAuth access token 읽기
export async function getAccessToken(): Promise<string | null> {
	if (process.platform !== "darwin") return null;
	try {
		const result =
			await $`security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null`.text();
		const creds = JSON.parse(result);
		return creds?.claudeAiOauth?.accessToken ?? null;
	} catch {
		return null;
	}
}

// Access token 가져오기 (캐싱)
export async function getAccessTokenCached(): Promise<string | null> {
	if (Date.now() - cache.accessToken.timestamp < CACHE_TTL.accessToken) {
		return cache.accessToken.value;
	}

	const token = await getAccessToken();
	cache.accessToken = { value: token, timestamp: Date.now() };
	return token;
}
