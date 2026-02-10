import type { CliOptions } from "./types.ts";

// CLI 인자 파싱
export function parseCliArgs(args: string[]): CliOptions {
	const showUsage = args.includes("--show-usage");
	return { showUsage };
}
