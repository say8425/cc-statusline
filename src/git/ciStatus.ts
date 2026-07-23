import type { CiSummary } from "../types.ts";

interface CheckItem {
	status?: string; // CheckRun: QUEUED | IN_PROGRESS | COMPLETED | ...
	conclusion?: string | null; // CheckRun: SUCCESS | FAILURE | NEUTRAL | CANCELLED | SKIPPED | TIMED_OUT | ACTION_REQUIRED | STALE
	state?: string; // StatusContext(legacy): SUCCESS | ERROR | FAILURE | PENDING | EXPECTED
}

const FAILURE_CONCLUSIONS = new Set([
	"FAILURE",
	"TIMED_OUT",
	"CANCELLED",
	"ACTION_REQUIRED",
	"STALE",
]);
const PASS_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const FAILURE_STATES = new Set(["FAILURE", "ERROR"]);

// gh pr view의 statusCheckRollup(CheckRun/StatusContext 혼재)을 집계해 실패/진행중/통과
// 건수를 센다. failure > pending > success 우선순위로 대표 상태를 고르고, 그 카테고리의
// 건수를 함께 반환한다. GitHub의 실제 rollup 알고리즘의 근사치(required/optional 구분 없음).
export const aggregateCiStatus = (
	checks: readonly CheckItem[],
): CiSummary | null => {
	if (checks.length === 0) return null;

	let failedCount = 0;
	let pendingCount = 0;
	let passedCount = 0;
	for (const check of checks) {
		if (check.conclusion != null) {
			if (FAILURE_CONCLUSIONS.has(check.conclusion)) failedCount++;
			else if (PASS_CONCLUSIONS.has(check.conclusion)) passedCount++;
			else pendingCount++;
		} else if (check.status != null && check.status !== "COMPLETED") {
			pendingCount++;
		} else if (check.state != null) {
			if (FAILURE_STATES.has(check.state)) failedCount++;
			else if (check.state === "SUCCESS") passedCount++;
			else pendingCount++;
		}
	}

	if (failedCount > 0) return { conclusion: "failure", count: failedCount };
	if (pendingCount > 0) return { conclusion: "pending", count: pendingCount };
	return { conclusion: "success", count: passedCount };
};
