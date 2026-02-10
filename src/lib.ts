#!/usr/bin/env bun

import { $ } from "bun";

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

// Usage API 응답 타입
export interface UsageAPIResponse {
	five_hour: { utilization: number; resets_at: string } | null;
	seven_day: { utilization: number; resets_at: string } | null;
	seven_day_sonnet: { utilization: number; resets_at: string } | null;
	extra_usage: {
		is_enabled: boolean;
		monthly_limit: number;
		used_credits: number;
		utilization: number;
	} | null;
}

// 블록 사용량 정보 타입
export interface BlockUsageInfo {
	resetTime: Date | null;
	utilization: number; // 0-100+ (서버 계산 %)
	sevenDayUtilization: number | null;
}

// CLI 파싱 결과 타입
export interface CliOptions {
	showUsage: boolean;
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
	accessToken: { value: null as string | null, timestamp: 0 },
};

// 캐시 초기화 (테스트용)
export function resetCache(): void {
	cache.branch = { value: "", timestamp: 0 };
	cache.gitChanges = { files: 0, insertions: 0, deletions: 0, timestamp: 0 };
	cache.prUrl = { value: null, timestamp: 0 };
	cache.blockUsage = { value: null, timestamp: 0 };
	cache.accessToken = { value: null, timestamp: 0 };
}

// 캐시 TTL (ms)
export const CACHE_TTL = {
	branch: 5000, // 5초
	gitChanges: 0, // 캐시 없음 - git diff는 충분히 빠름
	prUrl: 30000, // 30초
	blockUsage: 120000, // 120초 (API 호출 빈도 제한)
	accessToken: 300000, // 5분 (토큰은 세션 중 바뀌지 않음)
};

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
	const showUsage = args.includes("--show-usage");
	return { showUsage };
}

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

// Usage API 호출
export async function fetchUsageFromAPI(
	accessToken: string,
): Promise<UsageAPIResponse | null> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000);

		const response = await fetch("https://api.anthropic.com/api/oauth/usage", {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"anthropic-beta": "oauth-2025-04-20",
			},
			signal: controller.signal,
		});

		clearTimeout(timeout);

		if (!response.ok) return null;

		return (await response.json()) as UsageAPIResponse;
	} catch {
		return null;
	}
}

// Usage API 결과를 BlockUsageInfo로 변환
function usageResponseToBlockUsage(data: UsageAPIResponse): BlockUsageInfo {
	const result: BlockUsageInfo = {
		resetTime: null,
		utilization: 0,
		sevenDayUtilization: null,
	};

	if (data.five_hour) {
		result.utilization = data.five_hour.utilization;
		if (data.five_hour.resets_at) {
			result.resetTime = new Date(data.five_hour.resets_at);
		}
	}

	if (data.seven_day) {
		result.sevenDayUtilization = data.seven_day.utilization;
	}

	return result;
}

// Usage 가져오기 (캐싱) — getBlockUsageCached 대체
export async function getUsageCached(): Promise<BlockUsageInfo | null> {
	if (Date.now() - cache.blockUsage.timestamp < CACHE_TTL.blockUsage) {
		return cache.blockUsage.value;
	}

	const token = await getAccessTokenCached();
	if (!token) {
		cache.blockUsage = { value: null, timestamp: Date.now() };
		return null;
	}

	const data = await fetchUsageFromAPI(token);
	if (!data) {
		cache.blockUsage = { value: null, timestamp: Date.now() };
		return null;
	}

	const blockUsage = usageResponseToBlockUsage(data);
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
	showUsage: boolean;
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

	// 3번째 줄: 리셋 타이머 | 5시간 사용량 | 7일 사용량 (--show-usage일 때)
	if (ctx.showUsage && ctx.blockUsage) {
		const parts: string[] = [];

		// 리셋 타이머
		if (ctx.blockUsage.resetTime) {
			const resetTime = getTimeUntilReset(ctx.blockUsage.resetTime);
			parts.push(
				`${C.WHITE}⏳ ${formatTime(resetTime.hours, resetTime.minutes)}${C.RESET}`,
			);
		}

		// 5시간 사용량 (서버 utilization 그대로)
		const usageColor = getUsageColor(ctx.blockUsage.utilization);
		parts.push(
			`${usageColor}📊 ${Math.round(ctx.blockUsage.utilization)}%${C.RESET}`,
		);

		// 7일 사용량
		if (ctx.blockUsage.sevenDayUtilization !== null) {
			const weekColor = getUsageColor(ctx.blockUsage.sevenDayUtilization);
			parts.push(
				`${weekColor}📅 ${Math.round(ctx.blockUsage.sevenDayUtilization)}%${C.RESET}`,
			);
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
	const { showUsage } = parseCliArgs(args);

	// 1. stdin에서 Claude Code JSON 읽기 (empty stdin 처리)
	const claudeJson: ClaudeStatusInput = JSON.parse((await readStdin()) || "{}");

	// 2. Git 정보 + 사용량 (캐싱, 병렬 실행)
	const [branch, gitChanges, prUrl, blockUsage] = await Promise.all([
		getBranchCached(),
		getGitChangesCached(),
		getPrUrlCached(),
		showUsage ? getUsageCached() : Promise.resolve(null),
	]);

	// 3. 렌더링 및 출력
	const lines = renderStatusLine({
		claudeJson,
		branch,
		gitChanges,
		prUrl,
		blockUsage,
		showUsage,
	});

	for (const line of lines) {
		console.log(line);
	}
}
