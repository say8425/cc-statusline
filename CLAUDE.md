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
│   ├── ultracode.ts                # Claude Code settings의 ultracode 플래그 감지
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
│   │   ├── shortstat.ts            # parseShortstat (git --shortstat 출력 파싱)
│   │   ├── baseChanges.ts          # getBaseChangesCached (✏️ vs base 진입점 유지용)
│   │   ├── baseRef.ts              # resolveBaseRef (PR 타겟/기본 브랜치 결정)
│   │   ├── pr.ts                   # getPrUrlCached
│   │   └── worktree.ts             # getMainProjectNameCached
│   ├── diff-server/
│   │   ├── config.ts               # getCacheDir, getDiffdeckCacheDir, resolveDiffPort, isDiffViewerDisabled
│   │   ├── link.ts                 # buildDiffViewerUrl
│   │   ├── token.ts                # readTokenSync (diffdeck가 발급한 토큰을 읽기 전용으로 읽음)
│   │   └── ensure.ts               # ensureDiffServer (diffdeck CLI를 spawn-if-not-running으로 데몬 관리)
│   └── __tests__/                  # 테스트 파일
│       ├── pure.test.ts            # 순수 함수 테스트
│       ├── cached.test.ts          # 캐시 메커니즘 테스트
│       ├── main.test.ts            # renderStatusLine 테스트
│       ├── async.test.ts           # 비동기 함수 통합 테스트
│       ├── integration.test.ts     # main 함수 통합 테스트
│       ├── stdin.test.ts           # readStdin 테스트
│       ├── ultracode.test.ts       # ultracode settings 경로·우선순위·캐시 테스트
│       ├── shortstat.test.ts       # parseShortstat 테스트
│       ├── base-changes.test.ts    # getBaseChangesCached 테스트
│       ├── base-ref.test.ts        # resolveBaseRef 테스트
│       ├── diff-config.test.ts     # diff-server/config 테스트
│       ├── diff-token.test.ts      # diff-server/token 테스트
│       ├── diff-ensure.test.ts     # diff-server/ensure 테스트
│       └── diff-link.test.ts       # diff-server/link 테스트
├── .oxlintrc.json     # oxlint 설정 (rule 구성, type-aware 포함)
├── .oxfmtrc.json      # oxfmt 설정 (탭 인덴트, 더블쿼트 — biome에서 이관)
├── bunfig.toml        # Bun 테스트 설정
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

**기술 스택**: Bun, TypeScript, gh CLI, oxlint/oxfmt (린트·포맷)

**데이터 소스** (stdin JSON을 우선 참조, 공식 스키마: https://code.claude.com/docs/en/statusline):
| 데이터 | 출처 |
|--------|------|
| 프로젝트 폴더 | `workspace.project_dir` |
| 세션 시간 | `cost.total_duration_ms` |
| 세션 비용 | `cost.total_cost_usd` |
| Context 토큰 | `context_window.current_usage.*` |
| Context % | `context_window.used_percentage` (없으면 미표시) |
| 모델명 | `model.display_name` (없으면 미표시) |
| Reasoning effort | `effort.level` (effort 지원 모델만 전달, 없으면 모델명만 표시) |
| Ultracode 여부 | settings 파일 `ultracode` 키 (managed → local → project → user 순, stdin엔 미노출) + `effort.level == "xhigh"` 교차검증 |
| 블록 사용량 | `rate_limits.five_hour.used_percentage` |
| 리셋 타이머 | `rate_limits.five_hour.resets_at` |
| 주간 사용량 | `rate_limits.seven_day.used_percentage` |
| 주간 리셋 시간 | `rate_limits.seven_day.resets_at` |
| Git 브랜치 | `git branch --show-current` |
| Git diff | `git diff --shortstat` |
| PR URL/상태/CI | `gh pr view --json url,state,isDraft,statusCheckRollup` |
| 메인 프로젝트명 | `git rev-parse --git-common-dir` (워크트리) |

## WHY

Claude Code 기본 statusbar에 다음 정보를 추가로 표시:
- 세션 시간 및 비용
- Context window 토큰 사용량 및 사용률 (%)
- 현재 사용 중인 모델명·reasoning effort (`🤖 Fable 5 high`, 🧠 컨텍스트 세그먼트 오른쪽) — 설정에서 ultracode가 켜져 있고 세션 effort가 `xhigh`일 때만 `⚡ultra` 배지 추가 (`🤖 Fable 5 xhigh ⚡ultra`)
- Git diff 통계 (파일 수, +insertions, -deletions)
- 클릭 가능한 diff 뷰어: `✏️` 클릭 시 로컬 diff 뷰어를 브라우저로 표시. 뷰어 자체(파일트리, working/vs-base 모드 전환 UI, watch 자동 갱신, 파일 폴딩, 이미지 diff, in-app 검색 등)는 별도 패키지 **[`@say8425/diffdeck`](https://github.com/say8425/diffdeck)**(runtime dependency)가 제공 — cc-statusline은 그 데몬을 spawn-if-not-running으로 띄우고 링크만 구성한다. 뷰어 기능 상세는 diffdeck 저장소 문서 참고
- 클릭 가능한 폴더 링크: `📁`(및 워크트리 세션의 `🌲`)를 클릭하면 OS 기본 파일 관리자(Finder/Explorer/xdg-open 대상)에서 해당 폴더가 열림 — `file://` OSC 8 하이퍼링크, `src/format/toFileUrl.ts`. GUI 없는 headless 리눅스 세션은 열어줄 파일 관리자가 없어 지원 범위 밖.
- PR 상태 배지: `📎` 라벨 옆에 PR 상태(Open/Draft/Merged/Closed, 색상별)와 CI 체크 아이콘(✅/🟡/❌, Open/Draft에서만 표시)을 함께 표시 — `gh pr view --json url,state,isDraft,statusCheckRollup`, 집계 로직은 `src/git/ciStatus.ts`
- diff 뷰어 모드: `Working tree`(HEAD 대비) / `vs <base>`(PR 타겟 또는 기본 브랜치 대비) — base는 cc-statusline의 `src/git/baseRef.ts`(resolveBaseRef)가 `gh pr view`→`origin/HEAD`→main/master 순으로 결정해 뷰어에 전달
- `✏️` 진입점 유지: working 변경이 없어도 브랜치가 base보다 앞서면 `✏️ vs <base> N files +X -Y`로 표시되고 클릭 시 뷰어가 base 모드로 열림 — 진입점 트리거는 `repo && (hasChanges || baseChanges)`(`src/index.ts`)
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

**커버리지**: 함수 98%+, 라인 94%+ (diff-server 데몬 spawn/에러 경로 등 일부 브랜치 제외)

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
- ultracode 여부는 stdin JSON·env에 세션 단위로 노출되지 않음 (`effort.level`은 ultracode여도 `xhigh`로만 보고, CLI 2.1.201에서 실측 확인). 따라서 `src/ultracode.ts`가 Claude Code settings 파일(managed-settings.json → `<project>/.claude/settings.local.json` → `<project>/.claude/settings.json` → `~/.claude/settings.json`)의 `ultracode` boolean 키를 직접 읽는다 (5초 TTL 캐시, 읽기는 병렬·판정은 우선순위 순). 설정은 세션 상태가 아니므로 render에서 `effort.level === "xhigh"`와 교차검증해 false positive를 줄인다 (ultracode 세션은 항상 xhigh로 보고; 다만 수동 `/effort xhigh` + 설정 on 조합은 구분 불가라 best-effort). 캐시는 다른 캐시들과 마찬가지로 projectDir 무키(틱마다 새 프로세스라 실질 무해). 우선순위상 프로젝트 settings가 `ultracode: false`를 고정하면 user 설정 토글이 가려지는데 이는 Claude Code 해석 순서 그대로라 의도된 동작. 공식 스키마에 ultracode 필드가 추가되면 stdin 우선으로 전환할 것
- diff 뷰어 데몬은 statusline이 spawn-if-not-running으로 관리 (env `CC_STATUSLINE_DIFF_PORT` 기본 49573, `CC_STATUSLINE_DIFF_DISABLE=1`로 비활성 — 계약은 이전과 동일). 다만 이제 뜨는 건 cc-statusline 자체 서버가 아니라 **`@say8425/diffdeck`**(dependency) CLI다: `src/diff-server/ensure.ts`가 `import.meta.resolve("@say8425/diffdeck/package.json")`로 diffdeck의 `bin.diffdeck` 경로를 찾아 `bun <cli> --no-open --port <PORT>`를 `DIFFDECK_PORT` env와 함께 detached로 spawn. 이미 떠 있는지는 `/api/ping` 응답의 `x-diffdeck` 헤더로 판별(과거 자체 서버 시절엔 `x-cc-statusline`)
- diff 뷰어 데몬은 statusline 종속: statusline이 `repo && (hasChanges || baseChanges)`일 때만 spawn-if-not-running. **유휴 종료 없음** → 한번 뜨면 재부팅/수동 종료 전까지 상주해 작업 중 안 죽음. 부팅 자동시작은 없어 재부팅 시엔 죽고 다음 statusline tick(~5초, `ENSURE_TTL_MS`)에 respawn. 따라서 뷰어는 북마크 URL 대신 statusline의 `✏️` 링크로 여는 것을 권장(✏️는 클릭 직전 데몬 ensure + 현재 토큰 포함). 토큰은 이제 diffdeck이 자신의 캐시 디렉터리(`<XDG_CACHE_HOME|~/.cache>/diffdeck/diff-server.token`)에 발급·영속하며, cc-statusline은 `readTokenSync`(`src/diff-server/token.ts`)로 **읽기만** 한다 — 자체 토큰 발급(`ensureToken`)은 제거됨. resolve/spawn 경로의 실패(diffdeck 모듈 미설치, EMFILE 등)는 fire-and-forget try/catch로 조용히 무시되어 300ms 핫 패스가 절대 throw하지 않는다 (`src/diff-server/ensure.ts`의 `maybeSpawn`)
- Pierre 컴포넌트(`@pierre/diffs`, `@pierre/trees`)와 뷰어 프리번들(`dist/viewer/`)은 diffdeck 저장소로 이관되어 이 저장소엔 없음. `build.ts`는 이제 `src/index.ts` → `dist/index.js`만 번들
