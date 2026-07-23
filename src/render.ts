import { C, getUsageColor } from "./colors.ts";
import {
	ciSummaryText,
	formatNumber,
	formatResetDate,
	formatTime,
	prStateText,
} from "./format/index.ts";
import type { RenderContext } from "./types.ts";

// 상태 라인 렌더링 (순수 함수 - 테스트 가능)
export const renderStatusLine = (ctx: RenderContext): string[] => {
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
		const mainU = ctx.mainProjectUrl ? C.UNDERLINE : "";
		const mainText = `${C.WHITE}📁 ${mainU}${ctx.mainProjectName}${C.RESET}`;
		const mainSeg = ctx.mainProjectUrl
			? `\x1b]8;;${ctx.mainProjectUrl}\x07${mainText}\x1b]8;;\x07`
			: mainText;

		const folderU = ctx.projectDirUrl ? C.UNDERLINE : "";
		const folderText = `${C.WHITE}🌲 ${folderU}${folder}${C.RESET}`;
		const folderSeg = ctx.projectDirUrl
			? `\x1b]8;;${ctx.projectDirUrl}\x07${folderText}\x1b]8;;\x07`
			: folderText;

		line1 = `${mainSeg} | ${folderSeg}`;
	} else {
		const folderU = ctx.projectDirUrl ? C.UNDERLINE : "";
		const folderText = `${C.WHITE}📁 ${folderU}${folder}${C.RESET}`;
		line1 = ctx.projectDirUrl
			? `\x1b]8;;${ctx.projectDirUrl}\x07${folderText}\x1b]8;;\x07`
			: folderText;
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
	const modelName = ctx.claudeJson.model?.display_name;
	if (modelName) {
		const effortLevel = ctx.claudeJson.effort?.level;
		let modelText = effortLevel ? `${modelName} ${effortLevel}` : modelName;
		// ultracode는 설정 파일 기반 신호라 세션 effort와 교차검증한다:
		// ultracode 세션은 effort.level을 항상 xhigh로 보고하므로, xhigh가
		// 아니면 이번 세션은 ultracode가 아님 → 배지 억제. 수동 /effort xhigh
		// + 설정 on 조합은 구분 불가라 false positive를 줄일 뿐 완전히 막지는
		// 못함 (ultracode가 stdin에 노출되지 않는 한계, best-effort)
		if (ctx.ultracode && effortLevel === "xhigh") modelText += " ⚡ultra";
		line2 += ` | ${C.WHITE}🤖 ${modelText}${C.RESET}`;
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
	if (hasGitChanges || ctx.baseChanges || ctx.prInfo) {
		let line4 = "";
		if (hasGitChanges) {
			// 클릭 가능할 때(diffViewerUrl 존재)는 밑줄로 표시 (PR 링크와 동일).
			// C.RESET가 밑줄을 지우므로 각 색상 세그먼트에 밑줄을 함께 적용해
			// 연속된 밑줄을 만든다. 링크가 아니면 u=""로 기존 출력과 동일.
			const u = ctx.diffViewerUrl ? C.UNDERLINE : "";
			const changesText =
				`✏️ ${u}${C.WHITE}${ctx.gitChanges.files} files${C.RESET}` +
				`${u} ${C.GREEN}+${ctx.gitChanges.insertions}${C.RESET}` +
				`${u} ${C.RED}-${ctx.gitChanges.deletions}${C.RESET}`;
			// OSC 8 하이퍼링크 (PR 링크와 동일 방식) — diffViewerUrl이 있을 때만
			line4 += ctx.diffViewerUrl
				? `\x1b]8;;${ctx.diffViewerUrl}\x07${changesText}\x1b]8;;\x07`
				: changesText;
		} else if (ctx.baseChanges) {
			// working이 clean이면 base 대비 변경을 대신 표시 (커밋 후에도 진입점 유지).
			const bc = ctx.baseChanges;
			const u = ctx.baseDiffViewerUrl ? C.UNDERLINE : "";
			const baseText =
				`✏️ ${u}vs ${bc.base} ${C.WHITE}${bc.files} files${C.RESET}` +
				`${u} ${C.GREEN}+${bc.insertions}${C.RESET}` +
				`${u} ${C.RED}-${bc.deletions}${C.RESET}`;
			line4 += ctx.baseDiffViewerUrl
				? `\x1b]8;;${ctx.baseDiffViewerUrl}\x07${baseText}\x1b]8;;\x07`
				: baseText;
		}
		if (ctx.prInfo) {
			const { url, state, isDraft, ciStatus } = ctx.prInfo;
			// GitHub Enterprise 지원을 위해 정규식으로 도메인 제거
			const prLabel = url
				.replace(/^https?:\/\/[^/]+\//, "")
				.replace("/pull/", "#");
			const stateText = prStateText(state, isDraft);
			const ciText = ciSummaryText(ciStatus);
			const ciSuffix = ciText ? ` (${ciText})` : "";
			if (line4) line4 += " | ";
			// OSC 8 하이퍼링크 — 라벨 + 상태 + CI 요약 전체가 하나의 링크, 색상 없이
			// 단일 밑줄 span으로 유지(끊김 없는 밑줄). CI 요약은 PR 상태와 무관하게
			// (Merged/Closed 포함) 체크가 있으면 표시.
			line4 +=
				`📎 ${C.WHITE}${C.UNDERLINE}\x1b]8;;${url}\x07${prLabel} ` +
				`[${stateText}]${ciSuffix}${C.RESET}\x1b]8;;\x07`;
		}
		lines.push(line4);
	}

	return lines;
};
