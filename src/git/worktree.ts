import { $ } from "bun";
import { CACHE_TTL, cache } from "../cache.ts";

export async function getMainProjectNameCached(): Promise<string | null> {
	if (
		Date.now() - cache.mainProjectName.timestamp <
		CACHE_TTL.mainProjectName
	) {
		return cache.mainProjectName.value;
	}
	try {
		const result = await $`git rev-parse --git-common-dir 2>/dev/null`.text();
		const gitCommonDir = result.trim();
		if (gitCommonDir === ".git") {
			// 일반 repo - 워크트리 아님
			cache.mainProjectName = { value: null, timestamp: Date.now() };
			return null;
		}
		// 워크트리: gitCommonDir = "/path/to/project/.git"
		const projectRoot = gitCommonDir.replace(/\/.git$/, "");
		const projectName = projectRoot.split("/").pop() || null;
		cache.mainProjectName = { value: projectName, timestamp: Date.now() };
		return projectName;
	} catch {
		return cache.mainProjectName.value;
	}
}
