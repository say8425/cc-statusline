#!/usr/bin/env bun

import { parseCliArgs } from "./cli.ts";
import {
	getBranchCached,
	getGitChangesCached,
	getMainProjectNameCached,
	getPrUrlCached,
} from "./git/index.ts";
import { renderStatusLine } from "./render.ts";
import { readStdin } from "./stdin.ts";
import type { ClaudeStatusInput } from "./types.ts";
import { getUsageCached } from "./usage/index.ts";

// 메인 함수
export async function main(cliArgs?: string[]): Promise<void> {
	// CLI 인자 파싱
	const args = cliArgs ?? process.argv.slice(2);
	const { showUsage } = parseCliArgs(args);

	// 1. stdin에서 Claude Code JSON 읽기 (empty stdin 처리)
	const claudeJson: ClaudeStatusInput = JSON.parse((await readStdin()) || "{}");

	// 2. Git 정보 + 사용량 (캐싱, 병렬 실행)
	const [branch, gitChanges, prUrl, blockUsage, mainProjectName] =
		await Promise.all([
			getBranchCached(),
			getGitChangesCached(),
			getPrUrlCached(),
			showUsage ? getUsageCached() : Promise.resolve(null),
			getMainProjectNameCached(),
		]);

	// 3. 렌더링 및 출력
	const lines = renderStatusLine({
		claudeJson,
		branch,
		gitChanges,
		prUrl,
		blockUsage,
		showUsage,
		mainProjectName,
	});

	for (const line of lines) {
		console.log(line);
	}
}

if (import.meta.main) {
	main().catch(console.error);
}
