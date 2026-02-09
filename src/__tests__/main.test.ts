import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import {
	C,
	type ClaudeStatusInput,
	COST_LIMITS,
	type RenderContext,
	renderStatusLine,
} from "../lib.ts";

// Helper to create Claude input JSON
function createClaudeInput(
	overrides: Partial<ClaudeStatusInput> = {},
): ClaudeStatusInput {
	return {
		cost: {
			total_duration_ms: 3600000, // 1 hour
			total_cost_usd: 0.5,
			...((overrides.cost as Record<string, unknown>) || {}),
		},
		context_window: {
			context_window_size: 200000,
			current_usage: {
				input_tokens: 50000,
				output_tokens: 10000,
				cache_creation_input_tokens: 5000,
				cache_read_input_tokens: 2000,
			},
			...((overrides.context_window as Record<string, unknown>) || {}),
		},
		workspace: {
			project_dir: "/Users/test/my-project",
			current_dir: "/Users/test/my-project/src",
			...((overrides.workspace as Record<string, unknown>) || {}),
		},
	} as ClaudeStatusInput;
}

// Helper to create render context
function createRenderContext(
	overrides: Partial<RenderContext> & {
		fullClaudeJson?: ClaudeStatusInput;
	} = {},
): RenderContext {
	return {
		claudeJson:
			overrides.fullClaudeJson ?? createClaudeInput(overrides.claudeJson),
		branch: overrides.branch ?? "main",
		gitChanges: overrides.gitChanges ?? {
			files: 0,
			insertions: 0,
			deletions: 0,
		},
		prUrl: overrides.prUrl ?? null,
		blockUsage: overrides.blockUsage ?? null,
		noUsage: overrides.noUsage ?? true,
		blockCostLimit: overrides.blockCostLimit ?? COST_LIMITS.pro,
	};
}

describe("renderStatusLine", () => {
	afterEach(() => {
		setSystemTime(); // Reset to real time
	});

	describe("basic output format", () => {
		test("outputs folder name on first line", () => {
			const ctx = createRenderContext();
			const lines = renderStatusLine(ctx);

			expect(lines[0]).toContain("my-project");
			expect(lines[0]).toContain("📁");
		});

		test("outputs branch name when available", () => {
			const ctx = createRenderContext({ branch: "feature-branch" });
			const lines = renderStatusLine(ctx);

			expect(lines[0]).toContain("feature-branch");
			expect(lines[0]).toContain("🌿");
		});

		test("omits branch when empty", () => {
			const ctx = createRenderContext({ branch: "" });
			const lines = renderStatusLine(ctx);

			expect(lines[0]).not.toContain("🌿");
		});

		test("outputs session time on second line", () => {
			const ctx = createRenderContext({
				claudeJson: {
					cost: { total_duration_ms: 3600000, total_cost_usd: 0.5 },
				} as Partial<ClaudeStatusInput>,
			});
			const lines = renderStatusLine(ctx);

			expect(lines[1]).toContain("⏱️");
			expect(lines[1]).toContain("01:00");
		});

		test("outputs cost on second line", () => {
			const ctx = createRenderContext({
				claudeJson: {
					cost: { total_duration_ms: 0, total_cost_usd: 1.25 },
				} as Partial<ClaudeStatusInput>,
			});
			const lines = renderStatusLine(ctx);

			expect(lines[1]).toContain("💰");
			expect(lines[1]).toContain("$1.25");
		});

		test("outputs context usage on second line", () => {
			const ctx = createRenderContext();
			const lines = renderStatusLine(ctx);

			expect(lines[1]).toContain("🧠");
			// 50000 + 10000 + 5000 + 2000 = 67000
			expect(lines[1]).toContain("67,000");
		});
	});

	describe("context usage colors", () => {
		test("uses WHITE for low usage (< 50%)", () => {
			const ctx = createRenderContext({
				claudeJson: {
					context_window: {
						context_window_size: 200000,
						current_usage: {
							input_tokens: 40000,
							output_tokens: 0,
							cache_creation_input_tokens: 0,
							cache_read_input_tokens: 0,
						},
					},
				} as Partial<ClaudeStatusInput>,
			});
			const lines = renderStatusLine(ctx);

			// 40000 / 200000 = 20%
			expect(lines[1]).toContain(C.WHITE);
			expect(lines[1]).toContain("20%");
		});

		test("uses YELLOW for medium usage (50-79%)", () => {
			const ctx = createRenderContext({
				claudeJson: {
					context_window: {
						context_window_size: 200000,
						current_usage: {
							input_tokens: 120000,
							output_tokens: 0,
							cache_creation_input_tokens: 0,
							cache_read_input_tokens: 0,
						},
					},
				} as Partial<ClaudeStatusInput>,
			});
			const lines = renderStatusLine(ctx);

			// 120000 / 200000 = 60%
			expect(lines[1]).toContain(C.YELLOW);
			expect(lines[1]).toContain("60%");
		});

		test("uses RED for high usage (>= 80%)", () => {
			const ctx = createRenderContext({
				claudeJson: {
					context_window: {
						context_window_size: 200000,
						current_usage: {
							input_tokens: 180000,
							output_tokens: 0,
							cache_creation_input_tokens: 0,
							cache_read_input_tokens: 0,
						},
					},
				} as Partial<ClaudeStatusInput>,
			});
			const lines = renderStatusLine(ctx);

			// 180000 / 200000 = 90%
			expect(lines[1]).toContain(C.RED);
			expect(lines[1]).toContain("90%");
		});
	});

	describe("--no-usage flag", () => {
		test("skips usage line when noUsage is true", () => {
			const ctx = createRenderContext({
				noUsage: true,
				blockUsage: {
					resetTime: new Date(),
					blockTokens: 10000,
					blockCostUSD: 5.0,
					blockStartTime: Date.now() - 600000,
				},
			});
			const lines = renderStatusLine(ctx);

			const allOutput = lines.join("\n");
			expect(allOutput).not.toContain("⏳");
			expect(allOutput).not.toContain("📊");
		});

		test("shows usage line when noUsage is false", () => {
			const now = Date.now();
			setSystemTime(now);

			const ctx = createRenderContext({
				noUsage: false,
				blockUsage: {
					resetTime: new Date(now + 3600000), // 1 hour later
					blockTokens: 100000,
					blockCostUSD: 5.0,
					blockStartTime: now - 600000, // 10 minutes ago
				},
			});
			const lines = renderStatusLine(ctx);

			const allOutput = lines.join("\n");
			expect(allOutput).toContain("⏳");
			expect(allOutput).toContain("📊");
		});
	});

	describe("block usage display", () => {
		test("shows reset timer when resetTime is set", () => {
			const now = Date.now();
			setSystemTime(now);

			const ctx = createRenderContext({
				noUsage: false,
				blockUsage: {
					resetTime: new Date(now + 2 * 3600000 + 30 * 60000), // 2h 30m later
					blockTokens: 50000,
					blockCostUSD: 3.0,
					blockStartTime: now - 600000,
				},
			});
			const lines = renderStatusLine(ctx);

			expect(lines[2]).toContain("⏳");
			expect(lines[2]).toContain("02:30");
		});

		test("shows block usage as cost percentage", () => {
			const now = Date.now();
			setSystemTime(now);

			const ctx = createRenderContext({
				noUsage: false,
				blockCostLimit: COST_LIMITS.max5x, // $40
				blockUsage: {
					resetTime: new Date(now + 3600000),
					blockTokens: 225000,
					blockCostUSD: 20.0, // 50% of $40
					blockStartTime: now - 600000,
				},
			});
			const lines = renderStatusLine(ctx);

			expect(lines[2]).toContain("📊");
			expect(lines[2]).toContain("$20.00/$40");
			expect(lines[2]).toContain("50%");
		});

		test("shows burn rate when > 0", () => {
			const now = Date.now();
			setSystemTime(now);

			const ctx = createRenderContext({
				noUsage: false,
				blockUsage: {
					resetTime: new Date(now + 3600000),
					blockTokens: 50000, // 50K tokens
					blockCostUSD: 5.0,
					blockStartTime: now - 5 * 60000, // 5 minutes ago -> 10K/min
				},
			});
			const lines = renderStatusLine(ctx);

			expect(lines[2]).toContain("🔥");
			expect(lines[2]).toContain("10K/min");
		});

		test("omits burn rate when elapsed time < 1 minute", () => {
			const now = Date.now();
			setSystemTime(now);

			const ctx = createRenderContext({
				noUsage: false,
				blockUsage: {
					resetTime: new Date(now + 3600000),
					blockTokens: 50000,
					blockCostUSD: 5.0,
					blockStartTime: now - 30000, // 30 seconds ago
				},
			});
			const lines = renderStatusLine(ctx);

			const allOutput = lines.join("\n");
			expect(allOutput).not.toContain("🔥");
		});
	});

	describe("git changes display", () => {
		test("shows git changes when present", () => {
			const ctx = createRenderContext({
				gitChanges: { files: 3, insertions: 50, deletions: 20 },
			});
			const lines = renderStatusLine(ctx);

			const lastLine = lines[lines.length - 1];
			expect(lastLine).toContain("✏️");
			expect(lastLine).toContain("3 files");
			expect(lastLine).toContain("+50");
			expect(lastLine).toContain("-20");
		});

		test("omits git line when no changes", () => {
			const ctx = createRenderContext({
				gitChanges: { files: 0, insertions: 0, deletions: 0 },
				prUrl: null,
			});
			const lines = renderStatusLine(ctx);

			expect(lines.length).toBe(2); // Only folder and session lines
		});

		test("uses GREEN for insertions and RED for deletions", () => {
			const ctx = createRenderContext({
				gitChanges: { files: 1, insertions: 10, deletions: 5 },
			});
			const lines = renderStatusLine(ctx);

			const lastLine = lines[lines.length - 1];
			expect(lastLine).toContain(C.GREEN);
			expect(lastLine).toContain(C.RED);
		});
	});

	describe("PR URL display", () => {
		test("shows PR URL with OSC 8 hyperlink", () => {
			const ctx = createRenderContext({
				prUrl: "https://github.com/owner/repo/pull/123",
			});
			const lines = renderStatusLine(ctx);

			const lastLine = lines[lines.length - 1];
			expect(lastLine).toContain("📎");
			expect(lastLine).toContain("owner/repo#123");
			expect(lastLine).toContain("\x1b]8;;"); // OSC 8 start
			expect(lastLine).toContain("\x07"); // Bell character
		});

		test("combines git changes and PR URL", () => {
			const ctx = createRenderContext({
				gitChanges: { files: 2, insertions: 30, deletions: 10 },
				prUrl: "https://github.com/owner/repo/pull/456",
			});
			const lines = renderStatusLine(ctx);

			const lastLine = lines[lines.length - 1];
			expect(lastLine).toContain("✏️");
			expect(lastLine).toContain("📎");
			expect(lastLine).toContain(" | ");
		});
	});

	describe("time formatting", () => {
		test("formats 0 minutes correctly", () => {
			const ctx = createRenderContext({
				claudeJson: {
					cost: { total_duration_ms: 0, total_cost_usd: 0 },
				} as Partial<ClaudeStatusInput>,
			});
			const lines = renderStatusLine(ctx);

			expect(lines[1]).toContain("00:00");
		});

		test("formats hours and minutes with padding", () => {
			const ctx = createRenderContext({
				claudeJson: {
					cost: {
						total_duration_ms: 2 * 3600000 + 5 * 60000, // 2h 5m
						total_cost_usd: 0,
					},
				} as Partial<ClaudeStatusInput>,
			});
			const lines = renderStatusLine(ctx);

			expect(lines[1]).toContain("02:05");
		});

		test("handles multi-hour sessions", () => {
			const ctx = createRenderContext({
				claudeJson: {
					cost: {
						total_duration_ms: 12 * 3600000 + 45 * 60000, // 12h 45m
						total_cost_usd: 0,
					},
				} as Partial<ClaudeStatusInput>,
			});
			const lines = renderStatusLine(ctx);

			expect(lines[1]).toContain("12:45");
		});
	});

	describe("edge cases", () => {
		test("handles missing workspace gracefully", () => {
			const ctx = createRenderContext({
				fullClaudeJson: {
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
					workspace: {} as ClaudeStatusInput["workspace"],
				},
			});

			// Should not throw
			expect(() => renderStatusLine(ctx)).not.toThrow();
		});

		test("handles missing current_usage gracefully", () => {
			const ctx = createRenderContext({
				fullClaudeJson: {
					cost: { total_duration_ms: 0, total_cost_usd: 0 },
					context_window: {
						context_window_size: 200000,
					} as ClaudeStatusInput["context_window"],
					workspace: { project_dir: "/test", current_dir: "/test" },
				},
			});

			const lines = renderStatusLine(ctx);
			expect(lines[1]).toContain("0 (0%)");
		});

		test("handles null blockUsage when noUsage is false", () => {
			const ctx = createRenderContext({
				noUsage: false,
				blockUsage: null,
			});

			// Should not throw and should have 2 lines (no usage line)
			const lines = renderStatusLine(ctx);
			expect(lines.length).toBe(2);
		});
	});
});
