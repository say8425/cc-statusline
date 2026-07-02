# Persistent Diff-Viewer Entry (Adaptive ✏️) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the statusline `✏️` segment adaptive so a clickable diff-viewer entry persists after committing: show working changes when present, else a `vs <base>` stat (linking the viewer's base mode) when the branch is ahead of its base.

**Architecture:** When the working tree is clean, the statusline resolves the base branch (reusing `resolveBaseRef`) and computes the branch-vs-base shortstat (cached). `render.ts` shows one adaptive `✏️` segment; the OSC 8 link carries `&mode=working` or `&mode=base`, and the viewer honors the URL `mode` (overriding localStorage) so the base link opens directly in base mode.

**Tech Stack:** Bun, TypeScript, `Bun.$` (git + gh); pure `render.ts`; viewer bundled by `build.ts`.

Design spec: `docs/superpowers/specs/2026-07-02-persistent-diff-entry-design.md`.

## Global Constraints

- **Adaptive `✏️` priority:** working changes → `✏️ N files +X -Y` (working-mode link); else branch-ahead-of-base → `✏️ vs <base> N files +X -Y` (base-mode link); else hidden.
- **Base stat only when working tree is clean** (`!hasGitChanges`) — never on the working-changes hot path.
- **Base resolution cached** (`cache.baseRef`, TTL 30_000 ms, mirroring `prUrl`); branch shortstat computed fresh each call (cheap, like `gitChanges`).
- **Link mode:** `buildDiffViewerUrl` gains optional `mode` (`"working"|"base"`), appended as `&mode=` only when provided (existing no-mode calls unchanged).
- **Viewer:** honor `mode` URL param (override + persist to localStorage) on load; absent → existing localStorage/default behavior.
- **untracked NOT counted** in the base stat (parity with working `✏️`).
- **Reuse `resolveBaseRef`** from `src/diff-server/diff.ts`; **extract `parseShortstat`** so `changes.ts` and the new base-changes module share one parser (no duplicated regex block).
- **Underline** the base variant like the working link (OSC 8 + `C.UNDERLINE`), emoji excluded.
- **Runtime:** Bun; `Bun.$` `.nothrow()`; git via CWD (matching `changes.ts`, which runs `git` in the statusline's cwd) — pass `"."` as the repo to `resolveBaseRef`. Explicit types; no `any`; `.ts` import extensions.
- **Regression:** `bun test`, `bun run typecheck`, `bun run lint` (0 warnings) stay green.
- **Commit trailer** (end every commit body with, verbatim):
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g
  ```

## File Structure

| File | Change |
|------|--------|
| `src/git/shortstat.ts` | New `parseShortstat(text)` (extracted) |
| `src/git/changes.ts` | Use `parseShortstat` |
| `src/cache.ts` | Add `baseRef` cache entry + `CACHE_TTL.baseRef` |
| `src/git/baseChanges.ts` | New `getBaseChangesCached()` |
| `src/git/index.ts` | Re-export `getBaseChangesCached` |
| `src/diff-server/link.ts` | `buildDiffViewerUrl` optional `mode` |
| `src/types.ts` | `RenderContext` += `baseChanges`, `baseDiffViewerUrl` |
| `src/render.ts` | Adaptive `✏️` |
| `src/index.ts` | Compute baseChanges (clean tree) + build working/base URLs |
| `src/viewer/main.ts` | Honor URL `mode` param |

---

## Task 1: Extract `parseShortstat`

**Files:**
- Create: `src/git/shortstat.ts`
- Modify: `src/git/changes.ts`
- Test: `src/__tests__/pure.test.ts` (extend) — or a new `src/__tests__/shortstat.test.ts`

**Interfaces:**
- Produces: `parseShortstat(text: string): { files: number; insertions: number; deletions: number }`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/shortstat.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { parseShortstat } from "../git/shortstat.ts";

describe("parseShortstat", () => {
	test("parses files/insertions/deletions", () => {
		expect(
			parseShortstat(" 3 files changed, 86 insertions(+), 3 deletions(-)"),
		).toEqual({ files: 3, insertions: 86, deletions: 3 });
	});
	test("handles singular and missing parts", () => {
		expect(parseShortstat(" 1 file changed, 1 insertion(+)")).toEqual({
			files: 1,
			insertions: 1,
			deletions: 0,
		});
	});
	test("sums multiple shortstat lines", () => {
		expect(
			parseShortstat(
				" 1 file changed, 2 insertions(+)\n 1 file changed, 3 deletions(-)",
			),
		).toEqual({ files: 2, insertions: 2, deletions: 3 });
	});
	test("empty string yields zeros", () => {
		expect(parseShortstat("")).toEqual({ files: 0, insertions: 0, deletions: 0 });
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/shortstat.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/git/shortstat.ts`**

```ts
// git --shortstat 출력 파싱 (단수/복수 모두, 여러 줄 합산)
export function parseShortstat(text: string): {
	files: number;
	insertions: number;
	deletions: number;
} {
	const [files, insertions, deletions] = [
		/(\d+) files?/g,
		/(\d+) insertions?/g,
		/(\d+) deletions?/g,
	].map((regex) =>
		(text.match(regex) || []).reduce(
			(sum, m) => sum + Number.parseInt(m, 10),
			0,
		),
	);
	return { files, insertions, deletions };
}
```

- [ ] **Step 4: Refactor `src/git/changes.ts` to use it**

Replace the inline parsing (the `const [files, insertions, deletions] = [ ... ].map(...)` block) so the function reads:
```ts
import { $ } from "bun";
import { CACHE_TTL, cache } from "../cache.ts";
import { parseShortstat } from "./shortstat.ts";

// Git 변경사항 가져오기 (캐싱)
export async function getGitChangesCached(): Promise<{
	files: number;
	insertions: number;
	deletions: number;
}> {
	if (Date.now() - cache.gitChanges.timestamp < CACHE_TTL.gitChanges) {
		return cache.gitChanges;
	}
	try {
		const [diff, staged] = await Promise.all([
			$`git diff --shortstat 2>/dev/null`.text(),
			$`git diff --cached --shortstat 2>/dev/null`.text(),
		]);
		const { files, insertions, deletions } = parseShortstat(`${diff}\n${staged}`);
		cache.gitChanges = { files, insertions, deletions, timestamp: Date.now() };
		return cache.gitChanges;
	} catch {
		return cache.gitChanges;
	}
}
```

- [ ] **Step 5: Run tests + checks**

Run: `bun test src/__tests__/shortstat.test.ts && bun test && bun run typecheck && bun run lint`
Expected: shortstat tests pass; full suite still green (changes.test.ts unaffected); typecheck/lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/git/shortstat.ts src/git/changes.ts src/__tests__/shortstat.test.ts
git commit -m "refactor: extract parseShortstat for reuse

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 2: `getBaseChangesCached` + base cache

**Files:**
- Modify: `src/cache.ts`
- Create: `src/git/baseChanges.ts`
- Modify: `src/git/index.ts`
- Test: `src/__tests__/base-changes.test.ts`

**Interfaces:**
- Consumes: `resolveBaseRef` (`../diff-server/diff.ts`), `parseShortstat` (`./shortstat.ts`), `cache`/`CACHE_TTL` (`../cache.ts`).
- Produces: `getBaseChangesCached(): Promise<{ base: string; files: number; insertions: number; deletions: number } | null>`

- [ ] **Step 1: Add the base cache to `src/cache.ts`**

In the `cache` object add:
```ts
	baseRef: {
		value: null as { base: string | null; ref: string | null } | null,
		timestamp: 0,
	},
```
In `resetCache()` add:
```ts
	cache.baseRef = { value: null, timestamp: 0 };
```
In `CACHE_TTL` add:
```ts
	baseRef: 30000, // 30초 (base 해결은 gh 호출이라 느림)
```

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/base-changes.test.ts`:
```ts
import { $ } from "bun";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test src/__tests__/base-changes.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Create `src/git/baseChanges.ts`**

```ts
import { $ } from "bun";
import { CACHE_TTL, cache } from "../cache.ts";
import { resolveBaseRef } from "../diff-server/diff.ts";
import { parseShortstat } from "./shortstat.ts";

// 현재 브랜치가 base(PR 타겟/기본 브랜치)보다 앞선 변경 통계 (working이 clean일 때
// diff 진입점을 유지하기 위한 용도). base 해결(gh)은 캐시, shortstat은 매번 계산.
export async function getBaseChangesCached(): Promise<{
	base: string;
	files: number;
	insertions: number;
	deletions: number;
} | null> {
	try {
		let resolved = cache.baseRef.value;
		if (
			resolved === null ||
			Date.now() - cache.baseRef.timestamp >= CACHE_TTL.baseRef
		) {
			resolved = await resolveBaseRef(".");
			cache.baseRef = { value: resolved, timestamp: Date.now() };
		}
		if (!resolved.ref || !resolved.base) return null;

		const mb = (
			await $`git merge-base ${resolved.ref} HEAD 2>/dev/null`.nothrow().text()
		).trim();
		if (!mb) return null;

		const out = await $`git diff ${mb} --shortstat 2>/dev/null`.nothrow().text();
		const { files, insertions, deletions } = parseShortstat(out);
		if (files === 0 && insertions === 0 && deletions === 0) return null;
		return { base: resolved.base, files, insertions, deletions };
	} catch {
		return null;
	}
}
```

- [ ] **Step 5: Re-export from `src/git/index.ts`**

Add:
```ts
export { getBaseChangesCached } from "./baseChanges.ts";
```

- [ ] **Step 6: Run tests + checks**

Run: `bun test src/__tests__/base-changes.test.ts && bun test && bun run typecheck && bun run lint`
Expected: base-changes tests pass; full suite green; typecheck/lint clean. (Note: the `null when no commits beyond base` test relies on the local `main` fallback since the temp repo has no remote/PR — `resolveBaseRef(".")` returns `{base:"main", ref:"main"}` and merge-base(main, HEAD)=HEAD → 0 stat → null.)

- [ ] **Step 7: Commit**

```bash
git add src/cache.ts src/git/baseChanges.ts src/git/index.ts src/__tests__/base-changes.test.ts
git commit -m "feat: add getBaseChangesCached for branch-vs-base stat

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 3: `buildDiffViewerUrl` mode param

**Files:**
- Modify: `src/diff-server/link.ts`
- Test: `src/__tests__/diff-link.test.ts` (extend)

**Interfaces:**
- Produces: `buildDiffViewerUrl(params: { port: number; repo: string; token: string; mode?: "working" | "base" }): string`

- [ ] **Step 1: Add the failing test**

Append to `src/__tests__/diff-link.test.ts`:
```ts
	test("appends mode when provided", () => {
		const url = buildDiffViewerUrl({
			port: 49573,
			repo: "/x",
			token: "abc",
			mode: "base",
		});
		expect(url).toContain("mode=base");
	});
	test("omits mode when not provided", () => {
		const url = buildDiffViewerUrl({ port: 49573, repo: "/x", token: "abc" });
		expect(url).not.toContain("mode=");
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/diff-link.test.ts`
Expected: FAIL (mode not appended).

- [ ] **Step 3: Update `src/diff-server/link.ts`**

```ts
export function buildDiffViewerUrl(params: {
	port: number;
	repo: string;
	token: string;
	mode?: "working" | "base";
}): string {
	const query = new URLSearchParams({
		repo: params.repo,
		token: params.token,
	});
	if (params.mode) query.set("mode", params.mode);
	return `http://127.0.0.1:${params.port}/?${query.toString()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/diff-link.test.ts`
Expected: PASS (existing test + the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/diff-server/link.ts src/__tests__/diff-link.test.ts
git commit -m "feat: support mode param in diff viewer link builder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 4: Adaptive `✏️` in `render.ts` (+ types)

**Files:**
- Modify: `src/types.ts`
- Modify: `src/render.ts`
- Test: `src/__tests__/main.test.ts` (extend)

**Interfaces:**
- Consumes: `RenderContext.baseChanges`, `RenderContext.baseDiffViewerUrl`.

- [ ] **Step 1: Extend `RenderContext` in `src/types.ts`**

Add two fields to the interface (after `diffViewerUrl`):
```ts
	baseChanges: {
		base: string;
		files: number;
		insertions: number;
		deletions: number;
	} | null;
	baseDiffViewerUrl: string | null;
```

- [ ] **Step 2: Write the failing tests**

Add to `src/__tests__/main.test.ts` (the `createRenderContext` helper defaults must include the new fields — update it to add `baseChanges: overrides.baseChanges ?? null` and `baseDiffViewerUrl: overrides.baseDiffViewerUrl ?? null`). Then add:
```ts
	describe("adaptive edit segment", () => {
		test("shows working changes with a link when present", () => {
			const url = "http://127.0.0.1:49573/?repo=%2Fx&token=abc&mode=working";
			const ctx = createRenderContext({
				gitChanges: { files: 3, insertions: 86, deletions: 3 },
				diffViewerUrl: url,
			});
			const line = renderStatusLine(ctx).find((l) => l.includes("3 files"));
			expect(line).toContain(`\x1b]8;;${url}\x07`);
			expect(line).not.toContain("vs ");
		});

		test("shows vs-base stat when working tree is clean but branch is ahead", () => {
			const url = "http://127.0.0.1:49573/?repo=%2Fx&token=abc&mode=base";
			const ctx = createRenderContext({
				gitChanges: { files: 0, insertions: 0, deletions: 0 },
				baseChanges: { base: "main", files: 2, insertions: 10, deletions: 1 },
				baseDiffViewerUrl: url,
			});
			const line = renderStatusLine(ctx).find((l) => l.includes("2 files"));
			expect(line).toBeDefined();
			expect(line).toContain("vs main");
			expect(line).toContain(`\x1b]8;;${url}\x07`);
			expect(line).toContain("\x1b[4m"); // underlined link
		});

		test("shows nothing when neither working nor base changes", () => {
			const ctx = createRenderContext({
				gitChanges: { files: 0, insertions: 0, deletions: 0 },
				baseChanges: null,
			});
			const line = renderStatusLine(ctx).find((l) => l.includes("✏️"));
			expect(line).toBeUndefined();
		});
	});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test src/__tests__/main.test.ts`
Expected: FAIL (vs-base branch not rendered; likely typecheck error until createRenderContext updated — update the helper first, then the assertions fail).

- [ ] **Step 4: Update `src/render.ts`**

Change the line-4 guard and add the base branch. Replace:
```ts
	if (hasGitChanges || ctx.prUrl) {
		let line4 = "";
		if (hasGitChanges) {
			const u = ctx.diffViewerUrl ? C.UNDERLINE : "";
			const changesText =
				`✏️ ${u}${C.WHITE}${ctx.gitChanges.files} files${C.RESET}` +
				`${u} ${C.GREEN}+${ctx.gitChanges.insertions}${C.RESET}` +
				`${u} ${C.RED}-${ctx.gitChanges.deletions}${C.RESET}`;
			// OSC 8 하이퍼링크 (PR 링크와 동일 방식) — diffViewerUrl이 있을 때만
			line4 += ctx.diffViewerUrl
				? `\x1b]8;;${ctx.diffViewerUrl}\x07${changesText}\x1b]8;;\x07`
				: changesText;
		}
```
with:
```ts
	if (hasGitChanges || ctx.baseChanges || ctx.prUrl) {
		let line4 = "";
		if (hasGitChanges) {
			const u = ctx.diffViewerUrl ? C.UNDERLINE : "";
			const changesText =
				`✏️ ${u}${C.WHITE}${ctx.gitChanges.files} files${C.RESET}` +
				`${u} ${C.GREEN}+${ctx.gitChanges.insertions}${C.RESET}` +
				`${u} ${C.RED}-${ctx.gitChanges.deletions}${C.RESET}`;
			// OSC 8 하이퍼링크 (PR 링크와 동일 방식) — diffViewerUrl이 있을 때만
			line4 += ctx.diffViewerUrl
				? `\x1b]8;;${ctx.diffViewerUrl}\x07${changesText}\x1b]8;;\x07`
				: changesText;
		} else if (ctx.baseChanges) {
			// working이 clean이면 base 대비 변경을 대신 표시 (커밋 후에도 진입점 유지).
			const bc = ctx.baseChanges;
			const u = ctx.baseDiffViewerUrl ? C.UNDERLINE : "";
			const baseText =
				`✏️ ${u}vs ${bc.base} ${C.WHITE}${bc.files} files${C.RESET}` +
				`${u} ${C.GREEN}+${bc.insertions}${C.RESET}` +
				`${u} ${C.RED}-${bc.deletions}${C.RESET}`;
			line4 += ctx.baseDiffViewerUrl
				? `\x1b]8;;${ctx.baseDiffViewerUrl}\x07${baseText}\x1b]8;;\x07`
				: baseText;
		}
```
(The `if (ctx.prUrl) { ... }` block and `lines.push(line4)` after it stay unchanged.)

- [ ] **Step 5: Run tests + checks**

Run: `bun test src/__tests__/main.test.ts && bun test && bun run typecheck && bun run lint`
Expected: all pass; lint 0 warnings. (Update any other `RenderContext` literal that fails typecheck — the `createRenderContext` factory should be the only one.)

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/render.ts src/__tests__/main.test.ts
git commit -m "feat: adaptive edit segment showing vs-base changes when clean

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 5: Wire `index.ts` + viewer URL mode

**Files:**
- Modify: `src/index.ts`
- Modify: `src/viewer/main.ts`

**Interfaces:**
- Consumes: `getBaseChangesCached` (Task 2), `buildDiffViewerUrl` mode (Task 3), `RenderContext` fields (Task 4).

- [ ] **Step 1: Update `src/index.ts` main()**

Replace the diff-viewer link block (the `let diffViewerUrl ...; if (hasChanges && repo) { ... }` section) with:
```ts
	// 3. diff 뷰어 링크 — working 변경이 있으면 working, 없으면 base 대비(브랜치가
	//    base보다 앞설 때)로 진입점을 유지. 데몬 ensure는 볼 것이 있을 때만.
	const repo =
		claudeJson.workspace?.project_dir || claudeJson.workspace?.current_dir || "";
	const hasChanges =
		gitChanges.files > 0 ||
		gitChanges.insertions > 0 ||
		gitChanges.deletions > 0;
	let diffViewerUrl: string | null = null;
	let baseDiffViewerUrl: string | null = null;
	let baseChanges: Awaited<ReturnType<typeof getBaseChangesCached>> = null;
	if (!hasChanges && repo) {
		baseChanges = await getBaseChangesCached();
	}
	if (repo && (hasChanges || baseChanges)) {
		const ensured = await ensureDiffServer(repo);
		if (ensured) {
			if (hasChanges) {
				diffViewerUrl = buildDiffViewerUrl({
					port: ensured.port,
					repo,
					token: ensured.token,
					mode: "working",
				});
			} else if (baseChanges) {
				baseDiffViewerUrl = buildDiffViewerUrl({
					port: ensured.port,
					repo,
					token: ensured.token,
					mode: "base",
				});
			}
		}
	}
```
Add `getBaseChangesCached` to the `./git/index.ts` import (the existing named import from `./git/index.ts`). Then pass the new fields into `renderStatusLine({...})`:
```ts
		diffViewerUrl,
		baseChanges,
		baseDiffViewerUrl,
```

- [ ] **Step 2: Update `src/viewer/main.ts` to honor URL mode**

Replace the persisted-mode restore block:
```ts
// Restore persisted diff mode before the initial load (updateBaseOption in
// load() will revert to working if the base turns out to be unresolvable).
if (localStorage.getItem("cc-statusline:diff-mode") === "base") {
	diffMode = "base";
	modeSelect.value = "base";
}
```
with:
```ts
// URL mode (from the statusline link) wins over the persisted preference so a
// "vs base" edit link opens directly in base mode; otherwise restore localStorage.
const urlMode = params.get("mode");
if (urlMode === "base" || urlMode === "working") {
	diffMode = urlMode;
	localStorage.setItem("cc-statusline:diff-mode", urlMode);
	if (modeSelect) modeSelect.value = urlMode;
} else if (localStorage.getItem("cc-statusline:diff-mode") === "base") {
	diffMode = "base";
	modeSelect.value = "base";
}
```
(`params` is the existing `new URLSearchParams(location.search)` at the top of the file.)

- [ ] **Step 3: Typecheck / lint / build / full suite**

Run:
```bash
cd /Users/penguin/dev/cc-statusline/.claude/worktrees/feat+clickable-diff-viewer
bun run typecheck && bun run lint && bun run build && bun test
```
Expected: typecheck exit 0; lint 0 warnings; build ok; all tests pass. (If biome flips a reassigned `let` to `const`, change it back.)

- [ ] **Step 4: Manual smoke — statusline shows vs-base when clean**

Run (from a repo whose branch is ahead of its base and has NO working changes):
```bash
cd /Users/penguin/dev/cc-statusline/.claude/worktrees/feat+clickable-diff-viewer
JSON='{"cost":{"total_duration_ms":0,"total_cost_usd":0},"context_window":{"context_window_size":200000,"current_usage":{"input_tokens":1,"output_tokens":1,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}},"workspace":{"project_dir":"'"$PWD"'","current_dir":"'"$PWD"'"}}'
echo "$JSON" | bun dist/index.js > /tmp/sl.txt 2>&1
python3 -c "print(open('/tmp/sl.txt').read().replace(chr(27),'<ESC>').replace(chr(7),'<BEL>'))"
rm -f /tmp/sl.txt; pkill -f "index.js --diff-server" 2>/dev/null || true
```
Expected: the 4th line shows `✏️ vs <base> N files +N -M` wrapped in an OSC 8 link with `mode=base` (this worktree's branch is ahead of main and, at the moment you run it, has no working changes). If the tree has working changes, you'll see the working `✏️` instead — commit/stash them to see the base variant.

- [ ] **Step 5: Manual browser E2E (controller performs)**

Rebuild + restart the daemon so it serves the latest bundle/server. Then: in a repo with committed branch changes and a clean tree, confirm the statusline's `✏️ vs <base> …` link opens the viewer **already in base mode** (dropdown shows "vs <base>", diff shows the committed changes) — verifying the URL `mode` override.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/viewer/main.ts
git commit -m "feat: wire adaptive edit segment + honor URL mode in viewer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 6: Docs + push

- [ ] **Step 1: Document in CLAUDE.md**

Under the diff-viewer notes in `CLAUDE.md` (after the mode-전환 line), add:
```
- `✏️` 진입점 유지: working 변경이 없어도 브랜치가 base보다 앞서면 `✏️ vs <base> N files +X -Y`로 표시되고 클릭 시 뷰어가 base 모드로 열림 (커밋 후에도 진입점 유지)
```

- [ ] **Step 2: Final verify + commit + push**

```bash
cd /Users/penguin/dev/cc-statusline/.claude/worktrees/feat+clickable-diff-viewer
bun test && bun run typecheck && bun run lint && bun run build
git add CLAUDE.md
git commit -m "docs: document persistent adaptive edit-segment entry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
git push origin HEAD:feat/clickable-diff-viewer
```
Expected: all green; push updates PR #48.

---

## Self-Review (completed by plan author)

**Spec coverage:** adaptive `✏️` priority working→base→hidden (Task 4 render + tests) · base stat only when clean (Task 5 index guard) · base resolution cached 30s + fresh shortstat (Task 2) · reuse `resolveBaseRef` + extracted `parseShortstat` (Tasks 1, 2) · link `mode` param (Task 3) · viewer honors URL mode + persists (Task 5) · untracked excluded (base stat uses `git diff <mb> --shortstat`, no untracked) · RenderContext fields (Task 4) · edges: no ref/merge-base/zero-stat → null (Task 2) · docs (Task 6) · regression green (each task). All spec sections map to a task.

**Placeholder scan:** complete code/commands in every step; no TBD/TODO.

**Type consistency:** `getBaseChangesCached(): Promise<{base,files,insertions,deletions}|null>` (Task 2) matches `RenderContext.baseChanges` shape (Task 4) and index.ts usage (Task 5). `buildDiffViewerUrl({...,mode?})` (Task 3) matches Task 5 calls. `parseShortstat` return shape (Task 1) consumed by changes.ts + baseChanges.ts. `cache.baseRef.value` typed `{base,ref}|null` (Task 2) matches `resolveBaseRef` return (existing). `resolveBaseRef(".")` uses the existing `(repo: string)` signature.
