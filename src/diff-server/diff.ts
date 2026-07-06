import { readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { $ } from "bun";
import { mapWithLimit } from "./mapLimit.ts";

// buildFile 병렬 실행 상한 — 파일당 git 서브프로세스가 뜨므로 무제한이면
// 대형 diff + watch 폴링에서 프로세스가 폭증한다.
const BUILD_CONCURRENCY = 8;

export const isGitRepo = async (repo: string): Promise<boolean> => {
	try {
		const out =
			await $`git -C ${repo} rev-parse --is-inside-work-tree 2>/dev/null`.text();
		return out.trim() === "true";
	} catch {
		return false;
	}
};

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
	/**
	 * 바이너리 파일 전용 바이트 해시. 내용이 JSON에 실리지 않는 바이너리도
	 * watch 폴링의 직렬화 비교로 변경이 감지되게 하고, blob URL 캐시버스터로
	 * 쓰인다. 텍스트 파일에는 없다.
	 */
	blobVersion?: string;
}

// Uint8Array<ArrayBuffer>로 명시: fetch Response body(BodyInit)는
// SharedArrayBuffer 기반 뷰를 받지 않으므로 넓은 ArrayBufferLike면 안 된다.
const showBytes = async (
	repo: string,
	rev: string,
	path: string,
): Promise<Uint8Array<ArrayBuffer>> => {
	const buf = await $`git -C ${repo} show ${`${rev}:${path}`} 2>/dev/null`
		.nothrow()
		.arrayBuffer();
	return new Uint8Array(buf);
};

const readWorkingBytes = (
	repo: string,
	path: string,
): Uint8Array<ArrayBuffer> => {
	try {
		return new Uint8Array(readFileSync(join(repo, path)));
	} catch {
		return new Uint8Array();
	}
};

const buildFile = async (
	repo: string,
	base: string,
	status: DiffFileStatus,
	name: string,
	oldName?: string,
): Promise<DiffFile> => {
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
		...(binary
			? {
					blobVersion: `${Bun.hash(oldBytes).toString(36)}.${Bun.hash(newBytes).toString(36)}`,
				}
			: {}),
	};
};

const resolveDiffBaseRev = async (
	repo: string,
	opts: { mode?: "working" | "base"; ref?: string },
): Promise<string> =>
	opts.mode === "base" && opts.ref
		? (
				await $`git -C ${repo} merge-base ${opts.ref} HEAD 2>/dev/null`
					.nothrow()
					.text()
			).trim()
		: "HEAD";

/**
 * 이미지 diff용 원본 바이트 조회. side=new는 워킹트리, side=old는 base
 * 리비전(HEAD 또는 merge-base)의 파일 내용. repo 밖을 가리키는 경로나
 * 존재하지 않는 쪽은 null.
 */
export const getFileBytes = async (
	repo: string,
	path: string,
	side: "old" | "new",
	opts: { mode?: "working" | "base"; ref?: string } = {},
): Promise<Uint8Array<ArrayBuffer> | null> => {
	const root = resolve(repo);
	const target = resolve(root, path);
	// 빈 경로 차단: side=old에서 `git show <rev>:`가 트리 목록을 돌려주는 것 방지.
	if (
		!path ||
		isAbsolute(path) ||
		(target !== root && !target.startsWith(`${root}/`))
	) {
		return null;
	}
	if (side === "new") {
		const bytes = readWorkingBytes(repo, path);
		return bytes.length > 0 ? bytes : null;
	}
	const base = await resolveDiffBaseRev(repo, opts);
	if (!base) return null;
	const bytes = await showBytes(repo, base, path);
	return bytes.length > 0 ? bytes : null;
};

export const getDiffFiles = async (
	repo: string,
	opts: { untracked?: boolean; mode?: "working" | "base"; ref?: string } = {},
): Promise<DiffFile[]> => {
	const base = await resolveDiffBaseRev(repo, opts);
	const files: DiffFile[] = [];
	if (base) {
		const nameStatus =
			await $`git -C ${repo} diff --name-status ${base} 2>/dev/null`
				.nothrow()
				.text();
		// 파일별 git show/워킹트리 읽기는 서로 독립이라 병렬화하되, 대형 diff에서
		// git 서브프로세스가 무제한으로 뜨지 않도록 동시성을 제한한다 (순서 유지).
		const specs: Array<{
			status: DiffFileStatus;
			name: string;
			oldName?: string;
		}> = [];
		for (const line of nameStatus.split("\n")) {
			if (!line.trim()) continue;
			const parts = line.split("\t");
			const code = parts[0] ?? "";
			if (code.startsWith("R")) {
				specs.push({
					status: "renamed",
					name: parts[2] ?? "",
					oldName: parts[1],
				});
			} else if (code.startsWith("A")) {
				specs.push({ status: "added", name: parts[1] ?? "" });
			} else if (code.startsWith("D")) {
				specs.push({ status: "deleted", name: parts[1] ?? "" });
			} else {
				specs.push({ status: "modified", name: parts[1] ?? "" });
			}
		}
		files.push(
			...(await mapWithLimit(specs, BUILD_CONCURRENCY, (spec) =>
				buildFile(repo, base, spec.status, spec.name, spec.oldName),
			)),
		);
	}
	if (opts.untracked) {
		const listed =
			await $`git -C ${repo} ls-files --others --exclude-standard 2>/dev/null`
				.nothrow()
				.text();
		const paths = listed
			.split("\n")
			.map((s) => s.trim())
			.filter(Boolean);
		files.push(
			...(await mapWithLimit(paths, BUILD_CONCURRENCY, (path) =>
				buildFile(repo, base, "untracked", path),
			)),
		);
	}
	return files;
};
