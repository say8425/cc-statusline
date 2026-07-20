import { $ } from "bun";

const refExists = async (repo: string, ref: string): Promise<boolean> => {
	const r = await $`git -C ${repo} rev-parse --verify --quiet ${ref}`
		.nothrow()
		.quiet();
	return r.exitCode === 0;
};

const prBaseName = async (repo: string): Promise<string | null> => {
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
};

const defaultBranchName = async (repo: string): Promise<string | null> => {
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
};

/**
 * Resolve the branch to diff against: PR target, else the default branch,
 * else main/master. Returns the base display name and a usable git ref
 * (`origin/<base>` preferred, else local `<base>`), or nulls when unresolved.
 */
export const resolveBaseRef = async (
	repo: string,
): Promise<{ base: string | null; ref: string | null }> => {
	const named = (await prBaseName(repo)) ?? (await defaultBranchName(repo));
	const candidates = named
		? [`origin/${named}`, named]
		: ["origin/main", "origin/master", "main", "master"];
	for (const ref of candidates) {
		// 우선순위 순서대로 첫 매치에서 멈춰야 하므로 의도적으로 순차 실행.
		// oxlint-disable-next-line no-await-in-loop
		if (await refExists(repo, ref)) {
			const base = ref.startsWith("origin/")
				? ref.slice("origin/".length)
				: ref;
			return { base, ref };
		}
	}
	return { base: named, ref: null };
};
