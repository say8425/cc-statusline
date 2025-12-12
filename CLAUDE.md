# cc-statusline

Claude Code용 커스텀 statusline (Bun/TypeScript).

## WHAT

```
cc-statusline/
├── src/
│   └── index.ts       # 메인 스크립트
├── package.json
├── tsconfig.json
├── statusline.sh      # (deprecated, bash 버전)
└── CLAUDE.md
```

**기술 스택**: Bun, TypeScript, ccusage/data-loader, gh CLI

**데이터 소스** (5개):
| 데이터 | 출처 |
|--------|------|
| 세션 시간 | Claude Code JSON (stdin) |
| 세션 토큰 | `ccusage/data-loader` - loadSessionData() |
| 블록 타이머 | `ccusage/data-loader` - loadSessionBlockData() |
| Context % | `ccusage/data-loader` - calculateContextTokens() |
| Git/PR | git, gh CLI |

## WHY

Claude Code 기본 statusbar에 다음 정보를 추가로 표시:
- 세션 누적 토큰 및 현재 context window 사용률 (%)
- 5시간 블록 남은 시간 (ccusage 연동)
- Git 변경사항 (+/- 라인)
- PR URL (클릭 가능한 OSC 8 하이퍼링크)
- TrueColor 동적 색상 (임계값 기반 경고)

## HOW

### 설치

```bash
# 의존성 설치
cd ~/dev/cc-statusline
bun install

# ~/.claude/settings.json
{
  "statusLine": {
    "type": "command",
    "command": "bun ~/dev/cc-statusline/src/index.ts",
    "padding": 0
  }
}
```

### 의존성

- `bun`: JavaScript 런타임
- `ccusage`: data-loader API 사용
- `gh`: GitHub CLI (PR URL)

### 테스트

```bash
echo '{"transcript_path":"","cost":{"total_duration_ms":3600000}}' | bun src/index.ts
```

### 수정 시 주의사항

- 300ms마다 실행되므로 성능 중요
- ccusage data-loader는 offline 모드로 사용 (캐시된 가격 데이터)
- sessionId 변환: `cwd.replace(/[/.]/g, '-')` (ccusage 방식)
