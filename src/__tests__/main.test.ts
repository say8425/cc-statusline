import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { C } from "../colors.ts";
import { renderStatusLine } from "../render.ts";
import type { ClaudeStatusInput, RenderContext } from "../types.ts";

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
			used_percentage: 34,
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
		rateLimits: overrides.rateLimits ?? null,
		mainProjectName: overrides.mainProjectName ?? null,
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

	describe("worktree display", () => {
		test("shows project name with worktree emoji when mainProjectName is set", () => {
			const ctx = createRenderContext({
				mainProjectName: "cc-statusline",
				claudeJson: {
					workspace: {
						project_dir:
							"/Users/penguin/dev/cc-statusline/.claude/worktrees/rosy-floating-thimble",
						current_dir:
							"/Users/penguin/dev/cc-statusline/.claude/worktrees/rosy-floating-thimble",
					},
				} as Partial<ClaudeStatusInput>,
			});
			const lines = renderStatusLine(ctx);

			expect(lines[0]).toContain("📁");
			expect(lines[0]).toContain("cc-statusline");
			expect(lines[0]).toContain("🌲");
			expect(lines[0]).toContain("rosy-floating-thimble");
		});

		test("shows only folder name when mainProjectName is null", () => {
			const ctx = createRenderContext({
				mainProjectName: null,
				claudeJson: {
					workspace: {
						project_dir: "/Users/test/my-project",
						current_dir: "/Users/test/my-project",
					},
				} as Partial<ClaudeStatusInput>,
			});
			const lines = renderStatusLine(ctx);

			expect(lines[0]).toContain("my-project");
			expect(lines[0]).not.toContain("(");
		});
	});

	describe("used_percentage from JSON", () => {
		test("shows context segment when used_percentage is provided", () => {
			const ctx = createRenderContext({
				fullClaudeJson: {
					cost: { total_duration_ms: 0, total_cost_usd: 0 },
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
					workspace: { project_dir: "/test", current_dir: "/test" },
				},
			});
			const lines = renderStatusLine(ctx);

			expect(lines[1]).toContain("🧠");
			expect(lines[1]).toContain("42%");
		});

		test("omits context segment when used_percentage is absent", () => {
			const ctx = createRenderContext({
				fullClaudeJson: {
					cost: { total_duration_ms: 0, total_cost_usd: 0 },
					context_window: {
						context_window_size: 200000,
						current_usage: {
							input_tokens: 50000,
							output_tokens: 10000,
							cache_creation_input_tokens: 5000,
							cache_read_input_tokens: 2000,
						},
					},
					workspace: { project_dir: "/test", current_dir: "/test" },
				},
			});
			const lines = renderStatusLine(ctx);

			expect(lines[1]).not.toContain("🧠");
			expect(lines[1]).not.toContain("%");
		});

		test("omits context segment when used_percentage is null", () => {
			const ctx = createRenderContext({
				fullClaudeJson: {
					cost: { total_duration_ms: 0, total_cost_usd: 0 },
					context_window: {
						context_window_size: 200000,
						used_percentage: null as unknown as number,
						current_usage: {
							input_tokens: 100000,
							output_tokens: 0,
							cache_creation_input_tokens: 0,
							cache_read_input_tokens: 0,
						},
					},
					workspace: { project_dir: "/test", current_dir: "/test" },
				},
			});
			const lines = renderStatusLine(ctx);

			expect(lines[1]).not.toContain("🧠");
		});
	});

	describe("context usage colors", () => {
		test("uses WHITE for low usage (< 50%)", () => {
			const ctx = createRenderContext({
				claudeJson: {
					context_window: {
						context_window_size: 200000,
						used_percentage: 20,
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

			expect(lines[1]).toContain(C.WHITE);
			expect(lines[1]).toContain("20%");
		});

		test("uses YELLOW for medium usage (50-79%)", () => {
			const ctx = createRenderContext({
				claudeJson: {
					context_window: {
						context_window_size: 200000,
						used_percentage: 60,
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

			expect(lines[1]).toContain(C.YELLOW);
			expect(lines[1]).toContain("60%");
		});

		test("uses RED for high usage (>= 80%)", () => {
			const ctx = createRenderContext({
				claudeJson: {
					context_window: {
						context_window_size: 200000,
						used_percentage: 90,
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

			expect(lines[1]).toContain(C.RED);
			expect(lines[1]).toContain("90%");
		});
	});

	describe("rate_limits display", () => {
		test("skips usage line when rateLimits is null", () => {
			const ctx = createRenderContext({
				rateLimits: null,
			});
			const lines = renderStatusLine(ctx);

			const allOutput = lines.join("\n");
			expect(allOutput).not.toContain("⏳");
			expect(allOutput).not.toContain("📊");
		});

		test("shows usage line when rateLimits is provided", () => {
			const now = Date.now();
			setSystemTime(now);

			const ctx = createRenderContext({
				rateLimits: {
					five_hour: {
						used_percentage: 56,
						resets_at: Math.floor((now + 3600000) / 1000),
					},
					seven_day: {
						used_percentage: 37,
						resets_at: Math.floor((now + 86400000) / 1000),
					},
				},
			});
			const lines = renderStatusLine(ctx);

			const allOutput = lines.join("\n");
			expect(allOutput).toContain("⏳");
			expect(allOutput).toContain("📊");
		});
	});

	describe("block usage display", () => {
		test("shows reset time as absolute HH:MM", () => {
			const resetTime = new Date(2024, 1, 15, 14, 30); // 14:30

			const ctx = createRenderContext({
				rateLimits: {
					five_hour: {
						used_percentage: 30,
						resets_at: Math.floor(resetTime.getTime() / 1000),
					},
				},
			});
			const lines = renderStatusLine(ctx);

			expect(lines[2]).toContain("⏳");
			expect(lines[2]).toContain("14:30");
		});

		test("shows 5-hour utilization as fraction", () => {
			const now = Date.now();
			setSystemTime(now);

			const ctx = createRenderContext({
				rateLimits: {
					five_hour: {
						used_percentage: 56,
						resets_at: Math.floor((now + 3600000) / 1000),
					},
				},
			});
			const lines = renderStatusLine(ctx);

			expect(lines[2]).toContain("📊");
			expect(lines[2]).toContain("56/100");
		});

		test("shows 7-day utilization when available", () => {
			const now = Date.now();
			setSystemTime(now);

			const ctx = createRenderContext({
				rateLimits: {
					five_hour: {
						used_percentage: 56,
						resets_at: Math.floor((now + 3600000) / 1000),
					},
					seven_day: {
						used_percentage: 37,
						resets_at: Math.floor((now + 86400000) / 1000),
					},
				},
			});
			const lines = renderStatusLine(ctx);

			expect(lines[2]).toContain("📅");
			expect(lines[2]).toContain("37/100");
		});

		test("omits 7-day utilization when not present", () => {
			const now = Date.now();
			setSystemTime(now);

			const ctx = createRenderContext({
				rateLimits: {
					five_hour: {
						used_percentage: 56,
						resets_at: Math.floor((now + 3600000) / 1000),
					},
				},
			});
			const lines = renderStatusLine(ctx);

			const allOutput = lines.join("\n");
			expect(allOutput).not.toContain("📅");
		});

		test("shows weekly reset time when seven_day resets_at is set", () => {
			const now = Date.now();
			setSystemTime(now);

			const ctx = createRenderContext({
				rateLimits: {
					five_hour: {
						used_percentage: 56,
						resets_at: Math.floor((now + 3600000) / 1000),
					},
					seven_day: {
						used_percentage: 37,
						resets_at: Math.floor(
							new Date("2024-02-15T09:00:00+09:00").getTime() / 1000,
						),
					},
				},
			});
			const lines = renderStatusLine(ctx);

			const allOutput = lines.join("\n");
			expect(allOutput).toContain("⏰");
		});

		test("weekly reset time appears between 📊 and 📅", () => {
			const now = Date.now();
			setSystemTime(now);

			const ctx = createRenderContext({
				rateLimits: {
					five_hour: {
						used_percentage: 56,
						resets_at: Math.floor((now + 3600000) / 1000),
					},
					seven_day: {
						used_percentage: 37,
						resets_at: Math.floor(
							new Date("2024-02-15T09:00:00+09:00").getTime() / 1000,
						),
					},
				},
			});
			const lines = renderStatusLine(ctx);

			const usageLine = lines[2];
			const clockIdx = usageLine.indexOf("⏰");
			const chartIdx = usageLine.indexOf("📊");
			const calendarIdx = usageLine.indexOf("📅");
			expect(clockIdx).toBeGreaterThan(chartIdx);
			expect(clockIdx).toBeLessThan(calendarIdx);
		});

		test("uses correct color for high utilization", () => {
			const now = Date.now();
			setSystemTime(now);

			const ctx = createRenderContext({
				rateLimits: {
					five_hour: {
						used_percentage: 85,
						resets_at: Math.floor((now + 3600000) / 1000),
					},
				},
			});
			const lines = renderStatusLine(ctx);

			expect(lines[2]).toContain(C.RED);
			expect(lines[2]).toContain("85/100");
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
			// used_percentage가 없으므로 context 세그먼트 표시 안 함
			expect(lines[1]).not.toContain("🧠");
		});

		test("handles null rateLimits", () => {
			const ctx = createRenderContext({
				rateLimits: null,
			});

			// Should not throw and should have 2 lines (no usage line)
			const lines = renderStatusLine(ctx);
			expect(lines.length).toBe(2);
		});
	});
});
