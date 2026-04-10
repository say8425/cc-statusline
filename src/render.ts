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

	// 2번째 줄: 세션 시간 | 비용 | 컨텍스트 (used_percentage가 있을 때만)
	let line2 =
		`${C.WHITE}⏱️ ${formatTime(sessionHrs, sessionMins)}${C.RESET}` +
		` | ${C.WHITE}💰 $${costUsd.toFixed(2)}${C.RESET}`;
	const usedPercentage = ctx.claudeJson.context_window?.used_percentage;
	if (usedPercentage != null) {
		const usage = ctx.claudeJson.context_window?.current_usage;
		const totalTokens = usage
			? usage.input_tokens +
				usage.output_tokens +
				usage.cache_creation_input_tokens +
				usage.cache_read_input_tokens
			: 0;
		const contextPct = Math.round(usedPercentage);
		const ctxColor = getUsageColor(contextPct);
		line2 += ` | ${ctxColor}🧠 ${formatNumber(totalTokens)} (${contextPct}%)${C.RESET}`;
	}
	lines.push(line2);

	// 3번째 줄: 리셋 타이머 | 5시간 사용량 | 7일 사용량 (rate_limits가 있을 때)
	if (ctx.rateLimits) {
		const parts: string[] = [];

		// 5시간 사용량 및 리셋 시각
		if (ctx.rateLimits.five_hour) {
			const { resets_at, used_percentage } = ctx.rateLimits.five_hour;
			if (resets_at) {
				const resetTime = new Date(resets_at * 1000);
				const h = resetTime.getHours();
				const m = resetTime.getMinutes();
				parts.push(`${C.WHITE}⏳ ${formatTime(h, m)}${C.RESET}`);
			}
			const usageColor = getUsageColor(used_percentage);
			parts.push(
				`${usageColor}📊 ${Math.round(used_percentage)}/100${C.RESET}`,
			);
		}

		// 7일 사용량 및 리셋 시각
		if (ctx.rateLimits.seven_day) {
			const { resets_at, used_percentage } = ctx.rateLimits.seven_day;
			if (resets_at) {
				const resetTime = new Date(resets_at * 1000);
				parts.push(`${C.WHITE}⏰ ${formatResetDate(resetTime)}${C.RESET}`);
			}
			const weekColor = getUsageColor(used_percentage);
			parts.push(`${weekColor}📅 ${Math.round(used_percentage)}/100${C.RESET}`);
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
