import type { CiSummary, PrState } from "../types.ts";

export const prStateText = (state: PrState, isDraft: boolean): string => {
	if (isDraft) return "Draft";
	if (state === "OPEN") return "Open";
	if (state === "MERGED") return "Merged";
	return "Closed";
};

export const ciSummaryText = (ci: CiSummary | null): string => {
	if (ci === null) return "";
	if (ci.conclusion === "failure") return `${ci.count} failed`;
	if (ci.conclusion === "pending") return `${ci.count} running`;
	return `${ci.count} passed`;
};
