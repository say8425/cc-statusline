# cc-statusline

Claude Code용 커스텀 statusline.

![Bun](https://img.shields.io/badge/Bun-black?style=flat&logo=bun)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)

## Preview

![preview-1](docs/preview-1.png)

![preview-2](docs/preview-2.png)

## Features

- **세션 시간**: 현재 세션 경과 시간
- **블록 타이머**: 5시간 블록 남은 시간 (ccusage 연동)
- **Context %**: 현재 context window 사용률 (즉시 반영)
- **세션 토큰**: 누적 토큰 사용량
- **Git 변경사항**: staged/unstaged 라인 수
- **PR URL**: 클릭 가능한 OSC 8 하이퍼링크
- **TrueColor**: 임계값 기반 동적 색상

## Installation

```bash
# 1. Clone
git clone https://github.com/user/cc-statusline.git ~/dev/cc-statusline
cd ~/dev/cc-statusline

# 2. Install dependencies
bun install

# 3. Configure Claude Code
# ~/.claude/settings.json
{
  "statusLine": {
    "type": "command",
    "command": "bun ~/dev/cc-statusline/src/index.ts",
    "padding": 0
  }
}
```

## Dependencies

- [Bun](https://bun.sh) - JavaScript runtime
- [ccusage](https://github.com/ryoppippi/ccusage) - Claude Code usage tracking
- [gh](https://cli.github.com) - GitHub CLI (optional, for PR URL)

## Configuration

색상 임계값:

| 항목 | 정상 (흰색) | 주의 (노란색) | 경고 (빨간색) |
|------|-------------|---------------|---------------|
| Context % | < 50% | 50-80% | > 80% |
| 블록 타이머 | > 10분 | 1-10분 | < 1분 |

## License

MIT
