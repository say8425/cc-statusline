import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { resolveBaseRef } from "../git/baseRef.ts";

let repo: string;

beforeEach(async () => {
	repo = mkdtempSync(join(tmpdir(), "cc-baseref-"));
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

	test("prefers a remote-tracking base over the local branch", async () => {
		await $`git -C ${repo} branch -M main`;
		const remote = mkdtempSync(join(tmpdir(), "cc-baseref-remote-"));
		await $`git -C ${remote} init -q --bare`;
		await $`git -C ${repo} remote add origin ${remote}`;
		await $`git -C ${repo} push -q origin main`;
		await $`git -C ${repo} remote set-head origin main`;
		const { base, ref } = await resolveBaseRef(repo);
		expect(base).toBe("main");
		expect(ref).toBe("origin/main");
		rmSync(remote, { recursive: true, force: true });
	});
});
