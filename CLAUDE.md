# cc-statusline

Claude Code용 커스텀 statusline (Bun/TypeScript).

## WHAT

```
cc-statusline/
├── src/
│   ├── index.ts                    # main() 함수 (엔트리포인트)
│   ├── types.ts                    # 모든 shared 인터페이스
│   ├── cache.ts                    # cache, CACHE_TTL, resetCache
│   ├── colors.ts                   # C 상수, getUsageColor
│   ├── cli.ts                      # parseCliArgs
│   ├── render.ts                   # renderStatusLine
│   ├── stdin.ts                    # readStdin
│   ├── format/
│   │   ├── index.ts                # barrel re-export
│   │   ├── formatNumber.ts         # formatNumber
│   │   ├── formatResetDate.ts      # formatResetDate
│   │   ├── formatTime.ts           # formatTime
│   │   └── getTimeUntilReset.ts    # getTimeUntilReset
│   ├── git/
│   │   ├── index.ts                # barrel re-export
│   │   ├── branch.ts               # getBranchCached
│   │   ├── changes.ts              # getGitChangesCached
│   │   └── pr.ts                   # getPrUrlCached
│   ├── usage/
│   │   ├── index.ts                # barrel re-export
│   │   ├── token.ts                # getAccessToken, getAccessTokenCached
│   │   └── api.ts                  # fetchUsageFromAPI, usageResponseToBlockUsage, getUsageCached
│   └── __tests__/                  # 테스트 파일
│       ├── pure.test.ts            # 순수 함수 테스트
│       ├── cached.test.ts          # 캐시 메커니즘 테스트
│       ├── cli.test.ts             # CLI 파싱 테스트
│       ├── main.test.ts            # renderStatusLine 테스트
│       ├── async.test.ts           # 비동기 함수 통합 테스트
│       ├── integration.test.ts     # main 함수 통합 테스트
│       └── stdin.test.ts           # readStdin 테스트
├── bunfig.toml        # Bun 테스트 설정
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
| 세션 비용 | `cost.total_cost_usd` |
| Context 토큰 | `context_window.current_usage.*` |
| Context % | `current_usage / context_window_size` |
| Git 브랜치 | `git branch --show-current` |
| Git diff | `git diff --shortstat` |
| PR URL | `gh pr view` |
| 블록 사용량 | Anthropic Usage API (`/api/oauth/usage`, OAuth 토큰) |
| 리셋 타이머 | Anthropic Usage API `five_hour.resets_at` |
| 주간 리셋 시간 | Anthropic Usage API `seven_day.resets_at` |

## WHY

Claude Code 기본 statusbar에 다음 정보를 추가로 표시:
- 세션 시간 및 비용
- Context window 토큰 사용량 및 사용률 (%)
- Git diff 통계 (파일 수, +insertions, -deletions)
- PR URL (클릭 가능한 OSC 8 하이퍼링크)
- 리셋 시각 (5시간 사용량 리셋 시각, HH:MM)
- 주간 리셋 시간 (7일 사용량 리셋 시각, MM/DD HH:MM)
- 블록 사용량 (서버 API 기반 5시간/7일 utilization %)
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

### 수동 테스트

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

### 단위 테스트

```bash
# 테스트 실행
bun test

# 커버리지 포함
bun test --coverage
```

**테스트 구조**:
- `pure.test.ts`: 순수 함수 (getUsageColor, formatNumber, formatTime, formatResetDate, getTimeUntilReset)
- `cached.test.ts`: 캐시 TTL 및 메커니즘
- `cli.test.ts`: CLI 인자 파싱 (--show-usage)
- `main.test.ts`: renderStatusLine 순수 함수 (의존성 주입 방식)
- `usage-api.test.ts`: usageResponseToBlockUsage 단위 테스트
- `async.test.ts`: 비동기 함수 통합 테스트 (실제 git/gh/API 호출)
- `integration.test.ts`: main 함수 E2E 테스트
- `stdin.test.ts`: stdin 읽기 테스트

**커버리지**: 함수 100%, 라인 97%+

### CLI 옵션

- `--show-usage`: 사용량 지표 줄 표시 (기본: 숨김). 리셋 타이머, 5시간/7일 사용량을 Anthropic Usage API에서 가져와 표시

### 수정 시 주의사항

- 300ms마다 실행되므로 성능 중요
- 공식 JSON input structure 참조: https://code.claude.com/docs/en/statusline
- Usage API 응답 구조 참조: https://codelynx.dev/posts/claude-code-usage-limits-statusline
- Usage API 결과는 120초 캐시 TTL 적용
