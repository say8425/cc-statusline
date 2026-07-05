#!/usr/bin/env bun

import { join } from "node:path";
import { resolveDiffPort } from "./diff-server/config.ts";
import { ensureDiffServer } from "./diff-server/ensure.ts";
import { buildDiffViewerUrl } from "./diff-server/link.ts";
import {
	getBaseChangesCached,
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

	// 3. diff 뷰어 링크 — working 변경이 있으면 working, 없으면 base 대비(브랜치가
	//    base보다 앞설 때)로 진입점을 유지. 데몬 ensure는 볼 것이 있을 때만.
	const repo =
		claudeJson.workspace?.project_dir ||
		claudeJson.workspace?.current_dir ||
		"";
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
		const ensured = await ensureDiffServer(repo);
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
		prUrl,
		rateLimits: claudeJson.rate_limits ?? null,
		mainProjectName,
		diffViewerUrl,
		baseChanges,
		baseDiffViewerUrl,
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
			// No idle timeout: once the statusline spawns the daemon it stays up
			// until reboot/kill, so it doesn't die mid-session after 15 min idle.
			// (server.ts keeps the optional idle feature; the daemon just opts out.)
		});
		// Bun.serve keeps the process alive.
	} else {
		main().catch(console.error);
	}
}
