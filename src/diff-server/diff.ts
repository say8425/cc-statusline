import { $ } from "bun";

export async function isGitRepo(repo: string): Promise<boolean> {
	try {
		const out =
			await $`git -C ${repo} rev-parse --is-inside-work-tree 2>/dev/null`.text();
		return out.trim() === "true";
	} catch {
		return false;
	}
}

export async function getDiff(
	repo: string,
	opts: { untracked?: boolean } = {},
): Promise<string> {
	const tracked = await $`git -C ${repo} diff HEAD --no-color 2>/dev/null`
		.nothrow()
		.text();
	if (!opts.untracked) return tracked;

	const listed =
		await $`git -C ${repo} ls-files --others --exclude-standard 2>/dev/null`
			.nothrow()
			.text();
	const files = listed
		.split("\n")
		.map((s) => s.trim())
		.filter(Boolean);

	const parts: string[] = tracked ? [tracked] : [];
	for (const file of files) {
		// --no-index exits 1 when the file differs from /dev/null; capture stdout anyway.
		const synthetic =
			await $`git -C ${repo} diff --no-index --no-color /dev/null ${file} 2>/dev/null`
				.nothrow()
				.text();
		if (synthetic) parts.push(synthetic);
	}
	return parts.join("");
}
