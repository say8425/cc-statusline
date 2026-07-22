#!/usr/bin/env bun

import { ensureDiffServer } from "./diff-server/ensure.ts";
import { buildDiffViewerUrl } from "./diff-server/link.ts";
import { toFileUrl } from "./format/index.ts";
import {
	getBaseChangesCached,
	getBranchCached,
	getGitChangesCached,
	getMainProjectCached,
	getPrInfoCached,
} from "./git/index.ts";
import { renderStatusLine } from "./render.ts";
import { readStdin } from "./stdin.ts";
import type { ClaudeStatusInput } from "./types.ts";
import { getUltracodeCached } from "./ultracode.ts";

// 메인 함수
export const main = async (): Promise<void> => {
	// 1. stdin에서 Claude Code JSON 읽기 (empty stdin 처리)
	const claudeJson: ClaudeStatusInput = JSON.parse((await readStdin()) || "{}");

	const repo =
		claudeJson.workspace?.project_dir ||
		claudeJson.workspace?.current_dir ||
		"";

	// 2. Git 정보 및 설정 (캐싱, 병렬 실행)
	const [branch, gitChanges, prInfo, mainProject, ultracode] =
		await Promise.all([
			getBranchCached(),
			getGitChangesCached(),
			getPrInfoCached(),
			getMainProjectCached(),
			getUltracodeCached(repo),
		]);
	const mainProjectName = mainProject?.name ?? null;
	const projectDirUrl = repo ? toFileUrl(repo) : null;
	const mainProjectUrl = mainProject ? toFileUrl(mainProject.path) : null;

	// 3. diff 뷰어 링크 — working 변경이 있으면 working, 없으면 base 대비(브랜치가
	//    base보다 앞설 때)로 진입점을 유지. 데몬 ensure는 볼 것이 있을 때만.
	const hasChanges =
		gitChanges.files > 0 ||
		gitChanges.insertions > 0 ||
		gitChanges.deletions > 0;
	let diffViewerUrl: string | null = null;
	let baseDiffViewerUrl: string | null = null;
	let baseChanges: Awaited<ReturnType<typeof getBaseChangesCached>> = null;
	if (!hasChanges && repo) {
		baseChanges = await getBaseChangesCached();
	}
	if (repo && (hasChanges || baseChanges)) {
		const ensured = ensureDiffServer(repo);
		if (ensured) {
			if (hasChanges) {
				diffViewerUrl = buildDiffViewerUrl({
					port: ensured.port,
					repo,
					token: ensured.token,
					mode: "working",
				});
			} else if (baseChanges) {
				baseDiffViewerUrl = buildDiffViewerUrl({
					port: ensured.port,
					repo,
					token: ensured.token,
					mode: "base",
				});
			}
		}
	}

	// 4. 렌더링 및 출력
	const lines = renderStatusLine({
		claudeJson,
		branch,
		gitChanges,
		prInfo,
		ultracode,
		rateLimits: claudeJson.rate_limits ?? null,
		mainProjectName,
		diffViewerUrl,
		baseChanges,
		baseDiffViewerUrl,
		projectDirUrl,
		mainProjectUrl,
	});

	for (const line of lines) {
		console.log(line);
	}
};

if (import.meta.main) {
	main().catch(console.error);
}
