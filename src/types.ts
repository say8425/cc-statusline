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
		// completeness; main project name is still derived via git_rev-parse
		// because this field carries a name, not a path.
		git_worktree?: string;
	};
	rate_limits?: RateLimits;
}

// 렌더링 컨텍스트 타입 (테스트를 위한 의존성 주입)
export interface RenderContext {
	claudeJson: ClaudeStatusInput;
	branch: string;
	gitChanges: { files: number; insertions: number; deletions: number };
	prUrl: string | null;
	rateLimits: RateLimits | null;
	mainProjectName: string | null;
}
