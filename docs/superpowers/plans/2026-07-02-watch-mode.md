# Diff Viewer Watch Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toolbar **Watch** toggle to the diff viewer that auto-refreshes the diff on repo changes (client-side polling + change detection) while preserving scroll position; persisted in localStorage.

**Architecture:** Viewer-only (`src/viewer/`). Refactor `renderFiles` into an **in-place** `renderPatch` that reuses the existing `CodeView`/`FileTree` instances (so scroll is preserved and there's no flicker), then add a polling loop that re-renders only when the fetched `git diff` actually changed. No server/daemon/token changes — reuses the existing `/api/diff` endpoint.

**Tech Stack:** Bun, TypeScript, `@pierre/diffs` + `@pierre/trees` (vanilla), built by `build.ts` into `dist/viewer/`.

Design spec: `docs/superpowers/specs/2026-07-02-watch-mode-design.md`.

## Global Constraints

- **Viewer-only:** touch only `src/viewer/main.ts` and `src/viewer/index.html`. No server/daemon/token/security changes; poll the existing `/api/diff?repo=&token=&untracked=` endpoint.
- **Runtime/build:** browser bundle via `Bun.build` (already wired in `build.ts`); Pierre are `devDependencies`; bare Pierre imports + explicit `.ts` extension on `./mapStatus.ts`.
- **TypeScript:** explicit types on exported/module functions; no `any`.
- **Polling interval:** `2000` ms constant.
- **Default watch state:** OFF. Persist in `localStorage["cc-statusline:diff-watch"]` as `"1"`/`"0"`.
- **Background tab:** skip a poll tick when `document.hidden`.
- **Change detection:** compare the raw fetched patch string to the last rendered one; re-render only on difference.
- **Scroll preservation:** reuse the `CodeView` instance across updates (`setItems` reconciles); recreate it only when `diffStyle` changes or when transitioning from empty.
- **Regression:** `bun test` (114 tests), `bun run typecheck`, `bun run lint` (0 warnings) must all stay green — the viewer is browser-only and not in the unit suite, so these only need to keep passing.
- **Commit trailer** (end every commit body with, verbatim):
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g
  ```

## File Structure

| File | Change |
|------|--------|
| `src/viewer/main.ts` | Refactor to in-place `renderPatch` + `fetchPatch`; add watch polling/toggle/localStorage/hidden-pause |
| `src/viewer/index.html` | Add the `Watch` checkbox to the toolbar |

## Verified Pierre APIs (from installed `.d.ts`)

- `CodeView`: `new CodeView(options)`, `.setup(root)`, `.setItems(items)` (reconciles, preserves scroll), `.getScrollTop(): number`, `.scrollTo({ type: "position", position })`, `.render()`, `.cleanUp()`.
- `FileTree`: `new FileTree(options)`, `.render({ containerWrapper })`, `.resetPaths(paths)`, `.setGitStatus(gitStatus)`, `.cleanUp()`.

---

## Task 1: In-place `renderPatch` refactor (scroll-preserving)

Refactor the viewer so updates reuse the existing components instead of tearing down + rebuilding on every render. This preserves scroll for the existing manual Refresh / focus / toggle paths and is the foundation watch mode builds on.

**Files:**
- Modify: `src/viewer/main.ts`

**Interfaces:**
- Produces (module-level, used by Task 2):
  - `fetchPatch(): Promise<string | null>` — fetch `/api/diff` with current params; `null` on error/non-ok.
  - `renderPatch(patch: string): void` — parse + render in place (reuses instances; preserves scroll).
  - `lastPatch: string | null`, `lastTreeKey: string | null`, `renderedDiffStyle: "unified" | "split" | null` — render-state trackers.

- [ ] **Step 1: Replace the render/load section of `src/viewer/main.ts`**

Replace the current `renderFiles` function AND the `load` function (lines ~22-80, from `function renderFiles` through the end of `async function load`) with the following. Keep the file's existing imports and the top module vars (`params`, `repo`, `token`, `treeMount`, `diffMount`, `statusEl`, `diffStyle`, `includeUntracked`, `codeView`, `fileTree`) as they are, and add the three new trackers shown here:

```ts
let lastPatch: string | null = null;
let lastTreeKey: string | null = null;
let renderedDiffStyle: "unified" | "split" | null = null;

function teardownViews(): void {
	codeView?.cleanUp();
	codeView = null;
	fileTree?.cleanUp();
	fileTree = null;
	renderedDiffStyle = null;
	lastTreeKey = null;
	treeMount.replaceChildren();
}

function renderPatch(patch: string): void {
	const files = parsePatchFiles(patch).flatMap((p) => p.files);

	if (files.length === 0) {
		teardownViews();
		diffMount.replaceChildren();
		diffMount.innerHTML = '<div id="empty">No changes.</div>';
		statusEl.textContent = "";
		return;
	}
	statusEl.textContent = `${files.length} file(s)`;

	const paths = files.map((f) => f.name);
	const gitStatus = files.map((f) => ({
		path: f.name,
		status: changeTypeToGitStatus(f.type),
	}));
	const items = files.map(
		(f) => ({ id: f.name, type: "diff" as const, fileDiff: f }),
	);

	// File tree: create once; afterwards update in place only when the file
	// set or statuses changed (so editing a file's contents doesn't reset it).
	const treeKey = JSON.stringify(gitStatus);
	if (!fileTree) {
		treeMount.replaceChildren();
		fileTree = new FileTree({
			paths,
			gitStatus,
			initialExpansion: "open",
			flattenEmptyDirectories: true,
			search: true,
			onSelectionChange: (selected) => {
				const path = selected[0];
				if (path && codeView) codeView.scrollTo({ type: "item", id: path });
			},
		});
		fileTree.render({ containerWrapper: treeMount });
		lastTreeKey = treeKey;
	} else if (treeKey !== lastTreeKey) {
		fileTree.resetPaths(paths);
		fileTree.setGitStatus(gitStatus);
		lastTreeKey = treeKey;
	}

	// Diff panel: recreate the CodeView on first render, when transitioning
	// from empty, or when diffStyle changed; otherwise reuse it so scroll is
	// preserved across updates.
	if (!codeView || renderedDiffStyle !== diffStyle) {
		codeView?.cleanUp();
		diffMount.replaceChildren();
		codeView = new CodeView({ diffStyle, themeType: "dark", stickyHeaders: true });
		codeView.setup(diffMount);
		codeView.setItems(items);
		codeView.render();
		renderedDiffStyle = diffStyle;
		// First-paint stabilization: the virtualized CodeView fills its visible
		// range only after the container is measured. Re-render on the next two
		// frames (guarded against a superseded instance).
		const cv = codeView;
		requestAnimationFrame(() => {
			if (cv !== codeView) return;
			cv.render();
			requestAnimationFrame(() => {
				if (cv === codeView) cv.render();
			});
		});
	} else {
		const scrollTop = codeView.getScrollTop();
		codeView.setItems(items);
		codeView.render();
		codeView.scrollTo({ type: "position", position: scrollTop });
	}
}

async function fetchPatch(): Promise<string | null> {
	const query = new URLSearchParams({
		repo,
		token,
		untracked: includeUntracked ? "1" : "0",
	});
	try {
		const res = await fetch(`/api/diff?${query.toString()}`);
		if (!res.ok) return null;
		return await res.text();
	} catch (err) {
		console.error(err);
		return null;
	}
}

async function load(): Promise<void> {
	statusEl.textContent = "Loading…";
	const patch = await fetchPatch();
	if (patch === null) {
		diffMount.innerHTML = '<div id="empty">Failed to load diff.</div>';
		return;
	}
	lastPatch = patch;
	renderPatch(patch);
}
```

Note: the old `renderFiles(files: FileDiffMetadata[])` is gone; nothing else references it (the toolbar listeners call `load`). The `FileDiffMetadata` import may become unused — if so, remove it from the top `import { ... } from "@pierre/diffs"` to keep lint clean (verify in Step 2).

- [ ] **Step 2: Typecheck, lint, build**

Run:
```bash
cd /Users/penguin/dev/cc-statusline/.claude/worktrees/feat+clickable-diff-viewer
bun run typecheck && bun run lint && bun run build
```
Expected: typecheck exit 0; `biome check src/` 0 warnings (if `FileDiffMetadata` is now unused, remove that named import); build exit 0 (`dist/viewer/main.js` rebuilt). If lint flags an unused import, remove it and re-run.

- [ ] **Step 3: Full test suite (regression)**

Run: `bun test`
Expected: 114 pass, 0 fail (viewer files aren't in the suite; this confirms no accidental breakage elsewhere).

- [ ] **Step 4: Manual browser check (controller performs)**

Start the daemon and open the viewer against a repo with changes; confirm the existing behaviors still work AND now preserve scroll:
```bash
# (daemon already running on 49573 from prior work; if not:)
# XDG_CACHE_HOME=$HOME/.cache CC_STATUSLINE_DIFF_PORT=49573 nohup bun dist/index.js --diff-server >/dev/null 2>&1 &
TOKEN=$(cat "$HOME/.cache/cc-statusline/diff-server.token")
echo "open: http://127.0.0.1:49573/?repo=<abs-repo-with-changes>&token=$TOKEN"
```
Verify: diff renders on first load (no click needed); scroll down, click **Refresh** → scroll position is preserved (not jumped to top); split/unified toggle still works; a file with changed contents re-renders in place.

- [ ] **Step 5: Commit**

```bash
git add src/viewer/main.ts
git commit -m "refactor: update diff viewer in place to preserve scroll

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 2: Watch toggle + polling + persistence

Add the Watch checkbox and the polling loop that calls `fetchPatch` on an interval, re-rendering via `renderPatch` only when the patch changed.

**Files:**
- Modify: `src/viewer/index.html` (toolbar checkbox)
- Modify: `src/viewer/main.ts` (watch loop, toggle listener, localStorage restore)

**Interfaces:**
- Consumes: `fetchPatch`, `renderPatch`, `lastPatch` (Task 1).

- [ ] **Step 1: Add the Watch checkbox to the toolbar**

In `src/viewer/index.html`, inside `<div id="toolbar">`, add a `Watch` label immediately after the existing `Refresh` button:

```html
    <button id="refresh" type="button">Refresh</button>
    <label><input type="checkbox" id="toggle-watch" /> Watch</label>
    <span id="status"></span>
```
(The `#status` span already exists — keep a single copy; just insert the Watch label before it.)

- [ ] **Step 2: Add the watch loop + toggle to `src/viewer/main.ts`**

Append the following at the END of `src/viewer/main.ts` (after the existing toolbar listeners and the final `void load();`):

```ts
const WATCH_STORAGE_KEY = "cc-statusline:diff-watch";
const WATCH_POLL_MS = 2000;
let watchTimer: ReturnType<typeof setInterval> | null = null;

async function poll(): Promise<void> {
	if (document.hidden) return;
	const patch = await fetchPatch();
	if (patch === null || patch === lastPatch) return;
	lastPatch = patch;
	renderPatch(patch);
}

function startWatch(): void {
	if (watchTimer !== null) return;
	watchTimer = setInterval(() => void poll(), WATCH_POLL_MS);
}

function stopWatch(): void {
	if (watchTimer !== null) {
		clearInterval(watchTimer);
		watchTimer = null;
	}
}

const watchInput = document.getElementById("toggle-watch") as HTMLInputElement;
watchInput?.addEventListener("change", () => {
	if (watchInput.checked) {
		localStorage.setItem(WATCH_STORAGE_KEY, "1");
		startWatch();
	} else {
		localStorage.setItem(WATCH_STORAGE_KEY, "0");
		stopWatch();
	}
});

// Restore persisted watch state on load.
if (watchInput && localStorage.getItem(WATCH_STORAGE_KEY) === "1") {
	watchInput.checked = true;
	startWatch();
}
```

- [ ] **Step 3: Typecheck, lint, build**

Run:
```bash
cd /Users/penguin/dev/cc-statusline/.claude/worktrees/feat+clickable-diff-viewer
bun run typecheck && bun run lint && bun run build
```
Expected: typecheck exit 0; lint 0 warnings; build exit 0.

- [ ] **Step 4: Full test suite (regression)**

Run: `bun test`
Expected: 114 pass, 0 fail.

- [ ] **Step 5: Manual browser E2E (controller performs)**

Open the viewer against a repo you can edit (daemon on 49573, token from the token file). Verify:
1. Tick **Watch** → edit + save a tracked file in that repo → within ~2s the diff updates **with scroll position preserved** (scroll down first to confirm).
2. When nothing changes, there is no re-render/flicker (idle).
3. Untick **Watch** → editing the file no longer auto-updates (Refresh still works).
4. Reload the page → the Watch checkbox stays in its last state (localStorage); if it was on, polling resumes.
5. Add a new untracked file with "Include untracked" on → the tree gains the file within ~2s.

Note in the report that browser rendering is verified manually (viewer is not in the unit suite).

- [ ] **Step 6: Commit**

```bash
git add src/viewer/index.html src/viewer/main.ts
git commit -m "feat: add watch mode toggle to the diff viewer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 3: Docs + push

- [ ] **Step 1: Document the toggle in CLAUDE.md**

In `CLAUDE.md`, under the diff-viewer note in "수정 시 주의사항" (or the WHY list), add one line:
```
- diff 뷰어 Watch 토글: 켜면 ~2초 폴링으로 변경을 감지해 스크롤 유지한 채 자동 갱신 (localStorage 저장, 백그라운드 탭 일시정지)
```

- [ ] **Step 2: Final verification + commit + push**

Run:
```bash
cd /Users/penguin/dev/cc-statusline/.claude/worktrees/feat+clickable-diff-viewer
bun test && bun run typecheck && bun run lint && bun run build
git add CLAUDE.md
git commit -m "docs: document diff viewer watch mode

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
git push origin HEAD:feat/clickable-diff-viewer
```
Expected: all green; push updates PR #48.

---

## Self-Review (completed by plan author)

**Spec coverage:** polling+change-detection (Task 2 `poll` + `patch === lastPatch`) · in-place scroll-preserving update (Task 1 `renderPatch`) · 2s interval (`WATCH_POLL_MS`) · localStorage persistence + restore (Task 2) · background-tab pause (`document.hidden` in `poll`) · default OFF (checkbox unchecked, restore only starts on `"1"`) · empty↔content + diffStyle transitions (Task 1 `teardownViews` + `renderedDiffStyle` recreate) · error keeps last content (`fetchPatch` returns null → `poll` returns without touching the view) · toolbar checkbox (Task 2 index.html) · viewer-only, no server change · regression suite green (Tasks 1-3 Step 3/4). All spec sections map to a task.

**Placeholder scan:** every step has complete code/commands; no TBD/TODO.

**Type consistency:** `fetchPatch(): Promise<string|null>`, `renderPatch(patch: string): void`, and the trackers `lastPatch`/`lastTreeKey`/`renderedDiffStyle` defined in Task 1 are used with the same signatures in Task 2's `poll`. CodeView/FileTree method names match the verified `.d.ts` (`setItems`, `getScrollTop`, `scrollTo`, `cleanUp`, `resetPaths`, `setGitStatus`). Item shape `{ id, type:'diff', fileDiff }` matches `CodeViewDiffItem`.
