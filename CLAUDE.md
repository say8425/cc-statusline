# cc-statusline

Claude Code용 커스텀 statusline (Bun/TypeScript).

## WHAT

```
cc-statusline/
├── src/
│   └── index.ts       # 메인 스크립트
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

**기술 스택**: Bun, TypeScript, gh CLI

**데이터 소스**:
| 데이터 | 출처 |
|--------|------|
| 프로젝트 폴더 | `workspace.project_dir` |
| 세션 시간 | `cost.total_duration_ms` |
| Context 토큰 | `context_window.current_usage.*` |
| Context % | `current_usage / context_window_size` |
| Git 브랜치 | `git branch --show-current` |
| PR URL | `gh pr view` |

## WHY

Claude Code 기본 statusbar에 다음 정보를 추가로 표시:
- 세션 누적 토큰 및 현재 context window 사용률 (%)
- PR URL (클릭 가능한 OSC 8 하이퍼링크)
- TrueColor 동적 색상 (임계값 기반 경고)

## HOW

### 설치

```bash
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
- `gh`: GitHub CLI (PR URL)

### 테스트

```bash
echo '{
  "cost":{"total_duration_ms":3600000,"total_cost_usd":0.50},
  "context_window":{
    "context_window_size":200000,
    "current_usage":{"input_tokens":50000,"output_tokens":10000,"cache_creation_input_tokens":5000,"cache_read_input_tokens":2000}
  },
  "workspace":{"project_dir":"/Users/penguin/dev/cc-statusline"}
}' | bun src/index.ts
```

### 수정 시 주의사항

- 300ms마다 실행되므로 성능 중요
- 공식 JSON input structure 참조: https://code.claude.com/docs/en/statusline
