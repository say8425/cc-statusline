import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { resetCache } from "../cache.ts";
import { getBaseChangesCached } from "../git/baseChanges.ts";

let repo: string;
let origCwd: string;

beforeEach(async () => {
	resetCache();
	origCwd = process.cwd();
	repo = mkdtempSync(join(tmpdir(), "cc-base-changes-"));
	await $`git -C ${repo} init -q`;
	await $`git -C ${repo} config user.email t@t.co`;
	await $`git -C ${repo} config user.name test`;
	writeFileSync(join(repo, "a.txt"), "one\n");
	await $`git -C ${repo} add a.txt`;
	await $`git -C ${repo} commit -qm init`;
	await $`git -C ${repo} branch -M main`;
	process.chdir(repo); // getBaseChangesCached runs git in cwd
});

afterEach(() => {
	process.chdir(origCwd);
	resetCache();
	rmSync(repo, { recursive: true, force: true });
});

describe("getBaseChangesCached", () => {
	test("null when branch has no commits beyond base", async () => {
		expect(await getBaseChangesCached()).toBeNull();
	});

	test("reports stat for commits since base", async () => {
		await $`git -C ${repo} checkout -qb feature`;
		writeFileSync(join(repo, "a.txt"), "two\nthree\n");
		await $`git -C ${repo} add a.txt`;
		await $`git -C ${repo} commit -qm work`;
		const res = await getBaseChangesCached();
		expect(res).not.toBeNull();
		expect(res?.base).toBe("main");
		expect(res?.files).toBe(1);
		expect(res?.insertions).toBeGreaterThan(0);
	});
});
