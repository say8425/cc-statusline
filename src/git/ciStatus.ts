import type { CiStatus } from "../types.ts";

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

// gh pr view의 statusCheckRollup(CheckRun/StatusContext 혼재)을 단일 상태로 집계.
// GitHub의 실제 rollup 알고리즘의 근사치 (required/optional 구분 없음).
export const aggregateCiStatus = (checks: readonly CheckItem[]): CiStatus => {
	if (checks.length === 0) return null;

	let hasPending = false;
	for (const check of checks) {
		if (check.conclusion != null) {
			if (FAILURE_CONCLUSIONS.has(check.conclusion)) return "failure";
			if (!PASS_CONCLUSIONS.has(check.conclusion)) hasPending = true;
		} else if (check.status != null && check.status !== "COMPLETED") {
			hasPending = true;
		} else if (check.state != null) {
			if (FAILURE_STATES.has(check.state)) return "failure";
			if (check.state !== "SUCCESS") hasPending = true;
		}
	}
	return hasPending ? "pending" : "success";
};
