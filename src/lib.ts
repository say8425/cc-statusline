#!/usr/bin/env bun

import { $ } from "bun";
import { loadSessionBlockData } from "ccusage/data-loader";

// 공식 Claude Code JSON input 타입 정의
export interface ClaudeStatusInput {
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

// 블록 사용량 정보 타입
export interface BlockUsageInfo {
	resetTime: Date | null;
	blockTokens: number;
	blockCostUSD: number;
	blockStartTime: number | null;
}

// CLI 파싱 결과 타입
export interface CliOptions {
	noUsage: boolean;
	blockCostLimit: number;
}

// 캐시 구조
export const cache = {
	branch: { value: "", timestamp: 0 },
	gitChanges: { files: 0, insertions: 0, deletions: 0, timestamp: 0 },
	prUrl: { value: null as string | null, timestamp: 0 },
	blockUsage: {
		value: null as BlockUsageInfo | null,
		timestamp: 0,
	},
};

// 캐시 초기화 (테스트용)
export function resetCache(): void {
	cache.branch = { value: "", timestamp: 0 };
	cache.gitChanges = { files: 0, insertions: 0, deletions: 0, timestamp: 0 };
	cache.prUrl = { value: null, timestamp: 0 };
	cache.blockUsage = { value: null, timestamp: 0 };
}

// 캐시 TTL (ms)
export const CACHE_TTL = {
	branch: 5000, // 5초
	gitChanges: 0, // 캐시 없음 - git diff는 충분히 빠름
	prUrl: 30000, // 30초
	blockUsage: 60000, // 60초 (JSONL 파싱은 비용이 크므로 긴 TTL)
};

// Plan별 5시간 비용 한도 ($USD)
export const COST_LIMITS = {
	pro: 8, // ~$8/block (커뮤니티 추정)
	max5x: 40, // ~$40/block
	max20x: 80, // ~$80/block
} as const;

export type Plan = keyof typeof COST_LIMITS;

export const DEFAULT_PLAN: Plan = "pro";

// TrueColor 색상 정의
export const C = {
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

// 사용률에 따른 색상 (Context 및 Block Usage 공통)
export function getUsageColor(pct: number): string {
	if (pct < 50) return C.WHITE;
	if (pct < 80) return C.YELLOW;
	return C.RED;
}

// 숫자 포맷팅 (천 단위 콤마)
export function formatNumber(n: number): string {
	return n.toLocaleString("en-US");
}

// 시간 포맷팅 (HH:MM)
export function formatTime(hours: number, mins: number): string {
	return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

// 토큰 수를 K 단위로 포맷팅
export function formatTokensK(tokens: number): string {
	if (tokens >= 1000) {
		return `${Math.round(tokens / 1000)}K`;
	}
	return tokens.toString();
}

// 리셋까지 남은 시간 계산
export function getTimeUntilReset(resetTime: Date): {
	hours: number;
	minutes: number;
} {
	const now = new Date();
	const diff = resetTime.getTime() - now.getTime();

	if (diff <= 0) {
		return { hours: 0, minutes: 0 };
	}

	const hours = Math.floor(diff / (1000 * 60 * 60));
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

	return { hours, minutes };
}

// 분당 번레이트 계산 (tokens/min)
export function calculateBurnRate(
	blockTokens: number,
	blockStartTime: number | null,
): number {
	if (!blockStartTime || blockTokens === 0) return 0;

	const now = Date.now();
	const elapsedMinutes = (now - blockStartTime) / (1000 * 60);

	if (elapsedMinutes < 1) return 0; // 1분 미만에는 변동성이 큰 값을 표시하지 않음

	return Math.round(blockTokens / elapsedMinutes);
}

// stdin에서 JSON 읽기
export async function readStdin(): Promise<string> {
	const chunks: Uint8Array[] = [];
	for await (const chunk of Bun.stdin.stream()) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks).toString("utf-8");
}

// Git 브랜치 가져오기 (캐싱)
export async function getBranchCached(): Promise<string> {
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
export async function getGitChangesCached(): Promise<{
	files: number;
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
		const combined = `${diff}\n${staged}`;

		// 파일 수, insertions, deletions 추출 (단수/복수 모두 처리)
		const [files, insertions, deletions] = [
			/(\d+) files?/g,
			/(\d+) insertions?/g,
			/(\d+) deletions?/g,
		].map((regex) =>
			(combined.match(regex) || []).reduce(
				(sum, m) => sum + Number.parseInt(m, 10),
				0,
			),
		);
		cache.gitChanges = { files, insertions, deletions, timestamp: Date.now() };
		return cache.gitChanges;
	} catch {
		return cache.gitChanges;
	}
}

// PR URL 가져오기 (캐싱)
export async function getPrUrlCached(): Promise<string | null> {
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

// CLI 인자 파싱
export function parseCliArgs(args: string[]): CliOptions {
	const noUsage = args.includes("--no-usage");

	// --plan 옵션 파싱 (예: --plan max5x)
	const planIndex = args.indexOf("--plan");
	const planArg =
		planIndex !== -1 && planIndex + 1 < args.length
			? args[planIndex + 1]
			: DEFAULT_PLAN;
	const blockCostLimit =
		COST_LIMITS[planArg as Plan] ?? COST_LIMITS[DEFAULT_PLAN];

	return { noUsage, blockCostLimit };
}

// ccusage를 사용하여 블록 사용량 정보 추출
export async function getBlockUsageFromCcusage(): Promise<BlockUsageInfo> {
	const result: BlockUsageInfo = {
		resetTime: null,
		blockTokens: 0,
		blockCostUSD: 0,
		blockStartTime: null,
	};

	try {
		const blocks = await loadSessionBlockData({
			sessionDurationHours: 5,
			offline: true,
			order: "desc",
		});

		if (blocks.length === 0) return result;

		// 가장 최근의 활성 블록 찾기 (갭 블록 제외)
		const activeBlock = blocks.find((b) => !b.isGap);
		if (!activeBlock) return result;

		// 블록 토큰 합산 (캐시 토큰 포함 — 번레이트 참고값)
		const { tokenCounts } = activeBlock;
		result.blockTokens =
			tokenCounts.inputTokens +
			tokenCounts.outputTokens +
			tokenCounts.cacheCreationInputTokens +
			tokenCounts.cacheReadInputTokens;

		// 블록 비용 (ccusage의 costUSD 필드)
		result.blockCostUSD =
			((activeBlock as Record<string, unknown>).costUSD as number) ?? 0;

		result.blockStartTime = activeBlock.startTime.getTime();

		// 리셋 시간 설정 (ccusage가 제공하는 usageLimitResetTime 또는 블록 종료 시간)
		if (
			activeBlock.usageLimitResetTime &&
			activeBlock.usageLimitResetTime > new Date()
		) {
			result.resetTime = activeBlock.usageLimitResetTime;
		} else if (activeBlock.endTime > new Date()) {
			result.resetTime = activeBlock.endTime;
		}

		return result;
	} catch {
		return result;
	}
}

// 블록 사용량 가져오기 (캐싱)
export async function getBlockUsageCached(): Promise<BlockUsageInfo | null> {
	if (Date.now() - cache.blockUsage.timestamp < CACHE_TTL.blockUsage) {
		return cache.blockUsage.value;
	}

	const blockUsage = await getBlockUsageFromCcusage();
	cache.blockUsage = { value: blockUsage, timestamp: Date.now() };
	return blockUsage;
}

// 렌더링 컨텍스트 타입 (테스트를 위한 의존성 주입)
export interface RenderContext {
	claudeJson: ClaudeStatusInput;
	branch: string;
	gitChanges: { files: number; insertions: number; deletions: number };
	prUrl: string | null;
	blockUsage: BlockUsageInfo | null;
	noUsage: boolean;
	blockCostLimit: number;
}

// 상태 라인 렌더링 (순수 함수 - 테스트 가능)
export function renderStatusLine(ctx: RenderContext): string[] {
	const lines: string[] = [];

	// 1. 폴더 이름 추출
	const folder = ctx.claudeJson.workspace?.project_dir?.split("/").pop() || "";

	// 2. 세션 시간 계산
	const sessionMs = ctx.claudeJson.cost?.total_duration_ms || 0;
	const sessionSec = Math.floor(sessionMs / 1000);
	const sessionHrs = Math.floor(sessionSec / 3600);
	const sessionMins = Math.floor((sessionSec % 3600) / 60);

	// 3. 비용
	const costUsd = ctx.claudeJson.cost?.total_cost_usd || 0;

	// 4. Context 토큰 계산
	const usage = ctx.claudeJson.context_window?.current_usage;
	const contextSize =
		ctx.claudeJson.context_window?.context_window_size || 200000;

	const totalTokens = usage
		? usage.input_tokens +
			usage.output_tokens +
			usage.cache_creation_input_tokens +
			usage.cache_read_input_tokens
		: 0;

	const contextPct = Math.round((totalTokens / contextSize) * 100);
	const ctxColor = getUsageColor(contextPct);

	// 1번째 줄: 폴더 | 브랜치
	let line1 = `${C.WHITE}📁 ${folder}${C.RESET}`;
	if (ctx.branch) {
		line1 += ` | ${C.WHITE}🌿 ${ctx.branch}${C.RESET}`;
	}
	lines.push(line1);

	// 2번째 줄: 세션 시간 | 비용 | 컨텍스트
	const line2 =
		`${C.WHITE}⏱️ ${formatTime(sessionHrs, sessionMins)}${C.RESET}` +
		` | ${C.WHITE}💰 $${costUsd.toFixed(2)}${C.RESET}` +
		` | ${ctxColor}🧠 ${formatNumber(totalTokens)} (${contextPct}%)${C.RESET}`;
	lines.push(line2);

	// 3번째 줄: 리셋 타이머 | 사용량 | 번레이트 (--no-usage가 아닐 때)
	if (!ctx.noUsage && ctx.blockUsage) {
		const parts: string[] = [];

		// 리셋 타이머
		if (ctx.blockUsage.resetTime) {
			const resetTime = getTimeUntilReset(ctx.blockUsage.resetTime);
			parts.push(
				`${C.WHITE}⏳ ${formatTime(resetTime.hours, resetTime.minutes)}${C.RESET}`,
			);
		}

		// 블록 사용량 (비용 기반)
		const usagePct = Math.round(
			(ctx.blockUsage.blockCostUSD / ctx.blockCostLimit) * 100,
		);
		const usageColor = getUsageColor(usagePct);
		parts.push(
			`${usageColor}📊 $${ctx.blockUsage.blockCostUSD.toFixed(2)}/$${ctx.blockCostLimit} (${usagePct}%)${C.RESET}`,
		);

		// 번레이트
		const burnRate = calculateBurnRate(
			ctx.blockUsage.blockTokens,
			ctx.blockUsage.blockStartTime,
		);
		if (burnRate > 0) {
			parts.push(`${C.WHITE}🔥 ${formatTokensK(burnRate)}/min${C.RESET}`);
		}

		if (parts.length > 0) {
			lines.push(parts.join(" | "));
		}
	}

	// 4번째 줄: git changes | PR URL
	const hasGitChanges =
		ctx.gitChanges.files > 0 ||
		ctx.gitChanges.insertions > 0 ||
		ctx.gitChanges.deletions > 0;
	if (hasGitChanges || ctx.prUrl) {
		let line4 = "";
		if (hasGitChanges) {
			line4 += `✏️ ${C.WHITE}${ctx.gitChanges.files} files${C.RESET} ${C.GREEN}+${ctx.gitChanges.insertions}${C.RESET} ${C.RED}-${ctx.gitChanges.deletions}${C.RESET}`;
		}
		if (ctx.prUrl) {
			// GitHub Enterprise 지원을 위해 정규식으로 도메인 제거
			const prLabel = ctx.prUrl
				.replace(/^https?:\/\/[^/]+\//, "")
				.replace("/pull/", "#");
			if (line4) line4 += " | ";
			// OSC 8 하이퍼링크
			line4 += `📎 ${C.WHITE}${C.UNDERLINE}\x1b]8;;${ctx.prUrl}\x07${prLabel}\x1b]8;;\x07${C.RESET}`;
		}
		lines.push(line4);
	}

	return lines;
}

// 메인 함수
export async function main(cliArgs?: string[]): Promise<void> {
	// CLI 인자 파싱
	const args = cliArgs ?? process.argv.slice(2);
	const { noUsage, blockCostLimit } = parseCliArgs(args);

	// 1. stdin에서 Claude Code JSON 읽기 (empty stdin 처리)
	const claudeJson: ClaudeStatusInput = JSON.parse((await readStdin()) || "{}");

	// 2. Git 정보 + 블록 사용량 (캐싱, 병렬 실행)
	const [branch, gitChanges, prUrl, blockUsage] = await Promise.all([
		getBranchCached(),
		getGitChangesCached(),
		getPrUrlCached(),
		noUsage ? Promise.resolve(null) : getBlockUsageCached(),
	]);

	// 3. 렌더링 및 출력
	const lines = renderStatusLine({
		claudeJson,
		branch,
		gitChanges,
		prUrl,
		blockUsage,
		noUsage,
		blockCostLimit,
	});

	for (const line of lines) {
		console.log(line);
	}
}
