#!/usr/bin/env bun

import { $ } from "bun";

// 공식 Claude Code JSON input 타입 정의
interface ClaudeStatusInput {
	cost: {
		total_duration_ms: number;
		total_cost_usd: number;
	};
	context_window: {
		context_window_size: number;
		current_usage: {
			input_tokens: number;
			output_tokens: number;
			cache_creation_input_tokens: number;
			cache_read_input_tokens: number;
		};
	};
	workspace: {
		current_dir: string;
		project_dir: string;
	};
}

// 캐시 구조
const cache = {
	branch: { value: "", timestamp: 0 },
	gitChanges: { insertions: 0, deletions: 0, timestamp: 0 },
	prUrl: { value: null as string | null, timestamp: 0 },
};

// 캐시 TTL (ms)
const CACHE_TTL = {
	branch: 5000, // 5초
	gitChanges: 3000, // 3초
	prUrl: 30000, // 30초
};

// TrueColor 색상 정의
const C = {
	RESET: "\x1b[0m",
	CYAN: "\x1b[38;2;0;255;255m",
	MAGENTA: "\x1b[38;2;255;100;200m",
	GREEN: "\x1b[38;2;100;255;100m",
	YELLOW: "\x1b[38;2;255;220;100m",
	RED: "\x1b[38;2;255;100;100m",
	BLUE: "\x1b[38;2;100;150;255m",
	WHITE: "\x1b[38;2;200;200;200m",
	UNDERLINE: "\x1b[4m",
};

// Context 사용률에 따른 색상
function getContextColor(pct: number): string {
	if (pct < 50) return C.WHITE;
	if (pct < 80) return C.YELLOW;
	return C.RED;
}

// 숫자 포맷팅 (천 단위 콤마)
function formatNumber(n: number): string {
	return n.toLocaleString("en-US");
}

// 시간 포맷팅 (HH:MM)
function formatTime(hours: number, mins: number): string {
	return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

// stdin에서 JSON 읽기
async function readStdin(): Promise<string> {
	const chunks: Uint8Array[] = [];
	for await (const chunk of Bun.stdin.stream()) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks).toString("utf-8");
}

// Git 브랜치 가져오기 (캐싱)
async function getBranchCached(): Promise<string> {
	if (Date.now() - cache.branch.timestamp < CACHE_TTL.branch) {
		return cache.branch.value;
	}
	try {
		const result = await $`git branch --show-current 2>/dev/null`.text();
		cache.branch = { value: result.trim(), timestamp: Date.now() };
		return cache.branch.value;
	} catch {
		return cache.branch.value;
	}
}

// Git 변경사항 가져오기 (캐싱)
async function getGitChangesCached(): Promise<{
	insertions: number;
	deletions: number;
}> {
	if (Date.now() - cache.gitChanges.timestamp < CACHE_TTL.gitChanges) {
		return cache.gitChanges;
	}
	try {
		const [diff, staged] = await Promise.all([
			$`git diff --shortstat 2>/dev/null`.text(),
			$`git diff --cached --shortstat 2>/dev/null`.text(),
		]);
		const combined = `${diff} ${staged}`;
		const insertions = (combined.match(/(\d+) insertion/g) || []).reduce(
			(sum, m) => sum + Number.parseInt(m, 10),
			0,
		);
		const deletions = (combined.match(/(\d+) deletion/g) || []).reduce(
			(sum, m) => sum + Number.parseInt(m, 10),
			0,
		);
		cache.gitChanges = { insertions, deletions, timestamp: Date.now() };
		return cache.gitChanges;
	} catch {
		return cache.gitChanges;
	}
}

// PR URL 가져오기 (캐싱)
async function getPrUrlCached(): Promise<string | null> {
	if (Date.now() - cache.prUrl.timestamp < CACHE_TTL.prUrl) {
		return cache.prUrl.value;
	}
	try {
		const result = await $`gh pr view --json url -q .url 2>/dev/null`.text();
		cache.prUrl = { value: result.trim() || null, timestamp: Date.now() };
		return cache.prUrl.value;
	} catch {
		return cache.prUrl.value;
	}
}

// 메인 함수
async function main() {
	// 1. stdin에서 Claude Code JSON 읽기
	const claudeJson: ClaudeStatusInput = JSON.parse(await readStdin());

	// 2. 폴더 이름 추출 (프로젝트 루트 디렉토리)
	const folder = claudeJson.workspace?.project_dir?.split("/").pop() || "";

	// 3. 세션 시간 계산
	const sessionMs = claudeJson.cost?.total_duration_ms || 0;
	const sessionSec = Math.floor(sessionMs / 1000);
	const sessionHrs = Math.floor(sessionSec / 3600);
	const sessionMins = Math.floor((sessionSec % 3600) / 60);

	// 4. 비용
	const costUsd = claudeJson.cost?.total_cost_usd || 0;

	// 5. Context 토큰 계산
	const usage = claudeJson.context_window?.current_usage;
	const contextSize = claudeJson.context_window?.context_window_size || 200000;

	const totalTokens = usage
		? usage.input_tokens +
			usage.output_tokens +
			usage.cache_creation_input_tokens +
			usage.cache_read_input_tokens
		: 0;

	const contextPct = Math.round((totalTokens / contextSize) * 100);
	const ctxColor = getContextColor(contextPct);

	// 6. Git 정보 (캐싱, 병렬 실행)
	const [branch, gitChanges, prUrl] = await Promise.all([
		getBranchCached(),
		getGitChangesCached(),
		getPrUrlCached(),
	]);

	// 7. 출력
	// 1번째 줄: 폴더 | 브랜치 | git 변경사항
	let line1 = `${C.WHITE}📁 ${folder}${C.RESET}`;
	if (branch) {
		line1 += ` | ${C.WHITE}🌿 ${branch}${C.RESET}`;
	}
	if (gitChanges.insertions > 0 || gitChanges.deletions > 0) {
		line1 += ` | ✏️ ${C.GREEN}+${gitChanges.insertions}${C.RESET} ${C.RED}-${gitChanges.deletions}${C.RESET}`;
	}
	console.log(line1);

	// 2번째 줄: 세션 시간 | 비용 | 컨텍스트
	console.log(
		`${C.WHITE}⏱️ ${formatTime(sessionHrs, sessionMins)}${C.RESET} | ` +
			`${C.WHITE}💰 $${costUsd.toFixed(2)}${C.RESET} | ` +
			`${ctxColor}🧠 ${formatNumber(totalTokens)} (${contextPct}%)${C.RESET}`,
	);

	// 3번째 줄: PR URL (있을 경우만)
	if (prUrl) {
		const prLabel = prUrl
			.replace("https://github.com/", "")
			.replace("/pull/", "#");
		// OSC 8 하이퍼링크
		console.log(
			`📎 ${C.WHITE}${C.UNDERLINE}\x1b]8;;${prUrl}\x07${prLabel}\x1b]8;;\x07${C.RESET}`,
		);
	}
}

main().catch(console.error);
