import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { CACHE_TTL, cache } from "./cache.ts";

// ultracode 여부는 stdin JSON·env로 전달되지 않아 (effort.level은 xhigh로만 보고,
// CLI 2.1.201에서 확인) Claude Code 설정 파일의 `ultracode` 키를 직접 읽는다.
// 우선순위는 Claude Code 설정 해석 순서와 동일: local > project > user.
export const ultracodeSettingsPaths = (
	projectDir: string,
	homeDir: string,
): string[] => {
	const paths: string[] = [];
	if (projectDir) {
		paths.push(
			join(projectDir, ".claude", "settings.local.json"),
			join(projectDir, ".claude", "settings.json"),
		);
	}
	paths.push(join(homeDir, ".claude", "settings.json"));
	return paths;
};

// 파일 목록을 순서대로 읽어 boolean `ultracode` 키가 있는 첫 파일의 값을 반환.
// 파일 없음·JSON 오류·비 boolean 값은 건너뛰고, 어디에도 없으면 false.
export const resolveUltracodeFromFiles = async (
	paths: string[],
): Promise<boolean> => {
	// 읽기는 병렬, 판정은 우선순위 순서대로
	const contents = await Promise.all(
		paths.map((path) => readFile(path, "utf8").catch(() => null)),
	);
	for (const content of contents) {
		if (content === null) continue;
		try {
			const parsed: unknown = JSON.parse(content);
			if (
				typeof parsed === "object" &&
				parsed !== null &&
				"ultracode" in parsed &&
				typeof parsed.ultracode === "boolean"
			) {
				return parsed.ultracode;
			}
		} catch {
			// 파싱 실패 — 다음 후보로
		}
	}
	return false;
};

// ultracode 설정 가져오기 (캐싱)
export const getUltracodeCached = async (
	projectDir: string,
	homeDir: string = homedir(),
): Promise<boolean> => {
	if (Date.now() - cache.ultracode.timestamp < CACHE_TTL.ultracode) {
		return cache.ultracode.value;
	}
	const value = await resolveUltracodeFromFiles(
		ultracodeSettingsPaths(projectDir, homeDir),
	);
	cache.ultracode = { value, timestamp: Date.now() };
	return value;
};
