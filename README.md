# cc-statusline

Custom statusline for Claude Code.

[![npm](https://img.shields.io/npm/v/@say8425/cc-statusline)](https://www.npmjs.com/package/@say8425/cc-statusline)
![Bun](https://img.shields.io/badge/Bun-black?style=flat&logo=bun)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)

## Preview

![preview-1](docs/preview-1.png)

![preview-2](docs/preview-2.png)

## Features

- **Session Time**: Current session elapsed time
- **Context %**: Current context window usage (updates immediately)
- **Session Tokens**: Cumulative token usage
- **PR URL**: Clickable OSC 8 hyperlink
- **TrueColor**: Dynamic colors based on thresholds

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

## Dependencies

- [Bun](https://bun.sh) - JavaScript runtime
- [gh](https://cli.github.com) - GitHub CLI (optional, for PR URL)

## Color Thresholds

| Metric | Normal (white) | Warning (yellow) | Critical (red) |
|--------|----------------|------------------|----------------|
| Context % | < 50% | 50-80% | > 80% |

## License

MIT
