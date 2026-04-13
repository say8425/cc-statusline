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
│   │   ├── pr.ts                   # getPrUrlCached
│   │   └── worktree.ts             # getMainProjectNameCached
│   └── __tests__/                  # 테스트 파일
│       ├── pure.test.ts            # 순수 함수 테스트
│       ├── cached.test.ts          # 캐시 메커니즘 테스트
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

**데이터 소스** (stdin JSON을 우선 참조, 공식 스키마: https://code.claude.com/docs/en/statusline):
| 데이터 | 출처 |
|--------|------|
| 프로젝트 폴더 | `workspace.project_dir` |
| 세션 시간 | `cost.total_duration_ms` |
| 세션 비용 | `cost.total_cost_usd` |
| Context 토큰 | `context_window.current_usage.*` |
| Context % | `context_window.used_percentage` (없으면 미표시) |
| 블록 사용량 | `rate_limits.five_hour.used_percentage` |
| 리셋 타이머 | `rate_limits.five_hour.resets_at` |
| 주간 사용량 | `rate_limits.seven_day.used_percentage` |
| 주간 리셋 시간 | `rate_limits.seven_day.resets_at` |
| Git 브랜치 | `git branch --show-current` |
| Git diff | `git diff --shortstat` |
| PR URL | `gh pr view` |
| 메인 프로젝트명 | `git rev-parse --git-common-dir` (워크트리) |

## WHY

Claude Code 기본 statusbar에 다음 정보를 추가로 표시:
- 세션 시간 및 비용
- Context window 토큰 사용량 및 사용률 (%)
- Git diff 통계 (파일 수, +insertions, -deletions)
- PR URL (클릭 가능한 OSC 8 하이퍼링크)
- 리셋 시각 (5시간 사용량 리셋 시각, HH:MM)
- 주간 리셋 시간 (7일 사용량 리셋 시각, MM/DD HH:MM)
- 블록 사용량 (stdin rate_limits 기반 5시간/7일 사용률 %)
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
# rate_limits 포함 (사용량 줄 표시)
echo '{
  "cost":{"total_duration_ms":3600000,"total_cost_usd":0.50},
  "context_window":{
    "context_window_size":200000,
    "current_usage":{"input_tokens":50000,"output_tokens":10000,"cache_creation_input_tokens":5000,"cache_read_input_tokens":2000}
  },
  "workspace":{"project_dir":"/Users/penguin/dev/cc-statusline"},
  "rate_limits":{
    "five_hour":{"used_percentage":56,"resets_at":1704114000},
    "seven_day":{"used_percentage":37,"resets_at":1704585600}
  }
}' | bun src/index.ts

# rate_limits 없음 (사용량 줄 미표시)
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
- `main.test.ts`: renderStatusLine 순수 함수 (의존성 주입 방식)
- `async.test.ts`: 비동기 함수 통합 테스트 (실제 git/gh 호출)
- `integration.test.ts`: main 함수 E2E 테스트
- `stdin.test.ts`: stdin 읽기 테스트

**커버리지**: 함수 100%, 라인 97%+

### 릴리스

[릴리스 가이드](docs/RELEASE_GUIDE.md) 참조. release-please + Conventional Commits 기반 자동 릴리스.
- `fix:` → patch, `feat:` → minor, `feat!:` / `BREAKING CHANGE:` → major
- `chore`, `docs`, `test`, `ci` 등은 릴리스를 트리거하지 않음

### 수정 시 주의사항

- 300ms마다 실행되므로 성능 중요
- 모든 데이터는 Claude Code가 stdin으로 전달하는 JSON을 우선 참조
- 공식 JSON input structure 참조: https://code.claude.com/docs/en/statusline
- 새로운 필드 추가나 구조 변경 시 공식 문서의 "Available data" 섹션과 "Full JSON schema"를 먼저 확인
- `rate_limits`는 stdin JSON에 포함되어 전달됨 (Claude Code CLI 2.1.80+)
- `rate_limits`는 Claude.ai 구독자(Pro/Max)에게만 첫 API 응답 이후 제공됨
- `rate_limits.resets_at`는 Unix timestamp (초 단위, number)
- `rate_limits`가 없으면 사용량 줄이 표시되지 않음
