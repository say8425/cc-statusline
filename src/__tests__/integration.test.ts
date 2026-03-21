import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { resetCache } from "../cache.ts";
import { main } from "../index.ts";

describe("main function (integration)", () => {
	let consoleLogSpy: ReturnType<typeof spyOn>;
	let logs: string[];

	beforeEach(() => {
		resetCache();
		logs = [];
		consoleLogSpy = spyOn(console, "log").mockImplementation(
			(...args: unknown[]) => {
				logs.push(args.map(String).join(" "));
			},
		);
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
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
		// @ts-expect-error - mocking stdin
		Bun.stdin.stream = () => stream;

		try {
			await main();

			// Should have at least 2 lines of output (no usage line without rate_limits)
			expect(logs.length).toBeGreaterThanOrEqual(2);

			// First line should contain project name
			expect(logs[0]).toContain("project");

			// Second line should contain session info
			expect(logs[1]).toContain("01:00");
			expect(logs[1]).toContain("$0.50");
		} finally {
			// @ts-expect-error - restoring stdin
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
		// @ts-expect-error - mocking stdin
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
			// @ts-expect-error - restoring stdin
			Bun.stdin.stream = originalStream;
		}
	});
});
