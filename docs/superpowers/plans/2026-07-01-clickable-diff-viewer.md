# Clickable Local Diff Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the statusline `✏️ N files +X -Y` segment a clickable OSC 8 link that opens a local, offline diff viewer (Pierre `@pierre/diffs` + `@pierre/trees`) served by a background daemon on `127.0.0.1:49573`.

**Architecture:** The statusline (a stateless ~300 ms process) ensures a background `Bun.serve` daemon is running (spawn-if-not-running, TTL-gated, fire-and-forget) and wraps the `✏️` text in an OSC 8 hyperlink to the daemon. The daemon serves a pre-bundled Pierre viewer (built at publish time into `dist/viewer/`) plus a `/api/diff` endpoint that runs `git diff HEAD` in the requested repo. Everything is local and offline; code never leaves the machine.

**Tech Stack:** Bun, TypeScript v6, Biome, `bun test`; `@pierre/diffs` v1.2.12 + `@pierre/trees` v1.0.0-beta.5 (vanilla JS APIs, Apache-2.0), bundled with `Bun.build` (`target: "browser"`).

Design spec: `docs/superpowers/specs/2026-07-01-clickable-diff-viewer-design.md`.

## Global Constraints

- **Runtime:** Bun. Use `Bun`/`node:` APIs already used in the repo (`Bun.$`, `Bun.file`, `Bun.write`, `Bun.serve`, `Bun.spawn`, `Bun.main`, `import.meta.dir`, `import.meta.main`).
- **Imports:** Repo uses explicit `.ts` extensions in relative imports (e.g. `import { x } from "./y.ts"`). Match this exactly.
- **TypeScript style:** Explicit param/return types on exported functions. `unknown` not `any`. Immutable updates. (Per `.claude/rules/typescript/coding-style.md`.)
- **Pierre packages are `devDependencies` only.** They must NOT appear in the runtime bundle `dist/index.js`. They are used solely by the browser bundle (`dist/viewer/main.js`) and by unit tests (type-only imports where possible).
- **Default port:** `49573`. Overridable via env `CC_STATUSLINE_DIFF_PORT` (integer 1–65535; invalid → default).
- **Feature kill switch:** env `CC_STATUSLINE_DIFF_DISABLE=1` disables the whole feature (no link, no daemon).
- **Cache dir:** `${XDG_CACHE_HOME:-~/.cache}/cc-statusline/`. Holds `diff-server.token` and `diff-server.lock`.
- **Security (daemon):** bind `127.0.0.1` only; `/api/*` requires a `token` matching the persisted token; NEVER set `Access-Control-Allow-Origin` (or any permissive CORS header); reject path traversal on static files; only run read-only `git diff`.
- **Diff scope:** `git diff HEAD --no-color` (staged+unstaged tracked changes — matches the `✏️` count). Untracked files are opt-in via a `untracked=1` query param / viewer toggle.
- **Token stability:** the daemon REUSES an existing token file on startup (regenerates only if absent), so a link built by the statusline always matches the running daemon's token across restarts.
- **Performance:** the statusline hot path must not block on the daemon. `ensureDiffServer` does at most one synchronous token-file read on the hot path; the probe + spawn run fire-and-forget, TTL-gated (5 s).
- **Testing:** `bun test`; follow existing test conventions (files under `src/__tests__/` or co-located `*.test.ts` — this repo uses `src/__tests__/`). Keep function coverage at 100%.
- **Commit messages:** Conventional Commits (`feat:`, `test:`, `chore:`, `docs:`, `refactor:`). This is a `feat:` feature. End commit bodies with:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g
  ```

## File Structure

| File | Responsibility |
|------|----------------|
| `src/diff-server/config.ts` | Port resolution, cache-dir path, disable flag (pure/env) |
| `src/diff-server/link.ts` | `buildDiffViewerUrl()` — OSC 8 target URL (pure) |
| `src/diff-server/token.ts` | Generate / persist / read (sync + async) the session token |
| `src/diff-server/diff.ts` | `isGitRepo()`, `getDiff()` — run git, return raw diff string |
| `src/diff-server/server.ts` | `startDiffServer()` — `Bun.serve` daemon: routes, token check, idle shutdown |
| `src/diff-server/ensure.ts` | `ensureDiffServer()` — TTL-gated probe + lock + detached spawn |
| `src/viewer/mapStatus.ts` | `changeTypeToGitStatus()` — Pierre `ChangeTypes` → trees `GitStatus` (pure) |
| `src/viewer/main.ts` | Browser entry: fetch `/api/diff` → parse → FileTree + CodeView + toolbar |
| `src/viewer/index.html` | Viewer shell HTML (layout + toolbar) |
| `src/index.ts` (modify) | `--diff-server` subcommand dispatch; call `ensureDiffServer` in `main()` |
| `src/render.ts` (modify) | Wrap `✏️` text in OSC 8 link when `ctx.diffViewerUrl` present |
| `src/types.ts` (modify) | Add `diffViewerUrl: string \| null` to `RenderContext` |
| `build.ts` (modify) | Also bundle `src/viewer/main.ts` → `dist/viewer/` and copy `index.html` |
| `package.json` (modify) | Add Pierre devDeps; add `dist/viewer` to `files` |

---

## Task 1: Build plumbing + Pierre bundling spike (walking skeleton)

**Why first:** The single biggest risk is "can `@pierre/diffs` + `@pierre/trees` + Shiki bundle offline via `Bun.build` and render in a browser?". Prove it before building anything else. This task also lays the build plumbing every later task assumes.

**Files:**
- Modify: `package.json` (devDeps + `files`)
- Modify: `build.ts`
- Create: `src/viewer/index.html`
- Create: `src/viewer/main.ts` (TEMPORARY hardcoded-sample version; replaced in Task 11)

**Interfaces:**
- Produces: `dist/viewer/main.js` + `dist/viewer/index.html` (served later by the daemon).

- [ ] **Step 1: Add Pierre packages as devDependencies**

Run:
```bash
bun add -d @pierre/diffs @pierre/trees
```
Expected: `package.json` `devDependencies` now includes `@pierre/diffs` and `@pierre/trees`. (If already installed during planning, this is a no-op that confirms the lockfile.)

- [ ] **Step 2: Add `dist/viewer` to published files**

Edit `package.json` `files` array from:
```json
	"files": [
		"dist/index.js"
	],
```
to:
```json
	"files": [
		"dist/index.js",
		"dist/viewer"
	],
```

- [ ] **Step 3: Write the temporary viewer shell HTML**

Create `src/viewer/index.html`:
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>cc-statusline diff</title>
<style>
  html, body { margin: 0; height: 100%; background: #0d1117; color: #c9d1d9;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  #app { display: grid; grid-template-columns: 300px 1fr; grid-template-rows: auto 1fr; height: 100vh; }
  #toolbar { grid-column: 1 / 3; display: flex; gap: 12px; align-items: center;
    padding: 8px 12px; border-bottom: 1px solid #30363d; font-size: 13px; }
  #toolbar button { background: #21262d; color: #c9d1d9; border: 1px solid #30363d;
    border-radius: 6px; padding: 4px 10px; cursor: pointer; }
  #tree { overflow: auto; border-right: 1px solid #30363d; }
  #diff { overflow: auto; }
  #empty { padding: 24px; color: #8b949e; }
</style>
</head>
<body>
<div id="app">
  <div id="toolbar">
    <button id="toggle-style" type="button">Split / Unified</button>
    <label><input type="checkbox" id="toggle-untracked" /> Include untracked</label>
    <button id="refresh" type="button">Refresh</button>
    <span id="status"></span>
  </div>
  <div id="tree"></div>
  <div id="diff"></div>
</div>
<script type="module" src="/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write a temporary spike `main.ts` that renders a hardcoded diff**

Create `src/viewer/main.ts` (TEMPORARY — Task 11 replaces this entire file):
```ts
import { CodeView, parsePatchFiles } from "@pierre/diffs";
import { FileTree } from "@pierre/trees";

const SAMPLE = `diff --git a/hello.ts b/hello.ts
index 0000001..0000002 100644
--- a/hello.ts
+++ b/hello.ts
@@ -1,2 +1,2 @@
-const greeting = "hi";
+const greeting = "hello";
 console.log(greeting);
`;

const files = parsePatchFiles(SAMPLE).flatMap((p) => p.files);

const tree = new FileTree({
	paths: files.map((f) => f.name),
	initialExpansion: "open",
});
tree.render({ containerWrapper: document.getElementById("tree") as HTMLElement });

const codeView = new CodeView({ diffStyle: "unified", themeType: "dark" });
codeView.setup(document.getElementById("diff") as HTMLElement);
codeView.setItems(files.map((f) => ({ id: f.name, type: "diff", fileDiff: f })));
codeView.render();
```

- [ ] **Step 5: Extend `build.ts` to bundle the viewer**

Replace `build.ts` contents with:
```ts
// Statusline runtime bundle (unchanged)
await Bun.build({
	entrypoints: ["./src/index.ts"],
	outdir: "./dist",
	target: "bun",
});

// Browser viewer bundle (Pierre + Shiki)
await Bun.build({
	entrypoints: ["./src/viewer/main.ts"],
	outdir: "./dist/viewer",
	target: "browser",
	minify: true,
});

// Copy the viewer shell HTML next to the bundle
await Bun.write(
	"./dist/viewer/index.html",
	Bun.file("./src/viewer/index.html"),
);
```

- [ ] **Step 6: Run the build and verify the bundle exists**

Run:
```bash
bun run build && ls -la dist/viewer && echo "bytes:" && wc -c dist/viewer/main.js
```
Expected: exit 0; `dist/viewer/main.js` and `dist/viewer/index.html` exist; `main.js` is non-empty (expect a large file — Shiki grammars).

**If the build fails** (e.g. Shiki WASM / language resolution errors): the fallback is to configure Shiki's JavaScript regex engine instead of WASM. In `main.ts`, before rendering, import and register the JS engine via `@pierre/diffs`'s highlighter options if exposed, or set `preferredHighlighter` / worker options on the `CodeView` constructor. Document whatever configuration made the bundle succeed in a comment at the top of `main.ts` so later tasks preserve it. Do not proceed until `bun run build` exits 0.

- [ ] **Step 7: Manually verify the sample renders in a browser**

Run (serves the built viewer on an ephemeral static server):
```bash
bunx serve dist/viewer -l 8099 >/dev/null 2>&1 &
sleep 1
echo "open http://localhost:8099 in a browser"
```
Verify with the claude-in-chrome tools (or ask the user): the page shows a file tree with `hello.ts` and a syntax-highlighted diff (`- const greeting = "hi";` / `+ const greeting = "hello";`). Kill the static server afterwards (`kill %1`).

Expected: tree + highlighted diff visible. This proves Pierre bundles and renders offline.

- [ ] **Step 8: Commit**

```bash
git add package.json bun.lock build.ts src/viewer/index.html src/viewer/main.ts
git commit -m "feat: bundle Pierre diff viewer (walking skeleton)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 2: Config module

**Files:**
- Create: `src/diff-server/config.ts`
- Test: `src/__tests__/diff-config.test.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_DIFF_PORT: number` (= 49573)
  - `resolveDiffPort(env?: Record<string, string | undefined>): number`
  - `isDiffViewerDisabled(env?: Record<string, string | undefined>): boolean`
  - `getCacheDir(env?: Record<string, string | undefined>): string`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/diff-config.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import {
	DEFAULT_DIFF_PORT,
	getCacheDir,
	isDiffViewerDisabled,
	resolveDiffPort,
} from "../diff-server/config.ts";

describe("resolveDiffPort", () => {
	test("defaults when unset", () => {
		expect(resolveDiffPort({})).toBe(DEFAULT_DIFF_PORT);
	});
	test("uses valid override", () => {
		expect(resolveDiffPort({ CC_STATUSLINE_DIFF_PORT: "51000" })).toBe(51000);
	});
	test("falls back on invalid override", () => {
		expect(resolveDiffPort({ CC_STATUSLINE_DIFF_PORT: "abc" })).toBe(DEFAULT_DIFF_PORT);
		expect(resolveDiffPort({ CC_STATUSLINE_DIFF_PORT: "70000" })).toBe(DEFAULT_DIFF_PORT);
		expect(resolveDiffPort({ CC_STATUSLINE_DIFF_PORT: "0" })).toBe(DEFAULT_DIFF_PORT);
	});
});

describe("isDiffViewerDisabled", () => {
	test("true only when exactly '1'", () => {
		expect(isDiffViewerDisabled({ CC_STATUSLINE_DIFF_DISABLE: "1" })).toBe(true);
		expect(isDiffViewerDisabled({ CC_STATUSLINE_DIFF_DISABLE: "0" })).toBe(false);
		expect(isDiffViewerDisabled({})).toBe(false);
	});
});

describe("getCacheDir", () => {
	test("respects XDG_CACHE_HOME", () => {
		expect(getCacheDir({ XDG_CACHE_HOME: "/tmp/xdg" })).toBe("/tmp/xdg/cc-statusline");
	});
	test("falls back to ~/.cache", () => {
		const dir = getCacheDir({ HOME: "/home/x" });
		expect(dir.endsWith("/cc-statusline")).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/diff-config.test.ts`
Expected: FAIL (`Cannot find module '../diff-server/config.ts'`).

- [ ] **Step 3: Write minimal implementation**

Create `src/diff-server/config.ts`:
```ts
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_DIFF_PORT = 49573;

type Env = Record<string, string | undefined>;

export function resolveDiffPort(env: Env = process.env): number {
	const raw = env.CC_STATUSLINE_DIFF_PORT;
	if (!raw) return DEFAULT_DIFF_PORT;
	const n = Number.parseInt(raw, 10);
	return Number.isInteger(n) && n > 0 && n < 65536 ? n : DEFAULT_DIFF_PORT;
}

export function isDiffViewerDisabled(env: Env = process.env): boolean {
	return env.CC_STATUSLINE_DIFF_DISABLE === "1";
}

export function getCacheDir(env: Env = process.env): string {
	const base = env.XDG_CACHE_HOME || join(env.HOME || homedir(), ".cache");
	return join(base, "cc-statusline");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/diff-config.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/diff-server/config.ts src/__tests__/diff-config.test.ts
git commit -m "feat: add diff-server config module

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 3: OSC 8 link builder

**Files:**
- Create: `src/diff-server/link.ts`
- Test: `src/__tests__/diff-link.test.ts`

**Interfaces:**
- Produces: `buildDiffViewerUrl(params: { port: number; repo: string; token: string }): string`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/diff-link.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { buildDiffViewerUrl } from "../diff-server/link.ts";

describe("buildDiffViewerUrl", () => {
	test("builds a 127.0.0.1 URL with encoded repo and token", () => {
		const url = buildDiffViewerUrl({
			port: 49573,
			repo: "/Users/me/my project",
			token: "abc123",
		});
		expect(url).toBe(
			"http://127.0.0.1:49573/?repo=%2FUsers%2Fme%2Fmy+project&token=abc123",
		);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/diff-link.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/diff-server/link.ts`:
```ts
export function buildDiffViewerUrl(params: {
	port: number;
	repo: string;
	token: string;
}): string {
	const query = new URLSearchParams({
		repo: params.repo,
		token: params.token,
	});
	return `http://127.0.0.1:${params.port}/?${query.toString()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/diff-link.test.ts`
Expected: PASS. (`URLSearchParams` encodes `/` as `%2F` and space as `+`.)

- [ ] **Step 5: Commit**

```bash
git add src/diff-server/link.ts src/__tests__/diff-link.test.ts
git commit -m "feat: add OSC 8 diff viewer link builder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 4: Token module

**Files:**
- Create: `src/diff-server/token.ts`
- Test: `src/__tests__/diff-token.test.ts`

**Interfaces:**
- Consumes: `getCacheDir` from `config.ts`.
- Produces:
  - `getTokenPath(env?): string`
  - `generateToken(): string`
  - `readTokenSync(env?): string | null`
  - `ensureToken(env?): string` — reuse persisted token or generate+persist a new one (used by the daemon; returns the stable token)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/diff-token.test.ts`:
```ts
import { afterEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { ensureToken, generateToken, getTokenPath, readTokenSync } from "../diff-server/token.ts";

const TMP = "/tmp/cc-statusline-token-test";
const env = { XDG_CACHE_HOME: TMP };

afterEach(() => {
	rmSync(TMP, { recursive: true, force: true });
});

describe("token module", () => {
	test("generateToken returns a non-empty hex-ish string", () => {
		const t = generateToken();
		expect(t.length).toBeGreaterThan(16);
		expect(t).not.toContain("-");
	});

	test("readTokenSync returns null when absent", () => {
		expect(readTokenSync(env)).toBeNull();
	});

	test("ensureToken persists a token and readTokenSync returns it", () => {
		const t = ensureToken(env);
		expect(readTokenSync(env)).toBe(t);
	});

	test("ensureToken reuses an existing token", () => {
		const first = ensureToken(env);
		const second = ensureToken(env);
		expect(second).toBe(first);
	});

	test("getTokenPath is under the cache dir", () => {
		expect(getTokenPath(env)).toBe(`${TMP}/cc-statusline/diff-server.token`);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/diff-token.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/diff-server/token.ts`:
```ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getCacheDir } from "./config.ts";

type Env = Record<string, string | undefined>;

export function getTokenPath(env: Env = process.env): string {
	return join(getCacheDir(env), "diff-server.token");
}

export function generateToken(): string {
	return crypto.randomUUID().replaceAll("-", "");
}

export function readTokenSync(env: Env = process.env): string | null {
	try {
		const value = readFileSync(getTokenPath(env), "utf8").trim();
		return value || null;
	} catch {
		return null;
	}
}

export function ensureToken(env: Env = process.env): string {
	const existing = readTokenSync(env);
	if (existing) return existing;
	const token = generateToken();
	mkdirSync(getCacheDir(env), { recursive: true });
	writeFileSync(getTokenPath(env), token);
	return token;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/diff-token.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add src/diff-server/token.ts src/__tests__/diff-token.test.ts
git commit -m "feat: add diff-server session token module

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 5: Diff command module

**Files:**
- Create: `src/diff-server/diff.ts`
- Test: `src/__tests__/diff-command.test.ts`

**Interfaces:**
- Produces:
  - `isGitRepo(repo: string): Promise<boolean>`
  - `getDiff(repo: string, opts?: { untracked?: boolean }): Promise<string>`

**Notes:** Uses `Bun.$` (already used in `src/git/*.ts`). `git diff --no-index` exits non-zero when files differ, so use `.nothrow()`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/diff-command.test.ts`:
```ts
import { $ } from "bun";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/diff-command.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/diff-server/diff.ts`:
```ts
import { $ } from "bun";

export async function isGitRepo(repo: string): Promise<boolean> {
	try {
		const out = await $`git -C ${repo} rev-parse --is-inside-work-tree 2>/dev/null`.text();
		return out.trim() === "true";
	} catch {
		return false;
	}
}

export async function getDiff(
	repo: string,
	opts: { untracked?: boolean } = {},
): Promise<string> {
	const tracked = await $`git -C ${repo} diff HEAD --no-color 2>/dev/null`.nothrow().text();
	if (!opts.untracked) return tracked;

	const listed = await $`git -C ${repo} ls-files --others --exclude-standard 2>/dev/null`
		.nothrow()
		.text();
	const files = listed.split("\n").map((s) => s.trim()).filter(Boolean);

	const parts: string[] = tracked ? [tracked] : [];
	for (const file of files) {
		// --no-index exits 1 when the file differs from /dev/null; capture stdout anyway.
		const synthetic = await $`git -C ${repo} diff --no-index --no-color /dev/null ${file} 2>/dev/null`
			.nothrow()
			.text();
		if (synthetic) parts.push(synthetic);
	}
	return parts.join("");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/diff-command.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/diff-server/diff.ts src/__tests__/diff-command.test.ts
git commit -m "feat: add git diff command module (tracked + optional untracked)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 6: ChangeType → GitStatus mapping

**Files:**
- Create: `src/viewer/mapStatus.ts`
- Test: `src/__tests__/map-status.test.ts`

**Interfaces:**
- Produces: `changeTypeToGitStatus(type: ChangeTypes): GitStatus`
  - `ChangeTypes` (from `@pierre/diffs`) = `'change' | 'rename-pure' | 'rename-changed' | 'new' | 'deleted'`
  - `GitStatus` (from `@pierre/trees`) = `'added' | 'deleted' | 'ignored' | 'modified' | 'renamed' | 'untracked'`
  - Mapping: `new→added`, `deleted→deleted`, `rename-pure|rename-changed→renamed`, `change→modified`.

**Note:** type-only imports from Pierre are erased at build time, so this file adds no runtime dependency.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/map-status.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { changeTypeToGitStatus } from "../viewer/mapStatus.ts";

describe("changeTypeToGitStatus", () => {
	test("maps every ChangeType", () => {
		expect(changeTypeToGitStatus("new")).toBe("added");
		expect(changeTypeToGitStatus("deleted")).toBe("deleted");
		expect(changeTypeToGitStatus("rename-pure")).toBe("renamed");
		expect(changeTypeToGitStatus("rename-changed")).toBe("renamed");
		expect(changeTypeToGitStatus("change")).toBe("modified");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/map-status.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/viewer/mapStatus.ts`:
```ts
import type { ChangeTypes } from "@pierre/diffs";
import type { GitStatus } from "@pierre/trees";

export function changeTypeToGitStatus(type: ChangeTypes): GitStatus {
	switch (type) {
		case "new":
			return "added";
		case "deleted":
			return "deleted";
		case "rename-pure":
		case "rename-changed":
			return "renamed";
		default:
			return "modified";
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/map-status.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/viewer/mapStatus.ts src/__tests__/map-status.test.ts
git commit -m "feat: add Pierre ChangeType to trees GitStatus mapping

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 7: Diff daemon server

**Files:**
- Create: `src/diff-server/server.ts`
- Test: `src/__tests__/diff-server.test.ts`

**Interfaces:**
- Consumes: `getDiff`, `isGitRepo` (`diff.ts`); `ensureToken` (`token.ts`).
- Produces:
  - `interface DiffServerHandle { server: import("bun").Server; token: string; stop(): void }`
  - `startDiffServer(opts: { port: number; viewerDir: string; env?: Record<string,string|undefined>; idleTimeoutMs?: number }): DiffServerHandle`
- Routes:
  - `GET /api/ping` → `204`, header `x-cc-statusline: 1` (used by the probe; no token required)
  - `GET /api/diff?repo=&token=&untracked=` → token check (403), repo check (400), else `200` raw diff (`text/plain`), NO CORS header
  - `GET /` → `dist/viewer/index.html`; `GET /<path>` → file under `viewerDir`; traversal-guarded; `404` if missing

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/diff-server.test.ts`:
```ts
import { $ } from "bun";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDiffServer } from "../diff-server/server.ts";

let repo: string;
let viewerDir: string;
let cacheHome: string;
let handle: ReturnType<typeof startDiffServer>;
let base: string;

beforeEach(async () => {
	repo = mkdtempSync(join(tmpdir(), "cc-srv-repo-"));
	await $`git -C ${repo} init -q`;
	await $`git -C ${repo} config user.email t@t.co`;
	await $`git -C ${repo} config user.name test`;
	writeFileSync(join(repo, "a.txt"), "one\n");
	await $`git -C ${repo} add a.txt`;
	await $`git -C ${repo} commit -qm init`;
	writeFileSync(join(repo, "a.txt"), "two\n");

	viewerDir = mkdtempSync(join(tmpdir(), "cc-srv-view-"));
	writeFileSync(join(viewerDir, "index.html"), "<html>viewer</html>");

	cacheHome = mkdtempSync(join(tmpdir(), "cc-srv-cache-"));
	handle = startDiffServer({
		port: 0,
		viewerDir,
		env: { XDG_CACHE_HOME: cacheHome },
		idleTimeoutMs: 0,
	});
	base = `http://127.0.0.1:${handle.server.port}`;
});

afterEach(() => {
	handle.stop();
	for (const d of [repo, viewerDir, cacheHome]) rmSync(d, { recursive: true, force: true });
});

describe("diff server", () => {
	test("ping returns 204 with marker header", async () => {
		const res = await fetch(`${base}/api/ping`);
		expect(res.status).toBe(204);
		expect(res.headers.get("x-cc-statusline")).toBe("1");
	});

	test("serves index.html at /", async () => {
		const res = await fetch(`${base}/`);
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("viewer");
	});

	test("api/diff rejects a bad token with 403", async () => {
		const res = await fetch(`${base}/api/diff?repo=${encodeURIComponent(repo)}&token=wrong`);
		expect(res.status).toBe(403);
	});

	test("api/diff returns the diff with the correct token and no CORS header", async () => {
		const url = `${base}/api/diff?repo=${encodeURIComponent(repo)}&token=${handle.token}`;
		const res = await fetch(url);
		expect(res.status).toBe(200);
		expect(res.headers.get("access-control-allow-origin")).toBeNull();
		const body = await res.text();
		expect(body).toContain("a.txt");
		expect(body).toContain("+two");
	});

	test("api/diff rejects a non-repo path with 400", async () => {
		const plain = mkdtempSync(join(tmpdir(), "cc-srv-plain-"));
		const url = `${base}/api/diff?repo=${encodeURIComponent(plain)}&token=${handle.token}`;
		const res = await fetch(url);
		expect(res.status).toBe(400);
		rmSync(plain, { recursive: true, force: true });
	});

	test("blocks path traversal on static files", async () => {
		const res = await fetch(`${base}/../../etc/passwd`);
		expect([403, 404]).toContain(res.status);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/diff-server.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/diff-server/server.ts`:
```ts
import type { Server } from "bun";
import { resolve } from "node:path";
import { getDiff, isGitRepo } from "./diff.ts";
import { ensureToken } from "./token.ts";

type Env = Record<string, string | undefined>;

export interface DiffServerHandle {
	server: Server;
	token: string;
	stop(): void;
}

function createHandler(cfg: { viewerDir: string; token: string }) {
	const viewerRoot = resolve(cfg.viewerDir);
	return async (req: Request): Promise<Response> => {
		const url = new URL(req.url);

		if (url.pathname === "/api/ping") {
			return new Response(null, { status: 204, headers: { "x-cc-statusline": "1" } });
		}

		if (url.pathname === "/api/diff") {
			if (url.searchParams.get("token") !== cfg.token) {
				return new Response("forbidden", { status: 403 });
			}
			const repo = url.searchParams.get("repo") ?? "";
			if (!repo || !(await isGitRepo(repo))) {
				return new Response("not a git repository", { status: 400 });
			}
			const untracked = url.searchParams.get("untracked") === "1";
			const diff = await getDiff(repo, { untracked });
			// NOTE: intentionally no Access-Control-Allow-Origin — cross-origin pages must not read this.
			return new Response(diff, {
				headers: { "content-type": "text/plain; charset=utf-8" },
			});
		}

		const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
		const filePath = resolve(viewerRoot, rel);
		if (filePath !== viewerRoot && !filePath.startsWith(`${viewerRoot}/`)) {
			return new Response("forbidden", { status: 403 });
		}
		const file = Bun.file(filePath);
		if (await file.exists()) return new Response(file);
		return new Response("not found", { status: 404 });
	};
}

export function startDiffServer(opts: {
	port: number;
	viewerDir: string;
	env?: Env;
	idleTimeoutMs?: number;
}): DiffServerHandle {
	const env = opts.env ?? process.env;
	const token = ensureToken(env);
	let lastActivity = Date.now();
	const handler = createHandler({ viewerDir: opts.viewerDir, token });

	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: opts.port,
		fetch: (req) => {
			lastActivity = Date.now();
			return handler(req);
		},
	});

	let idleTimer: ReturnType<typeof setInterval> | undefined;
	if (opts.idleTimeoutMs && opts.idleTimeoutMs > 0) {
		idleTimer = setInterval(() => {
			if (Date.now() - lastActivity > opts.idleTimeoutMs!) {
				stop();
				process.exit(0);
			}
		}, 60_000);
		idleTimer.unref?.();
	}

	function stop(): void {
		if (idleTimer) clearInterval(idleTimer);
		server.stop(true);
	}

	return { server, token, stop };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/diff-server.test.ts`
Expected: PASS (all 6).

- [ ] **Step 5: Commit**

```bash
git add src/diff-server/server.ts src/__tests__/diff-server.test.ts
git commit -m "feat: add local diff viewer daemon server

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 8: Spawn guard (`ensureDiffServer`)

**Files:**
- Create: `src/diff-server/ensure.ts`
- Test: `src/__tests__/diff-ensure.test.ts`

**Interfaces:**
- Consumes: `resolveDiffPort`, `getCacheDir`, `isDiffViewerDisabled` (`config.ts`); `readTokenSync` (`token.ts`).
- Produces:
  - `resetEnsureCache(): void` (test seam to clear the module-level TTL cache)
  - `ensureDiffServer(repo: string, env?: Record<string,string|undefined>): Promise<{ port: number; token: string } | null>`
- Behavior: returns `null` when disabled. Fast path returns `{ port, token }` from `readTokenSync` (or `null` if no token yet). Fire-and-forget (does NOT await): a TTL-gated (5 s) probe of `GET /api/ping`; if not our marker, acquire an atomic mkdir lock and spawn the daemon detached via `sh -c 'nohup … &'`.

**Detached-spawn note:** using `nohup … &` via `sh -c` fully detaches the daemon so it survives the statusline process exiting (verified by the survival test below). If a future Bun version changes spawn semantics and the survival test fails, keep this shell-based approach rather than a bare `Bun.spawn` of the daemon.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/diff-ensure.test.ts`:
```ts
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureDiffServer, resetEnsureCache } from "../diff-server/ensure.ts";

let cacheHome: string;

afterEach(() => {
	resetEnsureCache();
	if (cacheHome) rmSync(cacheHome, { recursive: true, force: true });
});

describe("ensureDiffServer", () => {
	test("returns null when disabled", async () => {
		const result = await ensureDiffServer("/some/repo", {
			CC_STATUSLINE_DIFF_DISABLE: "1",
		});
		expect(result).toBeNull();
	});

	test("returns null on the first tick when no token exists yet", async () => {
		cacheHome = mkdtempSync(join(tmpdir(), "cc-ensure-"));
		// Use an unlikely port so the probe fails fast and no real daemon interferes.
		const result = await ensureDiffServer("/some/repo", {
			XDG_CACHE_HOME: cacheHome,
			CC_STATUSLINE_DIFF_PORT: "59999",
		});
		// No token persisted yet on the very first call.
		expect(result).toBeNull();
	});

	test("returns the token+port once a token file exists", async () => {
		cacheHome = mkdtempSync(join(tmpdir(), "cc-ensure-"));
		const { ensureToken } = await import("../diff-server/token.ts");
		const env = { XDG_CACHE_HOME: cacheHome, CC_STATUSLINE_DIFF_PORT: "59999" };
		const token = ensureToken(env);
		resetEnsureCache();
		const result = await ensureDiffServer("/some/repo", env);
		expect(result).toEqual({ port: 59999, token });
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/diff-ensure.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/diff-server/ensure.ts`:
```ts
import { mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { getCacheDir, isDiffViewerDisabled, resolveDiffPort } from "./config.ts";
import { readTokenSync } from "./token.ts";

type Env = Record<string, string | undefined>;
type EnsureResult = { port: number; token: string } | null;

const ENSURE_TTL_MS = 5_000;
const LOCK_STALE_MS = 30_000;

let checkedAt = 0;

export function resetEnsureCache(): void {
	checkedAt = 0;
}

async function probeOurServer(port: number): Promise<boolean> {
	try {
		const res = await fetch(`http://127.0.0.1:${port}/api/ping`, {
			signal: AbortSignal.timeout(150),
		});
		return res.headers.get("x-cc-statusline") === "1";
	} catch {
		return false;
	}
}

function acquireSpawnLock(env: Env): boolean {
	const lock = join(getCacheDir(env), "diff-server.lock");
	mkdirSync(getCacheDir(env), { recursive: true });
	try {
		mkdirSync(lock);
		return true;
	} catch {
		try {
			if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) {
				rmSync(lock, { recursive: true, force: true });
				mkdirSync(lock);
				return true;
			}
		} catch {}
		return false;
	}
}

function spawnDaemon(port: number): void {
	const execPath = process.execPath;
	const selfPath = Bun.main;
	// nohup + & fully detaches so the daemon outlives this statusline process.
	Bun.spawn(["sh", "-c", 'nohup "$0" "$1" --diff-server >/dev/null 2>&1 &', execPath, selfPath], {
		env: { ...process.env, CC_STATUSLINE_DIFF_PORT: String(port) },
		stdin: "ignore",
		stdout: "ignore",
		stderr: "ignore",
	}).unref();
}

async function maybeSpawn(port: number, env: Env): Promise<void> {
	if (await probeOurServer(port)) return;
	if (acquireSpawnLock(env)) spawnDaemon(port);
}

export async function ensureDiffServer(repo: string, env: Env = process.env): Promise<EnsureResult> {
	if (isDiffViewerDisabled(env)) return null;
	const port = resolveDiffPort(env);

	const now = Date.now();
	if (now - checkedAt >= ENSURE_TTL_MS) {
		checkedAt = now;
		// Fire-and-forget: never block the statusline hot path on the probe/spawn.
		void maybeSpawn(port, env);
	}

	const token = readTokenSync(env);
	return token ? { port, token } : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/diff-ensure.test.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Manual survival check (detached spawn)**

Run (from the worktree root, after Task 1's build exists):
```bash
rm -rf /tmp/cc-survive && bun run build
# Simulate a statusline tick that spawns the daemon, then exits:
XDG_CACHE_HOME=/tmp/cc-survive CC_STATUSLINE_DIFF_PORT=59571 \
  bun -e 'import("./src/diff-server/ensure.ts").then(m => m.ensureDiffServer(process.cwd()))'
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:59571/api/ping
```
Expected: `204` — the daemon survived the spawning process's exit. Clean up: `pkill -f "diff-server" ; rm -rf /tmp/cc-survive`.

- [ ] **Step 6: Commit**

```bash
git add src/diff-server/ensure.ts src/__tests__/diff-ensure.test.ts
git commit -m "feat: add TTL-gated spawn guard for the diff daemon

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 9: Wire `index.ts` (subcommand + ensure call)

**Files:**
- Modify: `src/index.ts`
- Modify: `src/types.ts` (add `diffViewerUrl`)
- Test: `src/__tests__/integration.test.ts` (extend) — verify `--diff-server` dispatch and that `main()` still prints lines.

**Interfaces:**
- Consumes: `ensureDiffServer` (`ensure.ts`), `buildDiffViewerUrl` (`link.ts`), `startDiffServer` (`server.ts`), `resolveDiffPort` (`config.ts`).
- Produces: `RenderContext.diffViewerUrl: string | null`; `main()` passes it through.

- [ ] **Step 1: Add the field to `RenderContext`**

In `src/types.ts`, change the `RenderContext` interface to add one line:
```ts
export interface RenderContext {
	claudeJson: ClaudeStatusInput;
	branch: string;
	gitChanges: { files: number; insertions: number; deletions: number };
	prUrl: string | null;
	rateLimits: RateLimits | null;
	mainProjectName: string | null;
	diffViewerUrl: string | null;
}
```

- [ ] **Step 2: Update `src/index.ts`**

Replace `src/index.ts` with:
```ts
#!/usr/bin/env bun

import { join } from "node:path";
import { resolveDiffPort } from "./diff-server/config.ts";
import { ensureDiffServer } from "./diff-server/ensure.ts";
import { buildDiffViewerUrl } from "./diff-server/link.ts";
import {
	getBranchCached,
	getGitChangesCached,
	getMainProjectNameCached,
	getPrUrlCached,
} from "./git/index.ts";
import { renderStatusLine } from "./render.ts";
import { readStdin } from "./stdin.ts";
import type { ClaudeStatusInput } from "./types.ts";

// 메인 함수
export async function main(): Promise<void> {
	// 1. stdin에서 Claude Code JSON 읽기 (empty stdin 처리)
	const claudeJson: ClaudeStatusInput = JSON.parse((await readStdin()) || "{}");

	// 2. Git 정보 (캐싱, 병렬 실행)
	const [branch, gitChanges, prUrl, mainProjectName] = await Promise.all([
		getBranchCached(),
		getGitChangesCached(),
		getPrUrlCached(),
		getMainProjectNameCached(),
	]);

	// 3. diff 뷰어 링크 (변경사항이 있을 때만; 데몬 ensure는 fire-and-forget)
	let diffViewerUrl: string | null = null;
	const repo =
		claudeJson.workspace?.project_dir || claudeJson.workspace?.current_dir || "";
	const hasChanges =
		gitChanges.files > 0 || gitChanges.insertions > 0 || gitChanges.deletions > 0;
	if (hasChanges && repo) {
		const ensured = await ensureDiffServer(repo);
		if (ensured) {
			diffViewerUrl = buildDiffViewerUrl({
				port: ensured.port,
				repo,
				token: ensured.token,
			});
		}
	}

	// 4. 렌더링 및 출력
	const lines = renderStatusLine({
		claudeJson,
		branch,
		gitChanges,
		prUrl,
		rateLimits: claudeJson.rate_limits ?? null,
		mainProjectName,
		diffViewerUrl,
	});

	for (const line of lines) {
		console.log(line);
	}
}

if (import.meta.main) {
	if (process.argv.includes("--diff-server")) {
		const { startDiffServer } = await import("./diff-server/server.ts");
		startDiffServer({
			port: resolveDiffPort(),
			viewerDir: join(import.meta.dir, "viewer"),
			idleTimeoutMs: 15 * 60 * 1000,
		});
		// Bun.serve keeps the process alive.
	} else {
		main().catch(console.error);
	}
}
```

- [ ] **Step 3: Update every other `renderStatusLine(...)` / `RenderContext` usage**

Search for existing test/call sites that construct a `RenderContext` and add `diffViewerUrl: null`:
```bash
grep -rn "renderStatusLine(" src/__tests__ ; grep -rn "mainProjectName:" src/__tests__
```
For each object literal passed to `renderStatusLine`, add `diffViewerUrl: null` (unless the case specifically tests the link — see Task 10). This keeps existing tests compiling.

- [ ] **Step 4: Run the full suite to verify nothing broke**

Run: `bun test`
Expected: PASS. If any `RenderContext` literal is missing `diffViewerUrl`, TypeScript/Bun will flag it — add `diffViewerUrl: null` there.

- [ ] **Step 5: Verify the manual smoke command still works**

Run:
```bash
echo '{"cost":{"total_duration_ms":3600000,"total_cost_usd":0.5},"context_window":{"context_window_size":200000,"current_usage":{"input_tokens":50000,"output_tokens":10000,"cache_creation_input_tokens":5000,"cache_read_input_tokens":2000}},"workspace":{"project_dir":"'"$PWD"'"}}' | bun src/index.ts
```
Expected: statusline prints as before (link wrapping is added in Task 10; this only confirms no regression).

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/types.ts src/__tests__
git commit -m "feat: wire diff-server ensure + subcommand into statusline entry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 10: Render the `✏️` segment as an OSC 8 link

**Files:**
- Modify: `src/render.ts:88-108` (the git-changes / PR line)
- Test: `src/__tests__/main.test.ts` (extend)

**Interfaces:**
- Consumes: `RenderContext.diffViewerUrl`.
- Behavior: when `hasGitChanges && ctx.diffViewerUrl`, wrap the `✏️ N files +X -Y` text in an OSC 8 hyperlink (same escape sequence style as the existing PR link at `render.ts:105`). When `diffViewerUrl` is null, render the plain text exactly as today.

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/main.test.ts` (inside the existing describe block, or a new one). First locate an existing `renderStatusLine` call to copy the base context shape. Add:
```ts
import { describe, expect, test } from "bun:test";
import { renderStatusLine } from "../render.ts";
import type { RenderContext } from "../types.ts";

function baseCtx(overrides: Partial<RenderContext> = {}): RenderContext {
	return {
		claudeJson: {
			cost: { total_duration_ms: 0, total_cost_usd: 0 },
			context_window: {
				context_window_size: 200000,
				current_usage: {
					input_tokens: 0,
					output_tokens: 0,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
			},
			workspace: { current_dir: "/x", project_dir: "/x" },
		},
		branch: "",
		gitChanges: { files: 3, insertions: 86, deletions: 3 },
		prUrl: null,
		rateLimits: null,
		mainProjectName: null,
		diffViewerUrl: null,
		...overrides,
	};
}

describe("diff viewer OSC 8 link", () => {
	test("wraps the changes text in a hyperlink when diffViewerUrl is set", () => {
		const url = "http://127.0.0.1:49573/?repo=%2Fx&token=abc";
		const lines = renderStatusLine(baseCtx({ diffViewerUrl: url }));
		const line = lines.find((l) => l.includes("3 files"));
		expect(line).toBeDefined();
		expect(line).toContain(`\x1b]8;;${url}\x07`);
		expect(line).toContain("\x1b]8;;\x07");
		expect(line).toContain("3 files");
	});

	test("renders plain changes text when diffViewerUrl is null", () => {
		const lines = renderStatusLine(baseCtx({ diffViewerUrl: null }));
		const line = lines.find((l) => l.includes("3 files"));
		expect(line).toBeDefined();
		expect(line).not.toContain("\x1b]8;;http://127.0.0.1");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/main.test.ts`
Expected: FAIL on the first case (no hyperlink escape present yet).

- [ ] **Step 3: Update `src/render.ts`**

In `src/render.ts`, replace the `hasGitChanges` block (lines ~95-97):
```ts
		if (hasGitChanges) {
			line4 += `✏️ ${C.WHITE}${ctx.gitChanges.files} files${C.RESET} ${C.GREEN}+${ctx.gitChanges.insertions}${C.RESET} ${C.RED}-${ctx.gitChanges.deletions}${C.RESET}`;
		}
```
with:
```ts
		if (hasGitChanges) {
			const changesText = `✏️ ${C.WHITE}${ctx.gitChanges.files} files${C.RESET} ${C.GREEN}+${ctx.gitChanges.insertions}${C.RESET} ${C.RED}-${ctx.gitChanges.deletions}${C.RESET}`;
			// OSC 8 하이퍼링크 (PR 링크와 동일 방식) — diffViewerUrl이 있을 때만
			line4 += ctx.diffViewerUrl
				? `\x1b]8;;${ctx.diffViewerUrl}\x07${changesText}\x1b]8;;\x07`
				: changesText;
		}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/main.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Run the full suite**

Run: `bun test`
Expected: PASS (all files).

- [ ] **Step 6: Commit**

```bash
git add src/render.ts src/__tests__/main.test.ts
git commit -m "feat: wrap statusline changes count in OSC 8 diff viewer link

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 11: Full viewer front-end (replace the spike)

**Files:**
- Rewrite: `src/viewer/main.ts` (replace the Task 1 hardcoded sample)
- (Reuse: `src/viewer/index.html`, `src/viewer/mapStatus.ts`)

**Interfaces:**
- Consumes: `@pierre/diffs` (`CodeView`, `parsePatchFiles`), `@pierre/trees` (`FileTree`), `changeTypeToGitStatus` (`mapStatus.ts`).
- Behavior: read `repo`/`token` from `location.search`; fetch `/api/diff`; parse; render FileTree (sidebar) + CodeView (panel) joined by file path; toolbar toggles for split/unified, include-untracked, refresh; re-fetch on window focus.

- [ ] **Step 1: Rewrite `src/viewer/main.ts`**

Replace the entire file with:
```ts
import { CodeView, type FileDiffMetadata, parsePatchFiles } from "@pierre/diffs";
import { FileTree } from "@pierre/trees";
import { changeTypeToGitStatus } from "./mapStatus.ts";

const params = new URLSearchParams(location.search);
const repo = params.get("repo") ?? "";
const token = params.get("token") ?? "";

const treeMount = document.getElementById("tree") as HTMLElement;
const diffMount = document.getElementById("diff") as HTMLElement;
const statusEl = document.getElementById("status") as HTMLElement;

let diffStyle: "unified" | "split" = "unified";
let includeUntracked = false;
let codeView: CodeView | null = null;
let fileTree: FileTree | null = null;

function renderFiles(files: FileDiffMetadata[]): void {
	treeMount.replaceChildren();
	diffMount.replaceChildren();

	if (files.length === 0) {
		diffMount.innerHTML = '<div id="empty">No changes.</div>';
		statusEl.textContent = "";
		return;
	}
	statusEl.textContent = `${files.length} file(s)`;

	fileTree = new FileTree({
		paths: files.map((f) => f.name),
		gitStatus: files.map((f) => ({
			path: f.name,
			status: changeTypeToGitStatus(f.type),
		})),
		initialExpansion: "open",
		flattenEmptyDirectories: true,
		search: true,
		onSelectionChange: (selected) => {
			const path = selected[0];
			if (path && codeView) codeView.scrollTo({ type: "item", id: path });
		},
	});
	fileTree.render({ containerWrapper: treeMount });

	codeView = new CodeView({ diffStyle, themeType: "dark", stickyHeaders: true });
	codeView.setup(diffMount);
	codeView.setItems(
		files.map((f) => ({ id: f.name, type: "diff" as const, fileDiff: f })),
	);
	codeView.render();
}

async function load(): Promise<void> {
	statusEl.textContent = "Loading…";
	try {
		const query = new URLSearchParams({
			repo,
			token,
			untracked: includeUntracked ? "1" : "0",
		});
		const res = await fetch(`/api/diff?${query.toString()}`);
		if (!res.ok) {
			diffMount.innerHTML = `<div id="empty">Error: ${res.status}</div>`;
			return;
		}
		const patch = await res.text();
		renderFiles(parsePatchFiles(patch).flatMap((p) => p.files));
	} catch (err) {
		diffMount.innerHTML = `<div id="empty">Failed to load diff.</div>`;
		console.error(err);
	}
}

document.getElementById("toggle-style")?.addEventListener("click", () => {
	diffStyle = diffStyle === "unified" ? "split" : "unified";
	void load();
});
const untrackedInput = document.getElementById("toggle-untracked") as HTMLInputElement;
untrackedInput?.addEventListener("change", () => {
	includeUntracked = untrackedInput.checked;
	void load();
});
document.getElementById("refresh")?.addEventListener("click", () => void load());
window.addEventListener("focus", () => void load());

void load();
```

- [ ] **Step 2: Rebuild**

Run: `bun run build && wc -c dist/viewer/main.js`
Expected: exit 0; bundle rebuilt.

- [ ] **Step 3: Manual end-to-end test**

Run (from the worktree, which has real uncommitted changes to view):
```bash
# make a visible change so there's a diff
echo "// scratch" >> src/render.ts
bun run build
XDG_CACHE_HOME=/tmp/cc-e2e CC_STATUSLINE_DIFF_PORT=59572 bun dist/index.js --diff-server >/dev/null 2>&1 &
sleep 1
TOKEN=$(cat /tmp/cc-e2e/cc-statusline/diff-server.token)
echo "open: http://127.0.0.1:59572/?repo=$PWD&token=$TOKEN"
```
Verify in a browser (claude-in-chrome or ask the user):
- File tree shows changed files with git-status indicators.
- Diff panel shows the syntax-highlighted `git diff HEAD`.
- Clicking a file in the tree scrolls the diff to it.
- "Split / Unified" toggles layout; "Include untracked" adds untracked files; "Refresh" re-fetches.

Clean up: `git checkout src/render.ts ; pkill -f "diff-server" ; rm -rf /tmp/cc-e2e`.

- [ ] **Step 4: Commit**

```bash
git add src/viewer/main.ts
git commit -m "feat: implement full Pierre diff viewer front-end

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

---

## Task 12: Final verification, docs, and lint

**Files:**
- Modify: `CLAUDE.md` (document the new feature + env vars)
- Modify: `README.md` (if it lists features — brief mention)

- [ ] **Step 1: Full test suite + coverage + lint + typecheck**

Run:
```bash
bun test --coverage
bun run lint
bun run typecheck
```
Expected: all tests pass; function coverage 100%; Biome clean; `tsc --noEmit` clean. Fix any issues before proceeding.

- [ ] **Step 2: Document the feature in `CLAUDE.md`**

Under the "WHY" bullet list, add:
```
- 클릭 가능한 diff 뷰어: `✏️` 클릭 시 로컬 diff 뷰어(Pierre `@pierre/diffs`+`@pierre/trees`)를 `127.0.0.1:49573`에 띄워 브라우저로 표시
```
Under "수정 시 주의사항", add:
```
- diff 뷰어 데몬은 statusline이 spawn-if-not-running으로 관리 (env `CC_STATUSLINE_DIFF_PORT` 기본 49573, `CC_STATUSLINE_DIFF_DISABLE=1`로 비활성)
- Pierre 컴포넌트는 devDependency이며 `build.ts`가 `dist/viewer/`로 프리번들 (런타임 `dist/index.js`엔 미포함)
```

- [ ] **Step 3: Final build sanity + published-files check**

Run:
```bash
bun run build
npm pack --dry-run 2>/dev/null | grep -E "dist/(index.js|viewer)" | head
```
Expected: `dist/index.js` and `dist/viewer/*` appear in the pack list.

- [ ] **Step 4: Commit docs**

```bash
git add CLAUDE.md README.md
git commit -m "docs: document clickable diff viewer feature and env vars

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoKDRp9WzP8tQn29k4g24g"
```

- [ ] **Step 5: Finish the branch**

Use the superpowers:finishing-a-development-branch skill to decide merge / PR / cleanup.

---

## Self-Review (completed by plan author)

**Spec coverage:** OSC 8 link (Task 10) · daemon `Bun.serve` (Task 7) · spawn-if-not-running + TTL + lock + detached (Task 8) · pre-bundled Pierre viewer, offline (Task 1, 11) · `git diff HEAD` + untracked toggle (Task 5, 11) · port 49573 + env override (Task 2) · kill switch (Task 2, 8) · token + 127.0.0.1 + no CORS + repo check + traversal guard (Task 7) · trees+diffs joined by path with selection scroll (Task 11) · build.ts + files + devDeps (Task 1) · tests for pure/daemon/render (Tasks 2-10) · manual browser E2E (Task 11). All spec sections map to a task.

**Placeholder scan:** every code step contains complete code; no TBD/TODO. The Shiki-engine fallback in Task 1 Step 6 is a documented contingency with a concrete action, not a placeholder.

**Type consistency:** `EnsureResult = { port, token }` returned by `ensureDiffServer` (Task 8) is consumed identically in Task 9. `buildDiffViewerUrl({ port, repo, token })` (Task 3) matches its Task 9 call. `CodeViewDiffItem` shape `{ id, type:'diff', fileDiff }` (Task 11) matches the verified `@pierre/diffs` type. `changeTypeToGitStatus` signature (Task 6) matches its Task 11 use. `RenderContext.diffViewerUrl` (Task 9) matches Task 10 usage and the Task 10 test context.
