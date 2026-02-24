import { C, getUsageColor } from "./colors.ts";
import { formatNumber, formatResetDate, formatTime } from "./format/index.ts";
import type { RenderContext } from "./types.ts";

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

	// 1번째 줄: 폴더 | 워크트리 | 브랜치
	let line1: string;
	if (ctx.mainProjectName) {
		// 워크트리: "📁 cc-statusline | 🌲 rosy-floating-thimble"
		line1 = `${C.WHITE}📁 ${ctx.mainProjectName}${C.RESET} | ${C.WHITE}🌲 ${folder}${C.RESET}`;
	} else {
		line1 = `${C.WHITE}📁 ${folder}${C.RESET}`;
	}
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

		// 리셋 시각
		if (ctx.blockUsage.resetTime) {
			const h = ctx.blockUsage.resetTime.getHours();
			const m = ctx.blockUsage.resetTime.getMinutes();
			parts.push(`${C.WHITE}⏳ ${formatTime(h, m)}${C.RESET}`);
		}

		// 5시간 사용량 (서버 utilization 그대로)
		const usageColor = getUsageColor(ctx.blockUsage.utilization);
		parts.push(
			`${usageColor}📊 ${Math.round(ctx.blockUsage.utilization)}/100${C.RESET}`,
		);

		// 7일 리셋 시간
		if (ctx.blockUsage.sevenDayResetTime) {
			parts.push(
				`${C.WHITE}⏰ ${formatResetDate(ctx.blockUsage.sevenDayResetTime)}${C.RESET}`,
			);
		}

		// 7일 사용량
		if (ctx.blockUsage.sevenDayUtilization !== null) {
			const weekColor = getUsageColor(ctx.blockUsage.sevenDayUtilization);
			parts.push(
				`${weekColor}📅 ${Math.round(ctx.blockUsage.sevenDayUtilization)}/100${C.RESET}`,
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
