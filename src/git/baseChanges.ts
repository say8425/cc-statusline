import { $ } from "bun";
import { CACHE_TTL, cache } from "../cache.ts";
import { resolveBaseRef } from "../diff-server/diff.ts";
import { parseShortstat } from "./shortstat.ts";

// 현재 브랜치가 base(PR 타겟/기본 브랜치)보다 앞선 변경 통계 (working이 clean일 때
// diff 진입점을 유지하기 위한 용도). base 해결(gh)은 캐시, shortstat은 매번 계산.
export async function getBaseChangesCached(): Promise<{
	base: string;
	files: number;
	insertions: number;
	deletions: number;
} | null> {
	try {
		let resolved = cache.baseRef.value;
		if (
			resolved === null ||
			Date.now() - cache.baseRef.timestamp >= CACHE_TTL.baseRef
		) {
			resolved = await resolveBaseRef(".");
			cache.baseRef = { value: resolved, timestamp: Date.now() };
		}
		if (!resolved.ref || !resolved.base) return null;

		const mb = (
			await $`git merge-base ${resolved.ref} HEAD 2>/dev/null`.nothrow().text()
		).trim();
		if (!mb) return null;

		const out = await $`git diff ${mb} --shortstat 2>/dev/null`
			.nothrow()
			.text();
		const { files, insertions, deletions } = parseShortstat(out);
		if (files === 0 && insertions === 0 && deletions === 0) return null;
		return { base: resolved.base, files, insertions, deletions };
	} catch {
		return null;
	}
}
