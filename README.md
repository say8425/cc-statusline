# cc-statusline

English | [한국어](docs/README.ko.md) | [日本語](docs/README.ja.md) | [中文](docs/README.zh.md) | [Español](docs/README.es.md)

Custom statusline for Claude Code.

[![Claude Code](https://img.shields.io/badge/Claude_Code-D97757?style=flat&logo=claude&logoColor=white)](https://code.claude.com/docs/en/statusline)
[![npm](https://img.shields.io/npm/v/%40say8425%2Fcc-statusline?logo=npm&logoColor=%23CC3534&color=%23CC3534)](https://www.npmjs.com/package/@say8425/cc-statusline)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-black?style=flat&logo=bun)](https://bun.sh)

## Screenshot

### Git diff only

![scenario1_diff_only](docs/scenario1_diff_only.png)

### PR only

![scenario2_pr_only](docs/scenario2_pr_only.png)

### Git diff + PR

![scenario3_diff_pr](docs/scenario3_diff_pr.png)

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

## Features

- **Session Time**: Current session elapsed time
- **Cost**: Session cost in USD
- **Context**: Token usage with percentage (color-coded)
- **Git Diff**: File count, insertions, deletions
- **PR URL**: Clickable OSC 8 hyperlink
- **TrueColor**: Dynamic colors based on thresholds

## Emoji Guide

| Emoji | Description          |
| ----- | -------------------- |
| 📁    | Project folder name  |
| 🌿    | Current Git branch   |
| ⏱️    | Session elapsed time |
| 💰    | Session cost in USD  |
| 🧠    | Context window usage |
| ✏️    | Uncommitted changes  |
| 📎    | Pull request link    |

## Dependencies

- [Bun](https://bun.sh) - JavaScript runtime
- [gh](https://cli.github.com) - GitHub CLI (optional, for PR URL)

## Color Thresholds

| Metric    | Normal (white) | Warning (yellow) | Critical (red) |
| --------- | -------------- | ---------------- | -------------- |
| Context % | < 50%          | 50-80%           | > 80%          |

## License

MIT
