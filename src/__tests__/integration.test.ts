import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { resetCache } from "../cache.ts";
import { main } from "../index.ts";

// main()이 실제 process.env에서 읽는 키 전부 — 테스트가 개발자 셸에 흔들리지 않도록
// beforeEach에서 지우고 afterEach에서 되돌린다
const MAIN_ENV_KEYS = [
	"CC_STATUSLINE_SHOW_COST",
	"CC_STATUSLINE_DIFF_DISABLE",
	"CC_STATUSLINE_DIFF_PORT",
] as const;

describe("main function (integration)", () => {
	let consoleLogSpy: ReturnType<typeof spyOn>;
	let logs: string[];
	let savedEnv: Record<string, string | undefined>;

	beforeEach(() => {
		resetCache();
		// main()이 process.env를 직접 읽는 변수 전부를 지우고 뒤에서 복원한다.
		// isCostVisible이 SHOW_COST를, ensureDiffServer가 DIFF_* 둘을 읽으므로
		// 이걸 안 하면 개발자 셸 상태가 그대로 테스트 결과에 새어 들어온다.
		savedEnv = {};
		for (const key of MAIN_ENV_KEYS) {
			savedEnv[key] = process.env[key];
			delete process.env[key];
		}
		logs = [];
		consoleLogSpy = spyOn(console, "log").mockImplementation(
			(...args: unknown[]) => {
				logs.push(args.map(String).join(" "));
			},
		);
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		for (const key of MAIN_ENV_KEYS) {
			const saved = savedEnv[key];
			if (saved === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = saved;
			}
		}
	});

	test("main function outputs status lines with valid input (no rate_limits)", async () => {
		const testInput = JSON.stringify({
			cost: { total_duration_ms: 3600000, total_cost_usd: 0.5 },
			context_window: {
				context_window_size: 200000,
				current_usage: {
					input_tokens: 50000,
					output_tokens: 10000,
					cache_creation_input_tokens: 5000,
					cache_read_input_tokens: 2000,
				},
			},
			workspace: {
				project_dir: "/test/project",
				current_dir: "/test/project/src",
			},
		});

		// Mock stdin by creating a custom readable stream
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode(testInput));
				controller.close();
			},
		});

		// Override Bun.stdin.stream temporarily
		const originalStream = Bun.stdin.stream;
		Bun.stdin.stream = () => stream;

		try {
			await main();

			// Should have at least 2 lines of output (no usage line without rate_limits)
			expect(logs.length).toBeGreaterThanOrEqual(2);

			// First line should contain project name
			expect(logs[0]).toContain("project");

			// Second line should contain session info — 비용은 기본 숨김
			expect(logs[1]).toContain("01:00");
			expect(logs[1]).not.toContain("$0.50");
			expect(logs[1]).not.toContain("💰");
		} finally {
			Bun.stdin.stream = originalStream;
		}
	});

	test("main function shows cost when CC_STATUSLINE_SHOW_COST=1", async () => {
		process.env.CC_STATUSLINE_SHOW_COST = "1";

		const testInput = JSON.stringify({
			cost: { total_duration_ms: 3600000, total_cost_usd: 0.5 },
			context_window: {
				context_window_size: 200000,
				current_usage: {
					input_tokens: 50000,
					output_tokens: 10000,
					cache_creation_input_tokens: 5000,
					cache_read_input_tokens: 2000,
				},
			},
			workspace: {
				project_dir: "/test/project",
				current_dir: "/test/project/src",
			},
		});

		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode(testInput));
				controller.close();
			},
		});

		const originalStream = Bun.stdin.stream;
		Bun.stdin.stream = () => stream;

		try {
			await main();

			expect(logs[1]).toContain("💰");
			expect(logs[1]).toContain("$0.50");
		} finally {
			Bun.stdin.stream = originalStream;
		}
	});

	test("main function renders session_id from stdin on the usage line", async () => {
		const sessionId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
		const testInput = JSON.stringify({
			session_id: sessionId,
			cost: { total_duration_ms: 0, total_cost_usd: 0 },
			context_window: {
				context_window_size: 200000,
				current_usage: {
					input_tokens: 0,
					output_tokens: 0,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
			},
			workspace: {
				project_dir: "/test/project",
				current_dir: "/test/project",
			},
			rate_limits: {
				five_hour: { used_percentage: 56, resets_at: 1704114000 },
				seven_day: { used_percentage: 37, resets_at: 1704585600 },
			},
		});

		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode(testInput));
				controller.close();
			},
		});

		const originalStream = Bun.stdin.stream;
		Bun.stdin.stream = () => stream;

		try {
			await main();

			// 사용량 줄 오른쪽 끝 — 📅 뒤에 UUID 전체
			expect(logs[2]).toContain("📅");
			expect(logs[2]).toContain(sessionId);
			expect(logs[2].indexOf(sessionId)).toBeGreaterThan(logs[2].indexOf("📅"));
		} finally {
			Bun.stdin.stream = originalStream;
		}
	});

	test("main function does not crash on unknown workspace fields like git_worktree", async () => {
		// workspace.git_worktree is a forward-compat field (Claude Code 2.1.98+)
		// currently declared in the type schema but not consumed by any logic
		const testInput = JSON.stringify({
			cost: { total_duration_ms: 0, total_cost_usd: 0 },
			context_window: {
				context_window_size: 200000,
				current_usage: {
					input_tokens: 0,
					output_tokens: 0,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
			},
			workspace: {
				project_dir: "/test/project",
				current_dir: "/test/project",
				git_worktree: "rosy-thimble",
			},
		});

		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode(testInput));
				controller.close();
			},
		});

		const originalStream = Bun.stdin.stream;
		Bun.stdin.stream = () => stream;

		try {
			await main();

			// Should not throw; output still produced
			expect(logs.length).toBeGreaterThanOrEqual(2);
		} finally {
			Bun.stdin.stream = originalStream;
		}
	});

	test("main function uses used_percentage from context_window", async () => {
		const testInput = JSON.stringify({
			cost: { total_duration_ms: 3600000, total_cost_usd: 0.5 },
			context_window: {
				context_window_size: 200000,
				used_percentage: 42,
				current_usage: {
					input_tokens: 50000,
					output_tokens: 10000,
					cache_creation_input_tokens: 5000,
					cache_read_input_tokens: 2000,
				},
			},
			workspace: {
				project_dir: "/test/project",
				current_dir: "/test/project",
			},
		});

		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode(testInput));
				controller.close();
			},
		});

		const originalStream = Bun.stdin.stream;
		Bun.stdin.stream = () => stream;

		try {
			await main();

			// Should use pre-calculated 42% instead of manual calculation (34%)
			expect(logs[1]).toContain("42%");
		} finally {
			Bun.stdin.stream = originalStream;
		}
	});

	test("main function shows usage when rate_limits is provided in stdin", async () => {
		const testInput = JSON.stringify({
			cost: { total_duration_ms: 0, total_cost_usd: 0 },
			context_window: {
				context_window_size: 200000,
				current_usage: {
					input_tokens: 0,
					output_tokens: 0,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
			},
			workspace: {
				project_dir: "/test",
				current_dir: "/test",
			},
			rate_limits: {
				five_hour: {
					used_percentage: 56,
					resets_at: 1704114000,
				},
				seven_day: {
					used_percentage: 37,
					resets_at: 1704585600,
				},
			},
		});

		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode(testInput));
				controller.close();
			},
		});

		const originalStream = Bun.stdin.stream;
		Bun.stdin.stream = () => stream;

		try {
			await main();

			// Should have at least 3 lines (folder, session, usage)
			expect(logs.length).toBeGreaterThanOrEqual(3);

			// Usage line should contain rate limit info
			const allOutput = logs.join("\n");
			expect(allOutput).toContain("📊");
			expect(allOutput).toContain("56/100");
		} finally {
			Bun.stdin.stream = originalStream;
		}
	});

	test("main function emits a file:// hyperlink for the project folder", async () => {
		const testInput = JSON.stringify({
			cost: { total_duration_ms: 0, total_cost_usd: 0 },
			context_window: {
				context_window_size: 200000,
				current_usage: {
					input_tokens: 0,
					output_tokens: 0,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
			},
			workspace: {
				project_dir: "/Users/test/my-project",
				current_dir: "/Users/test/my-project",
			},
		});

		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode(testInput));
				controller.close();
			},
		});

		const originalStream = Bun.stdin.stream;
		Bun.stdin.stream = () => stream;

		try {
			await main();

			expect(logs[0]).toContain("\x1b]8;;file:///Users/test/my-project\x07");
		} finally {
			Bun.stdin.stream = originalStream;
		}
	});
});
