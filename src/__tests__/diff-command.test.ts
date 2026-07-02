import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { getDiff, isGitRepo, resolveBaseRef } from "../diff-server/diff.ts";

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

describe("getDiff", () => {
	test("returns tracked working-tree changes", async () => {
		writeFileSync(join(repo, "a.txt"), "two\n");
		const diff = await getDiff(repo);
		expect(diff).toContain("a.txt");
		expect(diff).toContain("-one");
		expect(diff).toContain("+two");
	});

	test("excludes untracked by default, includes with opt-in", async () => {
		writeFileSync(join(repo, "b.txt"), "brand new\n");
		const without = await getDiff(repo, { untracked: false });
		expect(without).not.toContain("b.txt");
		const withUntracked = await getDiff(repo, { untracked: true });
		expect(withUntracked).toContain("b.txt");
		expect(withUntracked).toContain("+brand new");
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

describe("getDiff base mode", () => {
	test("base mode includes committed AND uncommitted changes since the base", async () => {
		await $`git -C ${repo} branch -M main`;
		await $`git -C ${repo} checkout -qb feature`;
		// Distinct, non-overlapping markers (toContain is substring match).
		writeFileSync(join(repo, "a.txt"), "ALPHA_on_branch\n");
		await $`git -C ${repo} add a.txt`;
		await $`git -C ${repo} commit -qm feat`;
		writeFileSync(join(repo, "b.txt"), "BETA_working\n");
		await $`git -C ${repo} add b.txt`;

		const working = await getDiff(repo, { mode: "working" });
		expect(working).toContain("BETA_working");
		expect(working).not.toContain("ALPHA_on_branch");

		const base = await getDiff(repo, { mode: "base", ref: "main" });
		expect(base).toContain("ALPHA_on_branch");
		expect(base).toContain("BETA_working");
	});
});
