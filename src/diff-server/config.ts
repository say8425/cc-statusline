import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_DIFF_PORT = 49573;

type Env = Record<string, string | undefined>;

export function resolveDiffPort(env: Env = process.env): number {
	const raw = env.CC_STATUSLINE_DIFF_PORT;
	if (!raw) return DEFAULT_DIFF_PORT;
	const n = Number.parseInt(raw, 10);
	return Number.isInteger(n) && n > 0 && n < 65536 ? n : DEFAULT_DIFF_PORT;
}

export function isDiffViewerDisabled(env: Env = process.env): boolean {
	return env.CC_STATUSLINE_DIFF_DISABLE === "1";
}

export function getCacheDir(env: Env = process.env): string {
	const base = env.XDG_CACHE_HOME || join(env.HOME || homedir(), ".cache");
	return join(base, "cc-statusline");
}
