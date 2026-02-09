#!/usr/bin/env bun

import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
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
	blockCostLimit: number | null; // null이면 Keychain에서 자동 감지
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
	plan: { value: "pro" as Plan, timestamp: 0 },
};

// 캐시 초기화 (테스트용)
export function resetCache(): void {
	cache.branch = { value: "", timestamp: 0 };
	cache.gitChanges = { files: 0, insertions: 0, deletions: 0, timestamp: 0 };
	cache.prUrl = { value: null, timestamp: 0 };
	cache.blockUsage = { value: null, timestamp: 0 };
	cache.plan = { value: "pro" as Plan, timestamp: 0 };
}

// 캐시 TTL (ms)
export const CACHE_TTL = {
	branch: 5000, // 5초
	gitChanges: 0, // 캐시 없음 - git diff는 충분히 빠름
	prUrl: 30000, // 30초
	blockUsage: 60000, // 60초 (JSONL 파싱은 비용이 크므로 긴 TTL)
	plan: 300000, // 5분 (플랜은 세션 중 바뀌지 않음)
};

// Plan별 5시간 비용 한도 ($USD)
export const COST_LIMITS = {
	pro: 8, // ~$8/block (커뮤니티 추정)
	max5x: 40, // ~$40/block
	max20x: 160, // ~$160/block (20×pro)
} as const;

export type Plan = keyof typeof COST_LIMITS;

export const DEFAULT_PLAN: Plan = "pro";

// 모델별 가격 (per 1M tokens, USD)
export const MODEL_PRICING: Record<
	string,
	{ input: number; cacheCreate: number; cacheRead: number; output: number }
> = {
	opus: { input: 5, cacheCreate: 6.25, cacheRead: 0.5, output: 25 },
	sonnet: { input: 3, cacheCreate: 3.75, cacheRead: 0.3, output: 15 },
	haiku: { input: 1, cacheCreate: 1.25, cacheRead: 0.1, output: 5 },
};

// 모델명에서 가격 키 추출 (예: "claude-opus-4-6" → "opus")
export function getModelKey(model: string): string | null {
	const lower = model.toLowerCase();
	if (lower.includes("opus")) return "opus";
	if (lower.includes("sonnet")) return "sonnet";
	if (lower.includes("haiku")) return "haiku";
	return null;
}

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
	// --plan 미지정 시 null 반환 (Keychain에서 자동 감지)
	const planIndex = args.indexOf("--plan");
	if (planIndex === -1) {
		return { noUsage, blockCostLimit: null };
	}

	const planArg =
		planIndex + 1 < args.length ? args[planIndex + 1] : DEFAULT_PLAN;
	const blockCostLimit =
		COST_LIMITS[planArg as Plan] ?? COST_LIMITS[DEFAULT_PLAN];

	return { noUsage, blockCostLimit };
}

// JSONL 엔트리에서 assistant 타입의 사용량 정보
export interface JSONLAssistantEntry {
	type: "assistant";
	timestamp: string;
	message: {
		model: string;
		usage: {
			input_tokens: number;
			cache_creation_input_tokens: number;
			cache_read_input_tokens: number;
			output_tokens: number;
		};
	};
}

// 단일 엔트리의 비용 계산
export function calculateEntryCost(entry: JSONLAssistantEntry): number {
	const modelKey = getModelKey(entry.message.model);
	if (!modelKey) return 0;

	const pricing = MODEL_PRICING[modelKey];
	const usage = entry.message.usage;

	return (
		(usage.input_tokens * pricing.input +
			usage.cache_creation_input_tokens * pricing.cacheCreate +
			usage.cache_read_input_tokens * pricing.cacheRead +
			usage.output_tokens * pricing.output) /
		1_000_000
	);
}

// 단일 엔트리의 총 토큰 수
function calculateEntryTokens(entry: JSONLAssistantEntry): number {
	const usage = entry.message.usage;
	return (
		usage.input_tokens +
		usage.cache_creation_input_tokens +
		usage.cache_read_input_tokens +
		usage.output_tokens
	);
}

// 5시간 블록 감지 및 현재 활성 블록의 엔트리 추출
export function findActiveBlockEntries(
	entries: JSONLAssistantEntry[],
): JSONLAssistantEntry[] {
	if (entries.length === 0) return [];

	const BLOCK_DURATION_MS = 5 * 60 * 60 * 1000; // 5시간
	const now = Date.now();

	// timestamp 순 정렬
	entries.sort(
		(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	);

	// 블록 감지 (par_cc_usage 방식): 누적 시간 + 갭 기반 블록 분리
	let blockStartTs = new Date(entries[0].timestamp).getTime();
	let blockStart =
		Math.floor(blockStartTs / (60 * 60 * 1000)) * (60 * 60 * 1000);
	let blockEnd = blockStart + BLOCK_DURATION_MS;
	let lastEntryTs = blockStartTs;
	let blockEntries: JSONLAssistantEntry[] = [];

	for (const entry of entries) {
		const ts = new Date(entry.timestamp).getTime();

		// 새 블록 조건 (par_cc_usage 방식):
		// 1) 블록 시작으로부터 5시간 초과 (누적 시간 기반)
		// 2) 이전 엔트리와 5시간 이상 갭 (비활동 갭 기반)
		const timeSinceBlockStart = ts - blockStartTs;
		const timeSinceLastEntry = ts - lastEntryTs;

		if (
			timeSinceBlockStart >= BLOCK_DURATION_MS ||
			timeSinceLastEntry >= BLOCK_DURATION_MS
		) {
			// 새 블록 시작
			blockStartTs = ts;
			blockStart = Math.floor(ts / (60 * 60 * 1000)) * (60 * 60 * 1000);
			blockEnd = blockStart + BLOCK_DURATION_MS;
			blockEntries = [];
		}

		blockEntries.push(entry);
		lastEntryTs = ts;
	}

	// 현재 시각이 블록 내에 있는지 확인
	if (now < blockEnd) {
		return blockEntries;
	}

	return [];
}

// JSONL 파일을 라인별로 스트리밍 파싱 (assistant 엔트리만 추출)
async function parseJSONLFile(
	filePath: string,
	sinceMs: number,
): Promise<JSONLAssistantEntry[]> {
	const entries: JSONLAssistantEntry[] = [];

	const rl = createInterface({
		input: createReadStream(filePath),
		crlfDelay: Number.POSITIVE_INFINITY,
	});

	for await (const line of rl) {
		if (!line.includes('"type":"assistant"')) continue;

		try {
			const obj = JSON.parse(line);
			if (
				obj.type !== "assistant" ||
				!obj.message?.usage ||
				!obj.message?.model ||
				!obj.timestamp
			)
				continue;

			const ts = new Date(obj.timestamp).getTime();
			if (ts < sinceMs) continue;

			entries.push(obj as JSONLAssistantEntry);
		} catch {
			// 파싱 실패한 라인은 무시
		}
	}

	return entries;
}

// ~/.claude/projects/ 전체를 스캔하여 블록 사용량 계산
export async function getBlockUsageFromJSONL(): Promise<BlockUsageInfo> {
	const result: BlockUsageInfo = {
		resetTime: null,
		blockTokens: 0,
		blockCostUSD: 0,
		blockStartTime: null,
	};

	try {
		const homeDir = process.env.HOME || process.env.USERPROFILE || "/tmp";
		const projectsDir = join(homeDir, ".claude", "projects");

		// 최대 10시간 전까지만 스캔 (5시간 블록 2개 분량)
		const sinceMs = Date.now() - 10 * 60 * 60 * 1000;

		// 모든 프로젝트 디렉토리 스캔
		let projectDirs: string[];
		try {
			projectDirs = (await readdir(projectsDir, { withFileTypes: true }))
				.filter((d) => d.isDirectory())
				.map((d) => join(projectsDir, d.name));
		} catch {
			return result;
		}

		// 모든 JSONL 파일 수집
		const jsonlFiles: string[] = [];
		for (const dir of projectDirs) {
			try {
				const files = await readdir(dir);
				for (const file of files) {
					if (file.endsWith(".jsonl")) {
						jsonlFiles.push(join(dir, file));
					}
				}
			} catch {
				// 디렉토리 읽기 실패는 무시
			}
		}

		// 모든 JSONL 파일에서 assistant 엔트리 추출 (병렬)
		const allEntriesArrays = await Promise.all(
			jsonlFiles.map((f) => parseJSONLFile(f, sinceMs)),
		);
		const allEntries = allEntriesArrays.flat();

		if (allEntries.length === 0) return result;

		// 현재 활성 블록의 엔트리 추출
		const activeEntries = findActiveBlockEntries(allEntries);
		if (activeEntries.length === 0) return result;

		// 비용 및 토큰 합산
		for (const entry of activeEntries) {
			result.blockCostUSD += calculateEntryCost(entry);
			result.blockTokens += calculateEntryTokens(entry);
		}

		// 블록 시작 시간
		result.blockStartTime = new Date(activeEntries[0].timestamp).getTime();

		// 리셋 시간 = 블록 시작 시간(시간 단위 floor) + 5시간
		const blockStartFloored =
			Math.floor(result.blockStartTime / (60 * 60 * 1000)) * (60 * 60 * 1000);
		const blockEndTime = blockStartFloored + 5 * 60 * 60 * 1000;
		if (blockEndTime > Date.now()) {
			result.resetTime = new Date(blockEndTime);
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

	const blockUsage = await getBlockUsageFromJSONL();
	cache.blockUsage = { value: blockUsage, timestamp: Date.now() };
	return blockUsage;
}

// macOS Keychain에서 플랜 자동 감지
export async function detectPlanFromKeychain(): Promise<Plan> {
	if (process.platform !== "darwin") return DEFAULT_PLAN;
	try {
		const result =
			await $`security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null`.text();
		const creds = JSON.parse(result);
		const tier = creds?.claudeAiOauth?.rateLimitTier ?? "";
		if (tier.includes("max_20x")) return "max20x";
		if (tier.includes("max_5x")) return "max5x";
		return "pro";
	} catch {
		return DEFAULT_PLAN;
	}
}

// 플랜 감지 (캐싱)
export async function detectPlanCached(): Promise<Plan> {
	if (Date.now() - cache.plan.timestamp < CACHE_TTL.plan) {
		return cache.plan.value;
	}

	const plan = await detectPlanFromKeychain();
	cache.plan = { value: plan, timestamp: Date.now() };
	return plan;
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
	const { noUsage, blockCostLimit: cliCostLimit } = parseCliArgs(args);

	// 1. stdin에서 Claude Code JSON 읽기 (empty stdin 처리)
	const claudeJson: ClaudeStatusInput = JSON.parse((await readStdin()) || "{}");

	// 2. Git 정보 + 블록 사용량 + 플랜 감지 (캐싱, 병렬 실행)
	const [branch, gitChanges, prUrl, blockUsage, detectedPlan] =
		await Promise.all([
			getBranchCached(),
			getGitChangesCached(),
			getPrUrlCached(),
			noUsage ? Promise.resolve(null) : getBlockUsageCached(),
			cliCostLimit === null ? detectPlanCached() : Promise.resolve(null),
		]);

	// --plan 미지정 시 Keychain에서 자동 감지한 플랜 사용
	const blockCostLimit =
		cliCostLimit ?? COST_LIMITS[detectedPlan ?? DEFAULT_PLAN];

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
