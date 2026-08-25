type Env = Record<string, string | undefined>;

// 💰 비용 세그먼트는 기본 숨김 — 보고 싶을 때만 CC_STATUSLINE_SHOW_COST=1로 켠다.
// 판정 규칙("1" 리터럴만 참)은 기존 diff 뷰어 토글(CC_STATUSLINE_DIFF_DISABLE)과 동일.
export const isCostVisible = (env: Env = process.env): boolean =>
	env.CC_STATUSLINE_SHOW_COST === "1";
