import { readFileSync } from "node:fs";
import { join } from "node:path";
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

export type DiffFileStatus =
	| "added"
	| "deleted"
	| "modified"
	| "renamed"
	| "untracked";

export interface DiffFile {
	name: string;
	oldName?: string;
	status: DiffFileStatus;
	binary: boolean;
	oldContents: string;
	newContents: string;
}

async function showBytes(
	repo: string,
	rev: string,
	path: string,
): Promise<Uint8Array> {
	const buf = await $`git -C ${repo} show ${`${rev}:${path}`} 2>/dev/null`
		.nothrow()
		.arrayBuffer();
	return new Uint8Array(buf);
}

function readWorkingBytes(repo: string, path: string): Uint8Array {
	try {
		return new Uint8Array(readFileSync(join(repo, path)));
	} catch {
		return new Uint8Array();
	}
}

async function buildFile(
	repo: string,
	base: string,
	status: DiffFileStatus,
	name: string,
	oldName?: string,
): Promise<DiffFile> {
	const oldBytes =
		status === "added" || status === "untracked"
			? new Uint8Array()
			: await showBytes(repo, base, oldName ?? name);
	const newBytes =
		status === "deleted" ? new Uint8Array() : readWorkingBytes(repo, name);
	const binary = oldBytes.includes(0) || newBytes.includes(0);
	const decoder = new TextDecoder();
	return {
		name,
		...(oldName ? { oldName } : {}),
		status,
		binary,
		oldContents: binary ? "" : decoder.decode(oldBytes),
		newContents: binary ? "" : decoder.decode(newBytes),
	};
}

export async function getDiffFiles(
	repo: string,
	opts: { untracked?: boolean; mode?: "working" | "base"; ref?: string } = {},
): Promise<DiffFile[]> {
	const base =
		opts.mode === "base" && opts.ref
			? (
					await $`git -C ${repo} merge-base ${opts.ref} HEAD 2>/dev/null`
						.nothrow()
						.text()
				).trim()
			: "HEAD";
	const files: DiffFile[] = [];
	if (base) {
		const nameStatus =
			await $`git -C ${repo} diff --name-status ${base} 2>/dev/null`
				.nothrow()
				.text();
		for (const line of nameStatus.split("\n")) {
			if (!line.trim()) continue;
			const parts = line.split("\t");
			const code = parts[0] ?? "";
			if (code.startsWith("R")) {
				files.push(
					await buildFile(repo, base, "renamed", parts[2] ?? "", parts[1]),
				);
			} else if (code.startsWith("A")) {
				files.push(await buildFile(repo, base, "added", parts[1] ?? ""));
			} else if (code.startsWith("D")) {
				files.push(await buildFile(repo, base, "deleted", parts[1] ?? ""));
			} else {
				files.push(await buildFile(repo, base, "modified", parts[1] ?? ""));
			}
		}
	}
	if (opts.untracked) {
		const listed =
			await $`git -C ${repo} ls-files --others --exclude-standard 2>/dev/null`
				.nothrow()
				.text();
		for (const path of listed
			.split("\n")
			.map((s) => s.trim())
			.filter(Boolean)) {
			files.push(await buildFile(repo, base, "untracked", path));
		}
	}
	return files;
}
