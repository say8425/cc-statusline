#!/usr/bin/env bun

import {
	getBranchCached,
	getGitChangesCached,
	getMainProjectNameCached,
	getPrUrlCached,
} from "./git/index.ts";
import { renderStatusLine } from "./render.ts";
import { readStdin } from "./stdin.ts";
import type { ClaudeStatusInput } from "./types.ts";

// 메인 함수
export async function main(): Promise<void> {
	// 1. stdin에서 Claude Code JSON 읽기 (empty stdin 처리)
	const claudeJson: ClaudeStatusInput = JSON.parse((await readStdin()) || "{}");

	// 2. Git 정보 (캐싱, 병렬 실행)
	const [branch, gitChanges, prUrl, mainProjectName] = await Promise.all([
		getBranchCached(),
		getGitChangesCached(),
		getPrUrlCached(),
		getMainProjectNameCached(),
	]);

	// 3. 렌더링 및 출력
	const lines = renderStatusLine({
		claudeJson,
		branch,
		gitChanges,
		prUrl,
		rateLimits: claudeJson.rate_limits ?? null,
		mainProjectName,
	});

	for (const line of lines) {
		console.log(line);
	}
}

if (import.meta.main) {
	main().catch(console.error);
}
