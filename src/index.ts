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
	gitChanges: { files: 0, insertions: 0, deletions: 0, timestamp: 0 },
	prUrl: { value: null as string | null, timestamp: 0 },
	limitReset: { value: null as Date | null, timestamp: 0 },
};

// 캐시 TTL (ms)
const CACHE_TTL = {
	branch: 5000, // 5초
	gitChanges: 3000, // 3초
	prUrl: 30000, // 30초
	limitReset: 60000, // 60초 (JSONL 파싱은 비용이 크므로 긴 TTL)
};

// 5시간 블록 상수
const SESSION_DURATION_MS = 5 * 60 * 60 * 1000; // 5시간

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

		// 파일 수, insertions, deletions 추출
		const [files, insertions, deletions] = [
			/(\d+) file/g,
			/(\d+) insertion/g,
			/(\d+) deletion/g,
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

// CLI 인자 파싱
const args = process.argv.slice(2);
const noLimit = args.includes("--no-limit");

// 시간을 정각으로 내림
function floorToHour(timestamp: number): number {
	const date = new Date(timestamp);
	date.setUTCMinutes(0, 0, 0);
	return date.getTime();
}

// JSONL 파일에서 리셋 시간 추출
async function parseLimitResetFromJsonl(
	projectDir: string,
): Promise<Date | null> {
	const homeDir = process.env.HOME || "";
	const claudeDir = `${homeDir}/.claude/projects`;

	// projectDir를 키로 변환 (/ -> -)
	const projectKey = projectDir.replace(/\//g, "-");
	const jsonlDir = `${claudeDir}/${projectKey}`;

	try {
		const glob = new Bun.Glob("*.jsonl");
		const files: string[] = [];

		for await (const file of glob.scan({ cwd: jsonlDir, absolute: true })) {
			files.push(file);
		}

		if (files.length === 0) return null;

		// 가장 최근 파일부터 역순으로 처리
		files.sort().reverse();

		let latestResetTime: Date | null = null;
		let latestActivityTime: number | null = null;

		for (const filePath of files) {
			const file = Bun.file(filePath);
			const text = await file.text();
			const lines = text.split("\n").filter((line) => line.trim());

			for (const line of lines) {
				try {
					const data = JSON.parse(line);

					// 1. usageLimitResetTime 추출 (에러 메시지에서)
					if (data.type === "assistant" && data.message?.content) {
						for (const content of data.message.content) {
							if (
								content.text?.includes("Claude AI usage limit reached")
							) {
								const match = content.text.match(/\|(\d+)/);
								if (match?.[1]) {
									const resetTimestamp = Number.parseInt(match[1], 10);
									if (resetTimestamp > 0) {
										const resetDate = new Date(resetTimestamp * 1000);
										if (!latestResetTime || resetDate > latestResetTime) {
											latestResetTime = resetDate;
										}
									}
								}
							}
						}
					}

					// 2. 최신 활동 시간 추적 (5시간 블록 계산용)
					if (data.timestamp) {
						const ts =
							typeof data.timestamp === "string"
								? new Date(data.timestamp).getTime()
								: data.timestamp;
						if (!latestActivityTime || ts > latestActivityTime) {
							latestActivityTime = ts;
						}
					}
				} catch {
					// JSON 파싱 에러 무시
				}
			}
		}

		// 에러 메시지에서 리셋 시간을 찾았으면 반환
		if (latestResetTime && latestResetTime > new Date()) {
			return latestResetTime;
		}

		// 없으면 5시간 블록 기반으로 계산
		if (latestActivityTime) {
			const blockStart = floorToHour(latestActivityTime);
			const blockEnd = new Date(blockStart + SESSION_DURATION_MS);
			if (blockEnd > new Date()) {
				return blockEnd;
			}
		}

		return null;
	} catch {
		return null;
	}
}

// 리셋 시간 가져오기 (캐싱)
async function getLimitResetCached(
	projectDir: string,
): Promise<Date | null> {
	if (Date.now() - cache.limitReset.timestamp < CACHE_TTL.limitReset) {
		return cache.limitReset.value;
	}

	const resetTime = await parseLimitResetFromJsonl(projectDir);
	cache.limitReset = { value: resetTime, timestamp: Date.now() };
	return resetTime;
}

// 리셋까지 남은 시간 계산
function getTimeUntilReset(resetTime: Date): { hours: number; minutes: number } {
	const now = new Date();
	const diff = resetTime.getTime() - now.getTime();

	if (diff <= 0) {
		return { hours: 0, minutes: 0 };
	}

	const hours = Math.floor(diff / (1000 * 60 * 60));
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

	return { hours, minutes };
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

	// 6. Git 정보 + 리셋 시간 (캐싱, 병렬 실행)
	const [branch, gitChanges, prUrl, limitReset] = await Promise.all([
		getBranchCached(),
		getGitChangesCached(),
		getPrUrlCached(),
		noLimit ? Promise.resolve(null) : getLimitResetCached(claudeJson.workspace?.project_dir || ""),
	]);

	// 7. 출력
	// 1번째 줄: 폴더 | 브랜치
	let line1 = `${C.WHITE}📁 ${folder}${C.RESET}`;
	if (branch) {
		line1 += ` | ${C.WHITE}🌿 ${branch}${C.RESET}`;
	}
	console.log(line1);

	// 2번째 줄: 세션 시간 | 비용 | 컨텍스트 | 리셋 타이머
	let line2 =
		`${C.WHITE}⏱️ ${formatTime(sessionHrs, sessionMins)}${C.RESET} | ` +
		`${C.WHITE}💰 $${costUsd.toFixed(2)}${C.RESET} | ` +
		`${ctxColor}🧠 ${formatNumber(totalTokens)} (${contextPct}%)${C.RESET}`;

	if (!noLimit && limitReset) {
		const resetTime = getTimeUntilReset(limitReset);
		line2 += ` | ${C.WHITE}⏳ ${formatTime(resetTime.hours, resetTime.minutes)}${C.RESET}`;
	}

	console.log(line2);

	// 3번째 줄: git changes | PR URL
	const hasGitChanges =
		gitChanges.files > 0 ||
		gitChanges.insertions > 0 ||
		gitChanges.deletions > 0;
	if (hasGitChanges || prUrl) {
		let line3 = "";
		if (hasGitChanges) {
			line3 += `✏️ ${C.WHITE}${gitChanges.files} files${C.RESET} ${C.GREEN}+${gitChanges.insertions}${C.RESET} ${C.RED}-${gitChanges.deletions}${C.RESET}`;
		}
		if (prUrl) {
			const prLabel = prUrl
				.replace("https://github.com/", "")
				.replace("/pull/", "#");
			if (line3) line3 += " | ";
			// OSC 8 하이퍼링크
			line3 += `📎 ${C.WHITE}${C.UNDERLINE}\x1b]8;;${prUrl}\x07${prLabel}\x1b]8;;\x07${C.RESET}`;
		}
		console.log(line3);
	}
}

main().catch(console.error);
