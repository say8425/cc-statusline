// 공식 Claude Code JSON input 타입 정의
export interface ClaudeStatusInput {
	cost: {
		total_duration_ms: number;
		total_cost_usd: number;
	};
	context_window: {
		context_window_size: number;
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
	};
}

// Usage API 공통 윈도우 구조
export interface UsageWindow {
	utilization: number;
	resets_at: string | null;
}

// Usage API 응답 타입
export interface UsageAPIResponse {
	five_hour: UsageWindow | null;
	seven_day: UsageWindow | null;
	seven_day_oauth_apps: UsageWindow | null;
	seven_day_opus: UsageWindow | null;
	iguana_necktie: unknown;
}

// 블록 사용량 정보 타입
export interface BlockUsageInfo {
	resetTime: Date | null;
	utilization: number; // 0-100+ (서버 계산 %)
	sevenDayUtilization: number | null;
	sevenDayResetTime: Date | null;
}

// CLI 파싱 결과 타입
export interface CliOptions {
	showUsage: boolean;
}

// 렌더링 컨텍스트 타입 (테스트를 위한 의존성 주입)
export interface RenderContext {
	claudeJson: ClaudeStatusInput;
	branch: string;
	gitChanges: { files: number; insertions: number; deletions: number };
	prUrl: string | null;
	blockUsage: BlockUsageInfo | null;
	showUsage: boolean;
}
