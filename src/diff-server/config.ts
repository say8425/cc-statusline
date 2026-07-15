import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_DIFF_PORT = 49573;

type Env = Record<string, string | undefined>;

export const resolveDiffPort = (env: Env = process.env): number => {
	const raw = env.CC_STATUSLINE_DIFF_PORT;
	if (!raw) return DEFAULT_DIFF_PORT;
	const n = Number.parseInt(raw, 10);
	return Number.isInteger(n) && n > 0 && n < 65536 ? n : DEFAULT_DIFF_PORT;
};

export const isDiffViewerDisabled = (env: Env = process.env): boolean =>
	env.CC_STATUSLINE_DIFF_DISABLE === "1";

export const getCacheDir = (env: Env = process.env): string => {
	const base = env.XDG_CACHE_HOME || join(env.HOME || homedir(), ".cache");
	return join(base, "cc-statusline");
};

// diffdeck이 자신의 캐시 디렉터리에 토큰을 쓴다 — cc-statusline은 이제 그 파일을
// 읽기만 하므로 diffdeck의 캐시 경로 규칙(XDG_CACHE_HOME 우선, ~/.cache 폴백)을
// 그대로 미러링한다.
export const getDiffdeckCacheDir = (env: Env = process.env): string => {
	const base = env.XDG_CACHE_HOME || join(env.HOME || homedir(), ".cache");
	return join(base, "diffdeck");
};
