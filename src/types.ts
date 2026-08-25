// rate_limits 윈도우 구조 (stdin에서 전달)
export interface RateLimitWindow {
	used_percentage: number;
	resets_at: number; // Unix timestamp (초 단위)
}

// rate_limits 구조 (stdin에서 전달)
export interface RateLimits {
	five_hour?: RateLimitWindow;
	seven_day?: RateLimitWindow;
}

// 공식 Claude Code JSON input 타입 정의
export interface ClaudeStatusInput {
	// 세션 고유 식별자. 3번째 줄 오른쪽 끝에 UUID 전체를 그대로 표시한다.
	// 구버전 CLI에는 없을 수 있어 optional — 없으면 세그먼트 자체를 생략.
	session_id?: string;
	cost: {
		total_duration_ms: number;
		total_cost_usd: number;
	};
	context_window: {
		context_window_size: number;
		used_percentage?: number;
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
		// Claude Code 2.1.98+ — linked git worktree name. Declared for type
		// completeness; main project name is still derived via git rev-parse
		// because this field carries a name, not a path.
		git_worktree?: string;
	};
	model?: {
		id: string;
		display_name: string;
	};
	// effort 지원 모델에서만 전달. 알려진 값: low | medium | high | xhigh | max
	effort?: {
		level: string;
	};
	rate_limits?: RateLimits;
}

export interface PrInfo {
	url: string;
	state: PrState;
	isDraft: boolean;
	ciStatus: CiSummary | null;
}

export type PrState = "OPEN" | "MERGED" | "CLOSED";

export type CiConclusion = "success" | "pending" | "failure";

export interface CiSummary {
	conclusion: CiConclusion;
	count: number;
}

// 렌더링 컨텍스트 타입 (테스트를 위한 의존성 주입)
export interface RenderContext {
	claudeJson: ClaudeStatusInput;
	branch: string;
	gitChanges: { files: number; insertions: number; deletions: number };
	prInfo: PrInfo | null;
	ultracode: boolean;
	// 💰 비용 세그먼트 표시 여부 (기본 false, CC_STATUSLINE_SHOW_COST=1로 켬).
	// env 판정은 src/config.ts가 하고 render는 결과만 받는다 (기존 DI 방식 유지).
	showCost: boolean;
	rateLimits: RateLimits | null;
	mainProjectName: string | null;
	diffViewerUrl: string | null;
	baseChanges: {
		base: string;
		files: number;
		insertions: number;
		deletions: number;
	} | null;
	baseDiffViewerUrl: string | null;
	projectDirUrl: string | null;
	mainProjectUrl: string | null;
}
