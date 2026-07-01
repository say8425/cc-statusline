#!/usr/bin/env bun

import { join } from "node:path";
import { resolveDiffPort } from "./diff-server/config.ts";
import { ensureDiffServer } from "./diff-server/ensure.ts";
import { buildDiffViewerUrl } from "./diff-server/link.ts";
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

	// 3. diff 뷰어 링크 (변경사항이 있을 때만; 데몬 ensure는 fire-and-forget)
	let diffViewerUrl: string | null = null;
	const repo =
		claudeJson.workspace?.project_dir ||
		claudeJson.workspace?.current_dir ||
		"";
	const hasChanges =
		gitChanges.files > 0 ||
		gitChanges.insertions > 0 ||
		gitChanges.deletions > 0;
	if (hasChanges && repo) {
		const ensured = await ensureDiffServer(repo);
		if (ensured) {
			diffViewerUrl = buildDiffViewerUrl({
				port: ensured.port,
				repo,
				token: ensured.token,
			});
		}
	}

	// 4. 렌더링 및 출력
	const lines = renderStatusLine({
		claudeJson,
		branch,
		gitChanges,
		prUrl,
		rateLimits: claudeJson.rate_limits ?? null,
		mainProjectName,
		diffViewerUrl,
	});

	for (const line of lines) {
		console.log(line);
	}
}

if (import.meta.main) {
	if (process.argv.includes("--diff-server")) {
		const { startDiffServer } = await import("./diff-server/server.ts");
		startDiffServer({
			port: resolveDiffPort(),
			viewerDir: join(import.meta.dir, "viewer"),
			idleTimeoutMs: 15 * 60 * 1000,
		});
		// Bun.serve keeps the process alive.
	} else {
		main().catch(console.error);
	}
}
