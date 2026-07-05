import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getCacheDir } from "./config.ts";

type Env = Record<string, string | undefined>;

export function getTokenPath(env: Env = process.env): string {
	return join(getCacheDir(env), "diff-server.token");
}

export function generateToken(): string {
	return crypto.randomUUID().replaceAll("-", "");
}

export function readTokenSync(env: Env = process.env): string | null {
	try {
		const value = readFileSync(getTokenPath(env), "utf8").trim();
		return value || null;
	} catch {
		return null;
	}
}

export function ensureToken(env: Env = process.env): string {
	const existing = readTokenSync(env);
	if (existing) return existing;
	const token = generateToken();
	mkdirSync(getCacheDir(env), { recursive: true, mode: 0o700 });
	writeFileSync(getTokenPath(env), token, { mode: 0o600 });
	return token;
}
