import { C } from "../colors.ts";
import type { CiSummary, PrState } from "../types.ts";

export const prStateText = (state: PrState, isDraft: boolean): string => {
	if (isDraft) return "Draft";
	if (state === "OPEN") return "Open";
	if (state === "MERGED") return "Merged";
	return "Closed";
};

export const prStateColor = (state: PrState, isDraft: boolean): string => {
	if (isDraft) return C.WHITE;
	if (state === "OPEN") return C.GREEN;
	if (state === "MERGED") return C.MAGENTA;
	return C.RED;
};

export const ciSummaryText = (ci: CiSummary | null): string => {
	if (ci === null) return "";
	if (ci.conclusion === "failure") return `${ci.count} failed`;
	if (ci.conclusion === "pending") return `${ci.count} running`;
	return `${ci.count} passed`;
};

export const ciSummaryColor = (ci: CiSummary | null): string => {
	if (ci === null) return "";
	if (ci.conclusion === "failure") return C.RED;
	if (ci.conclusion === "pending") return C.YELLOW;
	return C.GREEN;
};
