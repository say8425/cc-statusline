# "vs base branch" Diff Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a diff mode that compares the branch against its base (PR target, else default branch) via merge-base-vs-working-tree, so branch changes stay visible after committing.

**Architecture:** Server resolves the base ref (`gh pr view` → `origin/HEAD` → main/master) and, for `mode=base`, diffs `merge-base(ref, HEAD)` against the working tree (committed + uncommitted). `/api/diff` gains a `mode` param and always returns the resolved base name in an `X-Diff-Base` header. The viewer adds a mode dropdown (Working tree / vs `<base>`), persisted in localStorage.

**Tech Stack:** Bun, TypeScript, `Bun.$` (git + gh), `Bun.serve`; viewer bundled by `build.ts`.

Design spec: `docs/superpowers/specs/2026-07-02-base-diff-mode-design.md`.

## Global Constraints

- **Base resolution order:** PR target (`gh pr view --json baseRefName -q .baseRefName`, cwd=repo) → default branch (`git -C <repo> rev-parse --abbrev-ref origin/HEAD`, strip `origin/`) → first existing of `origin/main`, `origin/master`, `main`, `master`.
- **Diff ref:** prefer `origin/<base>` if it exists, else local `<base>`; if neither exists, base mode yields empty diff.
- **vs-base diff:** `git -C <repo> diff $(git -C <repo> merge-base <ref> HEAD) --no-color` (merge-base vs working tree). Untracked handling identical to working mode when `untracked=1`.
- **Modes:** `working` (default; current `git diff HEAD` behavior) and `base`. Default is `working`.
- **`X-Diff-Base` header:** every `/api/diff` response sets it to the resolved base name (or `""` when unresolved), so the viewer can label the dropdown.
- **Base resolution is cached** in the daemon per repo (~10s TTL) — `gh pr view` is slow.
- **Persistence:** viewer mode in `localStorage["cc-statusline:diff-mode"]` (`"working"`/`"base"`).
- **Runtime:** Bun; `Bun.$` with `.nothrow()`; `.cwd(repo)` for `gh` (verified available); `git -C <repo>` for git. Explicit types; no `any`; `.ts` import extensions.
- **Regression:** `bun test`, `bun run typecheck`, `bun run lint` (0 warnings) stay green.
- **Commit trailer** (end every commit body with, verbatim):
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g
  ```

## File Structure

| File | Change |
|------|--------|
| `src/diff-server/diff.ts` | Add `resolveBaseRef`; extend `getDiff` with `mode`/`ref`; share untracked append |
| `src/diff-server/server.ts` | `/api/diff?mode=`, per-repo base cache, `X-Diff-Base` header |
| `src/viewer/index.html` | Mode `<select>` in the toolbar |
| `src/viewer/main.ts` | Mode state + dropdown + localStorage; `fetchDiff` returns `{patch, base}`; label update; wire into load/poll |
| `src/__tests__/diff-command.test.ts` | Tests for `resolveBaseRef` + base-mode `getDiff` |
| `src/__tests__/diff-server.test.ts` | Test `/api/diff?mode=base` + `X-Diff-Base` header |

---

## Task 1: Base resolution + base-mode diff (`diff.ts`)

**Files:**
- Modify: `src/diff-server/diff.ts`
- Test: `src/__tests__/diff-command.test.ts` (extend)

**Interfaces:**
- Produces:
  - `resolveBaseRef(repo: string): Promise<{ base: string | null; ref: string | null }>`
  - `getDiff(repo: string, opts?: { untracked?: boolean; mode?: "working" | "base"; ref?: string }): Promise<string>` (extended; `working` default preserves current behavior)

- [ ] **Step 1: Write the failing tests**

Add to `src/__tests__/diff-command.test.ts` (the file already sets up a temp git repo in `beforeEach` with an initial commit on the default branch and a helper pattern — mirror it). Append these tests:
```ts
import { resolveBaseRef } from "../diff-server/diff.ts";

describe("resolveBaseRef", () => {
	test("falls back to the local default branch when no PR/remote", async () => {
		// beforeEach created `repo` with one commit on its default branch.
		// Ensure a local `main` branch exists pointing at that commit.
		await $`git -C ${repo} branch -f main HEAD`;
		const { base, ref } = await resolveBaseRef(repo);
		expect(base).toBe("main");
		expect(ref).toBe("main");
	});

	test("returns null base when nothing resolvable", async () => {
		const bare = mkdtempSync(join(tmpdir(), "cc-nobase-"));
		await $`git -C ${bare} init -q`;
		await $`git -C ${bare} config user.email t@t.co`;
		await $`git -C ${bare} config user.name test`;
		writeFileSync(join(bare, "x.txt"), "x\n");
		await $`git -C ${bare} add x.txt`;
		await $`git -C ${bare} commit -qm init`;
		// current branch is not main/master and no origin
		await $`git -C ${bare} branch -m feature-only`;
		const { base, ref } = await resolveBaseRef(bare);
		expect(ref).toBeNull();
		rmSync(bare, { recursive: true, force: true });
	});
});

describe("getDiff base mode", () => {
	test("base mode includes committed AND uncommitted changes since the base", async () => {
		// repo has an initial commit on the default branch; make `main` the base.
		await $`git -C ${repo} branch -f main HEAD`;
		await $`git -C ${repo} checkout -qb feature`;
		// committed change on the branch
		writeFileSync(join(repo, "a.txt"), "committed change\n");
		await $`git -C ${repo} add a.txt`;
		await $`git -C ${repo} commit -qm feat`;
		// uncommitted change on top
		writeFileSync(join(repo, "b.txt"), "uncommitted change\n");
		await $`git -C ${repo} add b.txt`;

		const working = await getDiff(repo, { mode: "working" });
		expect(working).toContain("b.txt"); // staged-uncommitted shows in working
		expect(working).not.toContain("a.txt"); // committed does NOT show vs HEAD

		const base = await getDiff(repo, { mode: "base", ref: "main" });
		expect(base).toContain("a.txt"); // committed since base
		expect(base).toContain("b.txt"); // uncommitted since base
	});
});
```
(The top of the file already imports `$` from `bun`, `mkdtempSync`/`rmSync`/`writeFileSync`, `tmpdir`, `join`, and `getDiff`. Add `resolveBaseRef` to the existing `../diff-server/diff.ts` import.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/__tests__/diff-command.test.ts`
Expected: FAIL (`resolveBaseRef` is not exported; `getDiff` ignores `mode`).

- [ ] **Step 3: Implement in `src/diff-server/diff.ts`**

Replace the whole file with:
```ts
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
	const out = await $`git -C ${repo} rev-parse --abbrev-ref origin/HEAD 2>/dev/null`
		.nothrow()
		.text();
	const t = out.trim();
	return t.startsWith("origin/") ? t.slice("origin/".length) : null;
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
			await $`git -C ${repo} diff --no-index --no-color /dev/null ${file} 2>/dev/null`
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
			? await $`git -C ${repo} diff ${mb} --no-color 2>/dev/null`.nothrow().text()
			: "";
	} else {
		tracked = await $`git -C ${repo} diff HEAD --no-color 2>/dev/null`
			.nothrow()
			.text();
	}
	if (!opts.untracked) return tracked;
	return appendUntracked(repo, tracked);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/__tests__/diff-command.test.ts`
Expected: PASS (existing tests + the new `resolveBaseRef` and base-mode tests). Then `bun run typecheck && bun run lint` clean.

- [ ] **Step 5: Commit**

```bash
git add src/diff-server/diff.ts src/__tests__/diff-command.test.ts
git commit -m "feat: resolve base branch and add base-mode diff

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 2: `/api/diff?mode=` + base cache + `X-Diff-Base` header (`server.ts`)

**Files:**
- Modify: `src/diff-server/server.ts`
- Test: `src/__tests__/diff-server.test.ts` (extend)

**Interfaces:**
- Consumes: `resolveBaseRef`, `getDiff` (Task 1).
- Behavior: `/api/diff` reads `mode` (default `working`); resolves base (cached per repo, 10s TTL) and always sets `X-Diff-Base` to the base name (or `""`); in `base` mode passes the resolved `ref` to `getDiff`.

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/diff-server.test.ts`. The `beforeEach` there creates `repo` with a committed file `a.txt` then modifies it (working-tree change). Extend the setup usage in a new test that also builds a base branch:
```ts
import { $ } from "bun"; // already imported at top of file

test("mode=base diffs against the base branch and sets X-Diff-Base", async () => {
	// repo (from beforeEach) has committed a.txt="one" and a working change a.txt="two".
	// Make `main` the base, branch off, commit a new file, keep a working change.
	await $`git -C ${repo} branch -f main HEAD`;
	await $`git -C ${repo} checkout -qb feature`;
	writeFileSync(join(repo, "c.txt"), "committed on branch\n");
	await $`git -C ${repo} add c.txt`;
	await $`git -C ${repo} commit -qm branch-commit`;

	const url = `${base}/api/diff?repo=${encodeURIComponent(repo)}&token=${handle.token}&mode=base`;
	const res = await fetch(url);
	expect(res.status).toBe(200);
	expect(res.headers.get("x-diff-base")).toBe("main");
	const body = await res.text();
	expect(body).toContain("c.txt"); // committed since base is visible in base mode
});

test("working mode still sets X-Diff-Base for the dropdown label", async () => {
	await $`git -C ${repo} branch -f main HEAD`;
	const url = `${base}/api/diff?repo=${encodeURIComponent(repo)}&token=${handle.token}`;
	const res = await fetch(url);
	expect(res.status).toBe(200);
	expect(res.headers.get("x-diff-base")).toBe("main");
});
```
(`base`, `handle`, `repo` are the existing test fixtures; `writeFileSync`/`join` are already imported.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/diff-server.test.ts`
Expected: FAIL (no `mode` handling; no `X-Diff-Base` header).

- [ ] **Step 3: Implement in `src/diff-server/server.ts`**

3a. Update the import at the top of `server.ts`:
```ts
import { getDiff, isGitRepo, resolveBaseRef } from "./diff.ts";
```

3b. Add a per-repo base cache near the top of the module (module scope, after imports):
```ts
const BASE_TTL_MS = 10_000;
const baseCache = new Map<string, { value: { base: string | null; ref: string | null }; at: number }>();

async function resolveBaseCached(
	repo: string,
): Promise<{ base: string | null; ref: string | null }> {
	const now = Date.now();
	const hit = baseCache.get(repo);
	if (hit && now - hit.at < BASE_TTL_MS) return hit.value;
	const value = await resolveBaseRef(repo);
	baseCache.set(repo, { value, at: now });
	return value;
}
```

3c. Replace the `/api/diff` handler block (the `if (url.pathname === "/api/diff") { ... }` in `createHandler`) with:
```ts
		if (url.pathname === "/api/diff") {
			if (url.searchParams.get("token") !== cfg.token) {
				return new Response("forbidden", { status: 403 });
			}
			const repo = url.searchParams.get("repo") ?? "";
			if (!repo || !(await isGitRepo(repo))) {
				return new Response("not a git repository", { status: 400 });
			}
			const untracked = url.searchParams.get("untracked") === "1";
			const mode = url.searchParams.get("mode") === "base" ? "base" : "working";
			const { base, ref } = await resolveBaseCached(repo);
			const diff =
				mode === "base"
					? await getDiff(repo, { untracked, mode: "base", ref: ref ?? undefined })
					: await getDiff(repo, { untracked });
			// NOTE: intentionally no Access-Control-Allow-Origin — cross-origin pages must not read this.
			return new Response(diff, {
				headers: {
					"content-type": "text/plain; charset=utf-8",
					"x-diff-base": base ?? "",
				},
			});
		}
```

- [ ] **Step 4: Run tests + verify**

Run: `bun test src/__tests__/diff-server.test.ts` then full `bun test && bun run typecheck && bun run lint`.
Expected: all pass; lint 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/diff-server/server.ts src/__tests__/diff-server.test.ts
git commit -m "feat: serve base-mode diff with X-Diff-Base header

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 3: Viewer mode dropdown (`index.html` + `main.ts`)

**Files:**
- Modify: `src/viewer/index.html`
- Modify: `src/viewer/main.ts`

**Interfaces:**
- Consumes: `/api/diff?mode=` + `X-Diff-Base` header (Task 2).

- [ ] **Step 1: Add the mode dropdown to the toolbar**

In `src/viewer/index.html`, inside `<div id="toolbar">`, add the select as the FIRST control (before "Split / Unified"):
```html
  <div id="toolbar">
    <select id="diff-mode">
      <option value="working">Working tree</option>
      <option value="base" disabled>vs base</option>
    </select>
    <button id="toggle-style" type="button">Split / Unified</button>
```
(Leave the rest of the toolbar unchanged.)

- [ ] **Step 2: Update `src/viewer/main.ts`**

2a. Add the mode state near the other UI-state vars (after `let includeUntracked = false;`):
```ts
let diffMode: "working" | "base" = "working";
```

2b. Replace the existing `fetchPatch` function with a `fetchDiff` that returns the patch AND the base name, and includes `mode`:
```ts
async function fetchDiff(): Promise<{ patch: string; base: string } | null> {
	const query = new URLSearchParams({
		repo,
		token,
		untracked: includeUntracked ? "1" : "0",
		mode: diffMode,
	});
	try {
		const res = await fetch(`/api/diff?${query.toString()}`);
		if (!res.ok) return null;
		const patch = await res.text();
		return { patch, base: res.headers.get("x-diff-base") ?? "" };
	} catch (err) {
		console.error(err);
		return null;
	}
}
```

2c. Add a helper that updates the dropdown's base option label / disabled state (place it above `load`):
```ts
const modeSelect = document.getElementById("diff-mode") as HTMLSelectElement;

function updateBaseOption(base: string): void {
	const opt = modeSelect?.querySelector<HTMLOptionElement>('option[value="base"]');
	if (!opt) return;
	if (base) {
		opt.textContent = `vs ${base}`;
		opt.disabled = false;
	} else {
		opt.textContent = "vs base (unavailable)";
		opt.disabled = true;
		// If base was selected but is now unavailable, fall back to working.
		if (diffMode === "base") {
			diffMode = "working";
			modeSelect.value = "working";
			localStorage.setItem("cc-statusline:diff-mode", "working");
		}
	}
}
```

2d. Replace `load` to use `fetchDiff` + `updateBaseOption`:
```ts
async function load(): Promise<void> {
	statusEl.textContent = "Loading…";
	const result = await fetchDiff();
	if (result === null) {
		diffMount.innerHTML = '<div id="empty">Failed to load diff.</div>';
		return;
	}
	updateBaseOption(result.base);
	lastPatch = result.patch;
	renderPatch(result.patch);
}
```

2e. Update `poll` to use `fetchDiff` (keep change-detection on the patch string; refresh the base label each tick):
```ts
async function poll(): Promise<void> {
	const result = await fetchDiff();
	if (result === null) return;
	updateBaseOption(result.base);
	if (result.patch === lastPatch) return;
	lastPatch = result.patch;
	renderPatch(result.patch);
}
```

2f. Wire the dropdown + restore persisted mode. Add near the other toolbar listeners (e.g. right after the `toggle-style` listener):
```ts
modeSelect?.addEventListener("change", () => {
	diffMode = modeSelect.value === "base" ? "base" : "working";
	localStorage.setItem("cc-statusline:diff-mode", diffMode);
	void load();
});

// Restore persisted diff mode before the initial load.
if (localStorage.getItem("cc-statusline:diff-mode") === "base") {
	diffMode = "base";
	if (modeSelect) modeSelect.value = "base";
}
```
Ensure this restore block runs BEFORE the existing `void load();` line (move the restore block above `void load();` if needed). The `updateBaseOption` call inside `load()` will disable+revert `base` if it turns out unavailable.

- [ ] **Step 3: Typecheck / lint / build**

Run:
```bash
cd /Users/penguin/dev/cc-statusline/.claude/worktrees/feat+clickable-diff-viewer
bun run typecheck && bun run lint && bun run build
```
Expected: typecheck exit 0; lint 0 warnings; build ok. (If biome converts a `let` you reassign into `const`, change it back to `let`.)

- [ ] **Step 4: Full suite (regression)**

Run: `bun test`
Expected: all pass (viewer not in suite; confirms no breakage).

- [ ] **Step 5: Manual browser E2E (controller performs)**

Daemon on 49573 serves `no-store`, so a normal reload picks up the new bundle. In a repo with a base branch + committed branch changes:
1. Dropdown shows "vs `<base>`" (real base name) and "Working tree".
2. Select "vs `<base>`" → the diff shows committed + uncommitted changes since base.
3. Commit the working changes → in "vs base" mode the diff **still shows them** (the core ask); in "Working tree" mode they disappear (expected).
4. Reload → mode persists (localStorage).
5. With Watch on + base mode, committing/editing keeps the diff current.
6. In a repo where base can't resolve, the "vs base" option is disabled.

- [ ] **Step 6: Commit**

```bash
git add src/viewer/index.html src/viewer/main.ts
git commit -m "feat: add vs-base diff mode dropdown to the viewer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 4: Docs + push

- [ ] **Step 1: Document in CLAUDE.md**

Under the diff-viewer notes in `CLAUDE.md` (the WHY list, after the Watch toggle line), add:
```
- diff 뷰어 모드 전환: `Working tree`(HEAD 대비) / `vs <base>`(PR 타겟 또는 기본 브랜치 대비, merge-base vs 워킹트리) — 커밋해도 base 모드에선 변경이 유지됨
```

- [ ] **Step 2: Final verify + commit + push**

```bash
cd /Users/penguin/dev/cc-statusline/.claude/worktrees/feat+clickable-diff-viewer
bun test && bun run typecheck && bun run lint && bun run build
git add CLAUDE.md
git commit -m "docs: document vs-base diff mode

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
git push origin HEAD:feat/clickable-diff-viewer
```
Expected: all green; push updates PR #48.

---

## Self-Review (completed by plan author)

**Spec coverage:** base resolution PR→default→main/master (Task 1 `resolveBaseRef`) · diff ref origin/<base> preferred (Task 1 candidates) · merge-base vs working tree incl. committed+uncommitted (Task 1 getDiff base mode + test) · untracked in both modes (Task 1 `appendUntracked` shared) · `/api/diff?mode=` + `X-Diff-Base` (Task 2) · base cache 10s (Task 2 `resolveBaseCached`) · dropdown + localStorage + label + disable-when-unresolved (Task 3) · watch/untracked interplay (Task 3 `poll`/`fetchDiff` include mode) · docs (Task 4) · regression green (each task Step 4). All spec sections map to a task.

**Placeholder scan:** complete code/commands in every step; no TBD/TODO.

**Type consistency:** `resolveBaseRef(repo): Promise<{base,ref}>` (Task 1) consumed identically in Task 2. `getDiff(repo, {untracked, mode, ref})` signature matches Task 1 def and Task 2 calls. `fetchDiff(): Promise<{patch, base} | null>` (Task 3) used consistently by `load`/`poll`. Header name `x-diff-base` (lowercased by fetch) matches the server's `X-Diff-Base`. localStorage key `cc-statusline:diff-mode` consistent across restore/change/updateBaseOption.
