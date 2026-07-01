import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { getDiff, isGitRepo } from "../diff-server/diff.ts";

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
