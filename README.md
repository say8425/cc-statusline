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
- **Block Usage**: 5-hour utilization percentage
- **Weekly Reset Timer**: Weekly limit reset time (MM/DD HH:MM)
- **Weekly Usage**: 7-day utilization percentage

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

Shows usage information from Claude Code's stdin JSON input.

### How It Works

Claude Code passes `rate_limits` in the stdin JSON input (CLI 2.1.80+):

1. **5-hour utilization** - Usage percentage for the current billing block (`rate_limits.five_hour.used_percentage`)
2. **7-day utilization** - Weekly usage percentage (`rate_limits.seven_day.used_percentage`)
3. **Reset timer** - Exact reset time (`rate_limits.five_hour.resets_at`), shown as `HH:MM`
4. **Weekly reset timer** - Weekly limit reset time (`rate_limits.seven_day.resets_at`), shown as `MM/DD HH:MM` (e.g., `02/15 17:00`)

Usage metrics are **automatically displayed** when `rate_limits` is present in the stdin JSON. No additional flags or configuration needed.

> [!NOTE]
> `rate_limits` is only available for Claude.ai subscribers (Pro/Max) after the first API response. See the [official statusline docs](https://code.claude.com/docs/en/statusline) for the full JSON schema.

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
