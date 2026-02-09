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

## CLI Options

| Option | Description | Default |
|--------|-------------|:-------:|
| [`--plan <plan>`](#plan-selection) | Set cost limit for your subscription (pro, max5x, max20x) | `pro` |
| [`--no-usage`](#disable) | Hide usage metrics line | - |

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
- **Block Usage**: 5-hour block cost usage with percentage
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
| 📊    | 5-hour block cost usage  |
| 🔥    | Token burn rate (per min)|
| ✏️    | Uncommitted changes      |
| 📎    | Pull request link        |

## Usage Metrics

Shows usage information for the 5-hour billing block.

> [!NOTE]
> Anthropic does not publicly disclose the exact formula for subscription usage calculation. Block usage is estimated based on API published pricing and may differ from the actual `/usage` value.

### How It Works

Automatically parses JSONL files from `~/.claude/projects/` to detect:

1. **5-hour billing blocks** - Detects block boundaries using cumulative time and inactivity gap detection (hour-floored for reset timer)
2. **Cost calculation** - Computes cost using model-specific pricing (opus/sonnet/haiku) × token counts
3. **Cross-project scanning** - Scans all projects under `~/.claude/projects/` (blocks are shared across projects)
4. **Burn rate** - Calculates average token consumption per minute

No manual configuration required.

### Plan Selection

Your plan is **automatically detected** from macOS Keychain (`Claude Code-credentials` → `rateLimitTier`), so no configuration is needed.

> [!NOTE]
> Auto-detection is **macOS only**. On other platforms, use `--plan` to specify your plan explicitly.

To manually override, use the `--plan` flag:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline --plan max5x",
    "padding": 0
  }
}
```

| Plan | Cost Limit | Command |
|------|------------|---------|
| Pro | $8 | `--plan pro` |
| Max 5x | $40 | `--plan max5x` |
| Max 20x | $160 | `--plan max20x` |
| Auto-detect (default) | - | - |

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
