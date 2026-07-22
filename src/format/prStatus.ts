import { C } from "../colors.ts";
import type { CiStatus, PrState } from "../types.ts";

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

export const ciStatusIcon = (ciStatus: CiStatus): string => {
	if (ciStatus === "success") return "✅";
	if (ciStatus === "pending") return "🟡";
	if (ciStatus === "failure") return "❌";
	return "";
};
