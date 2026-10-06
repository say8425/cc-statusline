# cc-statusline

English | [한국어](docs/README.ko.md) | [日本語](docs/README.ja.md) | [中文](docs/README.zh.md) | [Español](docs/README.es.md)

Custom statusline for Claude Code.

[![Claude Code](https://img.shields.io/badge/Claude_Code-D97757?style=flat&logo=claude&logoColor=white)](https://code.claude.com/docs/en/statusline)
[![npm](https://img.shields.io/npm/v/%40say8425%2Fcc-statusline?logo=npm&logoColor=%23CC3534&color=%23CC3534)](https://www.npmjs.com/package/@say8425/cc-statusline)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-black?style=flat&logo=bun)](https://bun.sh)

## Installation

Add the following to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline",
    "padding": 0
  }
}
```

## Screenshots

### Git diff only

![scenario1_diff_only](docs/scenario1_diff_only.png)

### PR only

![scenario2_pr_only](docs/scenario2_pr_only.png)

### Git diff + PR

![scenario3_diff_pr](docs/scenario3_diff_pr.png)

### Worktree

![worktree_diff](docs/worktree_diff.png)

### Worktree + Usage Metrics

![worktree_usage](docs/worktree_usage.png)

### Usage Metrics

![Screenshot of status line with usage metrics](docs/usage_metrics.png)

## Features

- **Session Time**: Current session elapsed time
- **Cost**: Session cost in USD — hidden by default, set `CC_STATUSLINE_SHOW_COST=1` to show (see [Configuration](#configuration))
- **Context**: Token usage with percentage (color-coded)
- **Model**: Current model name and reasoning effort (e.g., `Fable 5 high`), with an `⚡ultra` badge in ultracode sessions
- **Git Diff**: File count, insertions, deletions
- **Clickable Diff Viewer**: Click `✏️` to open a local diff viewer in your browser (see [Diff Viewer](#diff-viewer))
- **PR URL**: Clickable OSC 8 hyperlink
- **Worktree Support**: Shows real project name when running in a `cc --worktree` session
- **TrueColor**: Dynamic colors based on thresholds
- **Limit Reset Time**: Reset time display (HH:MM)
- **Block Usage**: 5-hour utilization percentage
- **Weekly Reset Timer**: Weekly limit reset time (MM/DD(Fri) HH:MM — the weekday name follows your locale)
- **Weekly Usage**: 7-day utilization percentage
- **Session Name**: This session's mention address, shown as `@"name"` — paste it into another Claude session to message this one

## Emoji Guide

| Emoji | Description              |
| ----- | ------------------------ |
| 📁    | Project folder name (click to open in file manager) |
| 🌲    | Worktree name (click to open worktree folder) |
| 🌿    | Current Git branch       |
| ⏱️    | Session elapsed time     |
| 💰    | Session cost in USD (hidden by default — see [Configuration](#configuration)) |
| 🧠    | Context window usage     |
| 🤖    | Current model and effort |
| `@`   | Session name — the mention address |
| ⏳    | Limit reset time         |
| 📊    | 5-hour utilization %     |
| ⏰    | Weekly limit reset time  |
| 📅    | 7-day utilization %      |
| ✏️    | Uncommitted changes (click to open diff viewer) |
| 📎    | Pull request link — color-coded state in brackets (`[Open]`/`[Draft]`/`[Merged]`/`[Closed]`) immediately followed by a color-coded CI check summary in parens (`(N passed)`/`(N running)`/`(N failed)`) when checks exist |

## Color Thresholds

| Metric        | Normal (white) | Warning (yellow) | Critical (red) |
| ------------- | -------------- | ---------------- | -------------- |
| Context %     | < 50%          | 50-80%           | > 80%          |
| Block Usage % | < 50%          | 50-80%           | > 80%          |

## Configuration

Everything is driven by the stdin JSON Claude Code provides, so there is nothing to configure for the defaults. These environment variables adjust what is rendered:

| Environment variable | Effect |
| -------------------- | ------ |
| `CC_STATUSLINE_SHOW_COST=1` | Show the `💰` session cost segment (hidden by default) |
| `CC_STATUSLINE_DIFF_PORT` | Change the diff viewer port (default: `49573`) |
| `CC_STATUSLINE_DIFF_DISABLE=1` | Disable the diff viewer entirely |

Set them where your statusline command runs — for example in `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "CC_STATUSLINE_SHOW_COST=1 bunx @say8425/cc-statusline",
    "padding": 0
  }
}
```

## Diff Viewer

Click `✏️` in the statusline to open a local diff viewer in your browser. The viewer itself is provided by [diffdeck](https://github.com/say8425/diffdeck) ([`@say8425/diffdeck`](https://www.npmjs.com/package/@say8425/diffdeck) on npm), installed automatically as a runtime dependency of cc-statusline — the statusline spawns it as a background daemon and links to it from the `✏️` entry point.

![diff_viewer](docs/diff_viewer.png)

> [!TIP]
> **Pairs well with [cmux](https://cmux.com)** — the viewer opens right in cmux's [browser side panel](https://cmux.com/docs/browser-automation), so your diff sits next to your terminal instead of in a separate window. cmux's built-in diff viewer felt clunky to use, which is part of why this one exists.

- **Two diff modes**: `Working tree` (vs HEAD) and `vs <base>` (merge-base against the PR target or default branch). After you commit, the entry point stays alive as `✏️ vs <base>` — clicking it opens the viewer in base mode, so your diff never disappears mid-review.

![diff_vs_base](docs/diff_vs_base.png)

- **Image diff**: changed binary images (png/jpg/gif/webp/avif/bmp/ico) render inline in the diff flow, in the same order as the file tree — side-by-side Old/New panels on a checkerboard background, foldable like any other file

![image_diff](docs/image_diff.png)
- **Unified / Split** view toggle
- **Watch mode**: auto-refresh (~2s polling) that detects changes while preserving scroll position
- **File tree**: left/right placement, drag-resizable width, flatten (collapse empty directories), and hide-sidebar toggles
- **File folding**: click any file header to collapse/expand; lockfiles and files with more than 1,500 changed lines start collapsed
- **In-app search** (`Cmd/Ctrl+F`): searches the entire diff including deleted lines, with match navigation and highlighting
- **Copy path**: hover a file header to copy the file's relative path
- **diff-grab**: select code in the diff (drag the text for a character-precise selection, or use the gutter `+` for whole lines), type a prompt, and press Enter — the file path, line range, code snippet, and your prompt are copied to the clipboard, ready to paste into an agent like Claude Code
- **Include untracked** files toggle

## How It Works

Most of what the statusline shows comes from the JSON Claude Code passes on stdin — see the [official statusline docs](https://code.claude.com/docs/en/statusline) for the full schema. The few values stdin doesn't carry are read locally, as described below.

### Usage Metrics

Claude Code passes `rate_limits` in the stdin JSON (CLI 2.1.80+). The usage line appears automatically whenever it is present — no flags or configuration needed:

1. **5-hour utilization** - Usage percentage for the current billing block (`rate_limits.five_hour.used_percentage`)
2. **7-day utilization** - Weekly usage percentage (`rate_limits.seven_day.used_percentage`)
3. **Reset timer** - Exact reset time (`rate_limits.five_hour.resets_at`), shown as `HH:MM`
4. **Weekly reset timer** - Weekly limit reset time (`rate_limits.seven_day.resets_at`), shown as `MM/DD(weekday) HH:MM`. The weekday name is localized from `LC_ALL` / `LC_TIME` / `LANG` (e.g., `02/15(Thu) 17:00` under `en_US.UTF-8`, `02/15(목) 17:00` under `ko_KR.UTF-8`). If none of the three holds a usable value — unset, empty, or `C`/`POSIX`, which mean "do not localize" — the weekday falls back to the runtime default locale (`en-US` with current Bun). macOS Terminal leaves `LANG` empty unless "Set locale environment variables on startup" is enabled

> [!NOTE]
> `rate_limits` is only available for Claude.ai subscribers (Pro/Max) after the first API response.

### Model and Ultracode

The model name and effort come from `model.display_name` and `effort.level` (effort is sent only for models that support it). Ultracode isn't exposed on stdin, so the statusline reads the `ultracode` key from your Claude Code settings files (managed → project local → project → user) and shows `⚡ultra` only when the session also reports `xhigh` effort.

### Session Name

The session name is the address other Claude sessions use to message this one: the name set with `/rename` or `claude -n`, otherwise the default display name such as `my-app-3f`. stdin's `session_name` can't stand in for it — for an unnamed session it holds an AI-generated title, which isn't an address, and it never holds the default display name. The statusline therefore reads Claude Code's local session registry (`<CLAUDE_CONFIG_DIR or ~/.claude>/sessions`) and picks the entry matching `session_id`. The name is always quoted, so names with spaces or non-ASCII characters paste straight into a mention, and the segment is hidden when the registry has no entry for the session. It doesn't depend on `rate_limits`.

### Diff Viewer

The statusline spawns diffdeck as a background daemon on demand at `127.0.0.1:49573` whenever the repo has something to show. Requests are token-protected and bound to localhost.

The two `CC_STATUSLINE_DIFF_*` variables that control it are listed in [Configuration](#configuration).

> [!TIP]
> Open the viewer through the `✏️` link instead of a bookmark — the link always carries a fresh token and makes sure the server is running.

## Dependencies

- [Bun](https://bun.sh) - JavaScript runtime
- [gh](https://cli.github.com) - GitHub CLI (optional, for PR URL)

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run tests with coverage
bun test --coverage

# Type check
bun run typecheck

# Lint (oxlint, type-aware)
bun run lint

# Format (oxfmt)
bun run format
```

## License

MIT
