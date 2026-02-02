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

### Context Normal (< 50%)

![Screenshot of status line with normal context usage, under 50%](docs/context_normal.png)

### Context Warning (50-80%)

![Screenshot of status line with warning context usage, between 50% and 80%](docs/context_warning.png)

### Context Critical (> 80%)

![Screenshot of status line with critical context usage, over 80%](docs/context_critical.png)

### Limit Reset Timer

![Screenshot of status line with limit reset timer](docs/limit_reset.png)

## Features

- **Session Time**: Current session elapsed time
- **Cost**: Session cost in USD
- **Context**: Token usage with percentage (color-coded)
- **Git Diff**: File count, insertions, deletions
- **PR URL**: Clickable OSC 8 hyperlink
- **TrueColor**: Dynamic colors based on thresholds
- **Limit Reset Timer**: Countdown to usage limit reset
- **Block Usage**: 5-hour block token usage with percentage
- **Burn Rate**: Token consumption rate per minute

## Emoji Guide

| Emoji | Description              |
| ----- | ------------------------ |
| 📁    | Project folder name      |
| 🌿    | Current Git branch       |
| ⏱️    | Session elapsed time     |
| 💰    | Session cost in USD      |
| 🧠    | Context window usage     |
| ⏳    | Limit reset countdown    |
| 📊    | 5-hour block token usage |
| 🔥    | Token burn rate (per min)|
| ✏️    | Uncommitted changes      |
| 📎    | Pull request link        |

## Usage Metrics

Shows usage information for the 5-hour billing block.

### How It Works

Automatically parses JSONL files from `~/.claude/projects/` to detect:

1. **Usage limit error messages** - Extracts exact reset time from "Claude AI usage limit reached" errors
2. **5-hour billing blocks** - Calculates block end time based on latest activity (like [ccusage](https://github.com/ryoppippi/ccusage))
3. **Token usage** - Sums input and output tokens within the current 5-hour block
4. **Burn rate** - Calculates average token consumption per minute

No manual configuration required.

### Disable

To hide the usage metrics line (reset timer, block usage, burn rate), use the `--no-usage` flag:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline --no-usage",
    "padding": 0
  }
}
```

## Dependencies

- [Bun](https://bun.sh) - JavaScript runtime
- [gh](https://cli.github.com) - GitHub CLI (optional, for PR URL)

## Color Thresholds

| Metric        | Normal (white) | Warning (yellow) | Critical (red) |
| ------------- | -------------- | ---------------- | -------------- |
| Context %     | < 50%          | 50-80%           | > 80%          |
| Block Usage % | < 50%          | 50-80%           | > 80%          |

## License

MIT
