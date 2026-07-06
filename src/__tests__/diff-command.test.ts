import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import {
	getDiffFiles,
	getFileBytes,
	isGitRepo,
	resolveBaseRef,
} from "../diff-server/diff.ts";

let repo: string;

beforeEach(async () => {
	repo = mkdtempSync(join(tmpdir(), "cc-diff-"));
	await $`git -C ${repo} init -q`;
	await $`git -C ${repo} config user.email t@t.co`;
	await $`git -C ${repo} config user.name test`;
	writeFileSync(join(repo, "a.txt"), "one\n");
	await $`git -C ${repo} add a.txt`;
	await $`git -C ${repo} commit -qm init`;
});

afterEach(() => {
	rmSync(repo, { recursive: true, force: true });
});

describe("isGitRepo", () => {
	test("true for a repo, false for a plain dir", async () => {
		expect(await isGitRepo(repo)).toBe(true);
		const plain = mkdtempSync(join(tmpdir(), "cc-plain-"));
		expect(await isGitRepo(plain)).toBe(false);
		rmSync(plain, { recursive: true, force: true });
	});
});

describe("getDiffFiles", () => {
	test("modified file carries full old and new contents", async () => {
		const lines = `${Array.from({ length: 60 }, (_, i) => `line${i + 1}`).join(
			"\n",
		)}\n`;
		writeFileSync(join(repo, "a.txt"), lines);
		await $`git -C ${repo} add a.txt`;
		await $`git -C ${repo} commit -qm sixty`;
		writeFileSync(join(repo, "a.txt"), lines.replace("line1\n", "LINE1\n"));
		const files = await getDiffFiles(repo);
		expect(files).toHaveLength(1);
		const f = files[0];
		expect(f.name).toBe("a.txt");
		expect(f.status).toBe("modified");
		expect(f.binary).toBe(false);
		expect(f.oldContents).toContain("line1\n");
		expect(f.newContents).toContain("LINE1\n");
		// full content: an unchanged middle line is present in both
		expect(f.oldContents).toContain("line30");
		expect(f.newContents).toContain("line30");
	});

	test("deleted file has empty newContents", async () => {
		rmSync(join(repo, "a.txt"));
		const files = await getDiffFiles(repo);
		expect(files[0].status).toBe("deleted");
		expect(files[0].oldContents).toBe("one\n");
		expect(files[0].newContents).toBe("");
	});

	test("untracked included only with opt-in, as status untracked", async () => {
		writeFileSync(join(repo, "b.txt"), "brand new\n");
		const without = await getDiffFiles(repo, { untracked: false });
		expect(without.find((f) => f.name === "b.txt")).toBeUndefined();
		const withUntracked = await getDiffFiles(repo, { untracked: true });
		const b = withUntracked.find((f) => f.name === "b.txt");
		expect(b?.status).toBe("untracked");
		expect(b?.oldContents).toBe("");
		expect(b?.newContents).toBe("brand new\n");
	});

	test("binary file is flagged with empty contents", async () => {
		writeFileSync(join(repo, "bin.dat"), Buffer.from([0x41, 0x00, 0x42]));
		const files = await getDiffFiles(repo, { untracked: true });
		const bin = files.find((f) => f.name === "bin.dat");
		expect(bin?.binary).toBe(true);
		expect(bin?.oldContents).toBe("");
		expect(bin?.newContents).toBe("");
	});

	test("binary file carries a blobVersion that changes with its bytes", async () => {
		writeFileSync(join(repo, "img.dat"), Buffer.from([0x89, 0x00, 0x01]));
		let files = await getDiffFiles(repo, { untracked: true });
		const v1 = files.find((f) => f.name === "img.dat")?.blobVersion;
		expect(v1).toBeTruthy();
		writeFileSync(join(repo, "img.dat"), Buffer.from([0x89, 0x00, 0x02]));
		files = await getDiffFiles(repo, { untracked: true });
		const v2 = files.find((f) => f.name === "img.dat")?.blobVersion;
		expect(v2).toBeTruthy();
		expect(v2).not.toBe(v1);
	});

	test("text file has no blobVersion", async () => {
		writeFileSync(join(repo, "a.txt"), "changed\n");
		const files = await getDiffFiles(repo);
		expect(files[0]?.blobVersion).toBeUndefined();
	});
});

describe("getFileBytes", () => {
	test("side=new reads the working tree, side=old reads the committed bytes", async () => {
		writeFileSync(join(repo, "img.bin"), Buffer.from([1, 0, 1]));
		await $`git -C ${repo} add img.bin`;
		await $`git -C ${repo} commit -qm img`;
		writeFileSync(join(repo, "img.bin"), Buffer.from([2, 0, 2, 2]));
		const oldBytes = await getFileBytes(repo, "img.bin", "old");
		const newBytes = await getFileBytes(repo, "img.bin", "new");
		expect(Array.from(oldBytes ?? [])).toEqual([1, 0, 1]);
		expect(Array.from(newBytes ?? [])).toEqual([2, 0, 2, 2]);
	});

	test("missing side returns null (old of untracked, new of deleted)", async () => {
		writeFileSync(join(repo, "new.bin"), Buffer.from([3, 0]));
		expect(await getFileBytes(repo, "new.bin", "old")).toBeNull();
		rmSync(join(repo, "a.txt"));
		expect(await getFileBytes(repo, "a.txt", "new")).toBeNull();
	});

	test("rejects paths escaping the repo and the empty path", async () => {
		expect(await getFileBytes(repo, "../outside.txt", "new")).toBeNull();
		expect(await getFileBytes(repo, "/etc/passwd", "new")).toBeNull();
		// 빈 경로가 side=old에서 `git show <rev>:`(트리 목록)로 새지 않아야 한다.
		expect(await getFileBytes(repo, "", "old")).toBeNull();
	});

	test("mode=base reads the merge-base version for side=old", async () => {
		await $`git -C ${repo} branch -M main`;
		writeFileSync(join(repo, "pic.bin"), Buffer.from([9, 0]));
		await $`git -C ${repo} add pic.bin`;
		await $`git -C ${repo} commit -qm base-img`;
		await $`git -C ${repo} checkout -qb feature`;
		writeFileSync(join(repo, "pic.bin"), Buffer.from([8, 0, 8]));
		await $`git -C ${repo} add pic.bin`;
		await $`git -C ${repo} commit -qm feat-img`;
		// Committed on the feature branch: vs HEAD the old side is the branch
		// commit, but vs base (main) it must be the merge-base version.
		const vsHead = await getFileBytes(repo, "pic.bin", "old");
		const vsBase = await getFileBytes(repo, "pic.bin", "old", {
			mode: "base",
			ref: "main",
		});
		expect(Array.from(vsHead ?? [])).toEqual([8, 0, 8]);
		expect(Array.from(vsBase ?? [])).toEqual([9, 0]);
	});
});

describe("resolveBaseRef", () => {
	test("falls back to the local default branch when no PR/remote", async () => {
		await $`git -C ${repo} branch -M main`;
		const { base, ref } = await resolveBaseRef(repo);
		expect(base).toBe("main");
		expect(ref).toBe("main");
	});

	test("returns null ref when nothing resolvable", async () => {
		const bare = mkdtempSync(join(tmpdir(), "cc-nobase-"));
		await $`git -C ${bare} init -q`;
		await $`git -C ${bare} config user.email t@t.co`;
		await $`git -C ${bare} config user.name test`;
		writeFileSync(join(bare, "x.txt"), "x\n");
		await $`git -C ${bare} add x.txt`;
		await $`git -C ${bare} commit -qm init`;
		await $`git -C ${bare} branch -m feature-only`;
		const { ref } = await resolveBaseRef(bare);
		expect(ref).toBeNull();
		rmSync(bare, { recursive: true, force: true });
	});
});

describe("getDiffFiles base mode", () => {
	test("base mode includes committed AND uncommitted changes since the base", async () => {
		await $`git -C ${repo} branch -M main`;
		await $`git -C ${repo} checkout -qb feature`;
		// Distinct, non-overlapping markers (toContain is substring match).
		writeFileSync(join(repo, "a.txt"), "ALPHA_on_branch\n");
		await $`git -C ${repo} add a.txt`;
		await $`git -C ${repo} commit -qm feat`;
		writeFileSync(join(repo, "b.txt"), "BETA_working\n");
		await $`git -C ${repo} add b.txt`;

		const working = await getDiffFiles(repo, { mode: "working" });
		const workingA = working.find((f) => f.name === "a.txt");
		expect(workingA).toBeUndefined();

		const base = await getDiffFiles(repo, { mode: "base", ref: "main" });
		const baseA = base.find((f) => f.name === "a.txt");
		const baseB = base.find((f) => f.name === "b.txt");
		expect(baseA?.newContents).toContain("ALPHA_on_branch");
		expect(baseB?.newContents).toContain("BETA_working");
	});
});
