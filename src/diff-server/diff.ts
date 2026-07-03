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

async function refExists(repo: string, ref: string): Promise<boolean> {
	const r = await $`git -C ${repo} rev-parse --verify --quiet ${ref}`
		.nothrow()
		.quiet();
	return r.exitCode === 0;
}

async function prBaseName(repo: string): Promise<string | null> {
	try {
		const out = await $`gh pr view --json baseRefName -q .baseRefName`
			.cwd(repo)
			.nothrow()
			.quiet()
			.text();
		return out.trim() || null;
	} catch {
		return null;
	}
}

async function defaultBranchName(repo: string): Promise<string | null> {
	const r =
		await $`git -C ${repo} rev-parse --abbrev-ref origin/HEAD 2>/dev/null`
			.nothrow()
			.quiet();
	// When origin/HEAD is unset, git echoes the arg back and exits non-zero.
	if (r.exitCode !== 0) return null;
	const t = r.text().trim();
	if (!t.startsWith("origin/")) return null;
	const name = t.slice("origin/".length);
	return name && name !== "HEAD" ? name : null;
}

/**
 * Resolve the branch to diff against: PR target, else the default branch,
 * else main/master. Returns the base display name and a usable git ref
 * (`origin/<base>` preferred, else local `<base>`), or nulls when unresolved.
 */
export async function resolveBaseRef(
	repo: string,
): Promise<{ base: string | null; ref: string | null }> {
	const named = (await prBaseName(repo)) ?? (await defaultBranchName(repo));
	const candidates = named
		? [`origin/${named}`, named]
		: ["origin/main", "origin/master", "main", "master"];
	for (const ref of candidates) {
		if (await refExists(repo, ref)) {
			const base = ref.startsWith("origin/")
				? ref.slice("origin/".length)
				: ref;
			return { base, ref };
		}
	}
	return { base: named, ref: null };
}

async function appendUntracked(repo: string, tracked: string): Promise<string> {
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
			await $`git -C ${repo} diff -U100000 --no-index --no-color /dev/null ${file} 2>/dev/null`
				.nothrow()
				.text();
		if (synthetic) parts.push(synthetic);
	}
	return parts.join("");
}

export async function getDiff(
	repo: string,
	opts: { untracked?: boolean; mode?: "working" | "base"; ref?: string } = {},
): Promise<string> {
	let tracked: string;
	if (opts.mode === "base" && opts.ref) {
		const mb = (
			await $`git -C ${repo} merge-base ${opts.ref} HEAD 2>/dev/null`
				.nothrow()
				.text()
		).trim();
		tracked = mb
			? await $`git -C ${repo} diff -U100000 ${mb} --no-color 2>/dev/null`
					.nothrow()
					.text()
			: "";
	} else {
		tracked = await $`git -C ${repo} diff -U100000 HEAD --no-color 2>/dev/null`
			.nothrow()
			.text();
	}
	if (!opts.untracked) return tracked;
	return appendUntracked(repo, tracked);
}
