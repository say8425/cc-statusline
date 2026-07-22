import { $ } from "bun";
import { CACHE_TTL, cache } from "../cache.ts";

export const getMainProjectCached = async (): Promise<{
	name: string;
	path: string;
} | null> => {
	if (Date.now() - cache.mainProject.timestamp < CACHE_TTL.mainProject) {
		return cache.mainProject.value;
	}
	try {
		const result = await $`git rev-parse --git-common-dir 2>/dev/null`.text();
		const gitCommonDir = result.trim();
		if (gitCommonDir === ".git") {
			// 일반 repo - 워크트리 아님
			cache.mainProject = { value: null, timestamp: Date.now() };
			return null;
		}
		// 워크트리: gitCommonDir = "/path/to/project/.git"
		const projectRoot = gitCommonDir.replace(/\/.git$/, "");
		const projectName = projectRoot.split("/").pop();
		const value = projectName ? { name: projectName, path: projectRoot } : null;
		cache.mainProject = { value, timestamp: Date.now() };
		return value;
	} catch {
		return cache.mainProject.value;
	}
};
