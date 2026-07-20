import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDiffdeckCacheDir } from "./config.ts";

type Env = Record<string, string | undefined>;

export const getTokenPath = (env: Env = process.env): string =>
	join(getDiffdeckCacheDir(env), "diff-server.token");

export const readTokenSync = (env: Env = process.env): string | null => {
	try {
		const value = readFileSync(getTokenPath(env), "utf8").trim();
		return value || null;
	} catch {
		return null;
	}
};
