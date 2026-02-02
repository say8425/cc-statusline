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

**기술 스택**: Bun, TypeScript, gh CLI, ccusage

**데이터 소스**:
| 데이터 | 출처 |
|--------|------|
| 프로젝트 폴더 | `workspace.project_dir` |
| 세션 시간 | `cost.total_duration_ms` |
| 세션 비용 | `cost.total_cost_usd` |
| Context 토큰 | `context_window.current_usage.*` |
| Context % | `current_usage / context_window_size` |
| Git 브랜치 | `git branch --show-current` |
| Git diff | `git diff --shortstat` |
| PR URL | `gh pr view` |
| 리셋 타이머 | ccusage `loadSessionBlockData()` |
| 블록 사용량 | ccusage `tokenCounts.inputTokens + outputTokens` |
| 번레이트 | 블록 토큰 / 경과 시간 (분) |

## WHY

Claude Code 기본 statusbar에 다음 정보를 추가로 표시:
- 세션 시간 및 비용
- Context window 토큰 사용량 및 사용률 (%)
- Git diff 통계 (파일 수, +insertions, -deletions)
- PR URL (클릭 가능한 OSC 8 하이퍼링크)
- 리셋 타이머 (5시간 사용량 리셋까지 남은 시간)
- 블록 사용량 (5시간 블록 내 토큰 사용량 및 백분율)
- 번레이트 (분당 토큰 소비율)
- TrueColor 동적 색상 (임계값 기반 경고)

## HOW

### 설치

`~/.claude/settings.json`에 추가:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline",
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

### CLI 옵션

- `--no-usage`: 사용량 지표 줄 숨김 (리셋 타이머, 블록 사용량, 번레이트)

### 수정 시 주의사항

- 300ms마다 실행되므로 성능 중요
- 공식 JSON input structure 참조: https://code.claude.com/docs/en/statusline
- ccusage 결과는 60초 캐시 TTL 적용
