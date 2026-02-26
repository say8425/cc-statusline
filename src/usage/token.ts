import { $ } from "bun";
import { CACHE_TTL, cache } from "../cache.ts";

// 순수 함수: credential 문자열에서 accessToken 추출
export function parseCredentialString(raw: string): string | null {
	let text = raw.trim();
	if (text.length === 0) return null;

	// macOS security -w outputs hex when password has non-printable chars
	if (/^[0-9a-fA-F]+$/.test(text) && text.length > 0) {
		text = Buffer.from(text, "hex").toString("utf-8");
	}

	// 1) 표준 JSON 파싱 시도
	try {
		const creds = JSON.parse(text);
		return creds?.claudeAiOauth?.accessToken ?? null;
	} catch {}

	// 2) Binary prefix 포맷: brace-matching으로 내부 JSON 추출
	const keyIdx = text.indexOf('"claudeAiOauth"');
	if (keyIdx < 0) return null;

	const braceStart = text.indexOf("{", keyIdx);
	if (braceStart < 0) return null;

	let depth = 0;
	for (let i = braceStart; i < text.length; i++) {
		if (text[i] === "{") depth++;
		else if (text[i] === "}") depth--;
		if (depth === 0) {
			try {
				const inner = JSON.parse(text.substring(braceStart, i + 1));
				return inner?.accessToken ?? null;
			} catch {
				return null;
			}
		}
	}
	return null;
}

// macOS Keychain에서 OAuth access token 읽기
export async function getAccessToken(): Promise<string | null> {
	if (process.platform !== "darwin") return null;
	try {
		const result =
			await $`security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null`.text();
		return parseCredentialString(result);
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
