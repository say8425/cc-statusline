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
- **Cost**: Session cost in USD
- **Context**: Token usage with percentage (color-coded)
- **Git Diff**: File count, insertions, deletions
- **PR URL**: Clickable OSC 8 hyperlink
- **Worktree Support**: Shows real project name when running in a `cc --worktree` session
- **TrueColor**: Dynamic colors based on thresholds
- **Limit Reset Time**: Reset time display (HH:MM)
- **Block Usage**: 5-hour utilization percentage (from server API)
- **Weekly Reset Timer**: Weekly limit reset time (MM/DD HH:MM)
- **Weekly Usage**: 7-day utilization percentage (from server API)

## Emoji Guide

| Emoji | Description              |
| ----- | ------------------------ |
| 📁    | Project folder name      |
| 🌲    | Worktree name (shown in worktree sessions) |
| 🌿    | Current Git branch       |
| ⏱️    | Session elapsed time     |
| 💰    | Session cost in USD      |
| 🧠    | Context window usage     |
| ⏳    | Limit reset time         |
| 📊    | 5-hour utilization %     |
| ⏰    | Weekly limit reset time  |
| 📅    | 7-day utilization %      |
| ✏️    | Uncommitted changes      |
| 📎    | Pull request link        |

## Usage Metrics

Shows usage information from the Anthropic Usage API.

> [!WARNING]
> The `--show-usage` feature uses an unofficial, reverse-engineered Anthropic API endpoint to retrieve usage data. This is not an officially supported API, and may break or change at any time without notice. **Use at your own risk.** The author assumes no responsibility for any consequences, including but not limited to account restrictions or service disruptions, that may arise from the use of this feature.

> [!NOTE]
> This feature is **macOS only** as it reads the OAuth token from macOS Keychain (`Claude Code-credentials`).

### How It Works

Calls the Anthropic Usage API (`/api/oauth/usage`) using the OAuth access token from macOS Keychain to retrieve:

1. **5-hour utilization** - Server-calculated usage percentage for the current billing block
2. **7-day utilization** - Server-calculated weekly usage percentage
3. **Reset timer** - Exact reset time from the server (`five_hour.resets_at`)
4. **Weekly reset timer** - Weekly limit reset time (`seven_day.resets_at`), shown as `MM/DD HH:MM` (e.g., `02/15 17:00`)

### Enable

Usage metrics are **hidden by default**. To enable, use the `--show-usage` flag:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline --show-usage",
    "padding": 0
  }
}
```

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

# Lint
bun run lint
```

## Color Thresholds

| Metric        | Normal (white) | Warning (yellow) | Critical (red) |
| ------------- | -------------- | ---------------- | -------------- |
| Context %     | < 50%          | 50-80%           | > 80%          |
| Block Usage % | < 50%          | 50-80%           | > 80%          |

## License

MIT
