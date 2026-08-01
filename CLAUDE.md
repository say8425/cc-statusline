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
│   │   ├── getTimeUntilReset.ts    # getTimeUntilReset
│   │   ├── prStatus.ts             # prStateText/prStateColor/ciSummaryText/ciSummaryColor (📎 상태·CI 배지)
│   │   └── toFileUrl.ts            # toFileUrl (📁/🌲 클릭용 file:// OSC 8 링크)
│   ├── git/
│   │   ├── index.ts                # barrel re-export
│   │   ├── branch.ts               # getBranchCached
│   │   ├── changes.ts              # getGitChangesCached
│   │   ├── shortstat.ts            # parseShortstat (git --shortstat 출력 파싱)
│   │   ├── baseChanges.ts          # getBaseChangesCached (✏️ vs base 진입점 유지용)
│   │   ├── baseRef.ts              # resolveBaseRef (PR 타겟/기본 브랜치 결정)
│   │   ├── ciStatus.ts             # aggregateCiStatus (statusCheckRollup 집계)
│   │   ├── pr.ts                   # getPrInfoCached (PR URL·상태·CI 롤업)
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
│       ├── ci-status.test.ts       # aggregateCiStatus 테스트
│       ├── diff-config.test.ts     # diff-server/config 테스트
│       ├── diff-token.test.ts      # diff-server/token 테스트
│       ├── diff-ensure.test.ts     # diff-server/ensure 테스트
│       ├── diff-link.test.ts       # diff-server/link 테스트
│       └── diff-contract.test.ts   # 실제 설치된 diffdeck와의 데몬 계약(핑 헤더·토큰 경로) + 버전 3층(설치본↔데몬↔range↔lockfile) 테스트
├── build.ts           # src/index.ts → dist/index.js 번들 스크립트
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
- PR 상태 배지: `📎` 라벨 옆에 `[Open]`/`[Draft]`/`[Merged]`/`[Closed]` 상태(색상별: 녹색/흰색/보라/빨강)와 CI 체크 집계를 `(N passed)`/`(N running)`/`(N failed)` 텍스트(색상별: 녹색/노랑/빨강)로 표시 — 상태와 CI 요약 사이 공백 없이 붙여 쓰고(`[Open](3 running)`) 색상 전환 시 RESET 없이 밑줄만 연속 유지, PR 상태와 무관하게 체크가 있으면 항상 표시. `gh pr view --json url,state,isDraft,statusCheckRollup`, 집계 로직은 `src/git/ciStatus.ts`
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
- `ultracode.test.ts`: ultracode settings 경로·우선순위·캐시
- `shortstat.test.ts`: parseShortstat
- `base-changes.test.ts` / `base-ref.test.ts`: vs-base 진입점 유지·base 결정
- `ci-status.test.ts`: aggregateCiStatus (PR 체크 집계)
- `diff-config/token/ensure/link.test.ts`: diff-server 모듈별 테스트
- `diff-contract.test.ts`: 실제 설치된 diffdeck 데몬과의 계약(핑 헤더·토큰 경로) + 버전 검증 3층(데몬=설치본 / 설치본∈range / 설치본=lockfile)

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
- **데몬을 수동으로 죽일 땐 반드시 LISTEN 소켓만 걸러낼 것** — `lsof -ti tcp:49573`은 리스너뿐 아니라 **그 포트에 연결된 소켓을 가진 프로세스까지** 반환한다. 뷰어를 열어 둔 브라우저가 여기 걸린다: 2026-08-01 실측에서 `lsof -ti tcp:49573`이 diffdeck 데몬과 함께 WebKit Networking XPC 서비스를 돌려줬고, `kill $(lsof -ti tcp:49573)`을 그대로 실행했다면 브라우저 네트워킹 프로세스를 죽였을 것이다(zsh가 명령 치환을 단어 분할하지 않아 `illegal pid`로 실패해 우연히 살았다 — 안전장치가 아니다). 올바른 형태: `lsof -ti tcp:49573 -sTCP:LISTEN | xargs -r kill`. 죽인 뒤엔 spawn 조건(`repo && (hasChanges || baseChanges)`)이 참일 때만 respawn하므로, 워킹트리가 깨끗하고 base보다 앞서지도 않으면 데몬이 안 뜨는 게 정상이다
- 배포된 statusline을 갱신하려면 **bunx 캐시 삭제와 데몬 종료를 함께** 해야 한다 — `rm -rf "$TMPDIR"bunx-*@say8425/cc-statusline*` + 위 kill. 하나만 하면 안 바뀐다: 캐시만 지우면 새 cc-statusline이 떠 있는 옛 데몬을 `probeServer`로 보고 그대로 두고, 데몬만 죽이면 캐시에 남은 옛 cc-statusline이 옛 diffdeck을 다시 띄운다. 릴리스는 이걸 자동으로 밀어주지 않는다(bunx는 캐시가 살아 있으면 재확인하지 않는다)
- Pierre 컴포넌트(`@pierre/diffs`, `@pierre/trees`)와 뷰어 프리번들(`dist/viewer/`)은 diffdeck 저장소로 이관되어 이 저장소엔 없음. `build.ts`는 이제 `src/index.ts` → `dist/index.js`만 번들
- diffdeck 버전 검증은 `src/__tests__/diff-contract.test.ts`가 3층으로 고정한다: ① 실제 설치본을 ephemeral port + 격리 `XDG_CACHE_HOME`에 spawn해 pid+version 대조 → *실행 중인 데몬 = 설치본*, ② `Bun.semver.satisfies` range 단언 → *설치본 ∈ 매니페스트 range*, ③ `await import("../../bun.lock")`의 `packages` 항목 대조 → *설치본 = lockfile resolved*. ①②는 이미 서로 비순환이고(①은 설치본에, ②는 package.json에 앵커), ③은 **세 번째 독립 기준점(lockfile)**을 더한다 — ①②는 어느 쪽이든 설치 트리를 읽으므로 lockfile 드리프트를 못 본다. ③이 잡는 상태는 **git 브랜치 전환이 일상적으로 만든다**: git은 node_modules를 관리하지 않으니 dep 버전이 다른 브랜치를 오가면 저절로 어긋난다. 실제 사례는 이 테스트를 만들던 순간이다 — main이 `^1.2.0`을 선언한 채 트리엔 다른 브랜치에서 설치한 1.3.0이 있었다. `satisfies("1.3.0", "^1.2.0")`는 true라 ②는 통과하고 ③만 걸린다. (#62는 그런 드리프트가 실제로 일어난다는 방증이지 ③의 사례는 아니다 — #62는 range를 `^1.2.0`으로 올렸고 1.0.0은 이를 만족하지 못하므로 ②가 잡는다. 그리고 **머지된 코드가 미검증이었던 것도 아니다**: #62의 CI는 `--frozen-lockfile`로 설치해 통과했으니 1.2.0 계약은 제대로 검증됐고, 어긋난 건 로컬 실행을 근거로 PR 본문에 쓴 문장이다.) 파싱 관련 실측 메모: `bun.lock`은 trailing comma JSONC라 `JSON.parse`·`Bun.file().json()`이 **둘 다 실패**하지만 bun 모듈 로더는 파싱하므로 수제 파서가 필요 없다(형식이 바뀌면 시끄럽게 깨지는데, 그게 원하는 실패 방식이다). `bun list`는 node_modules가 아니라 lockfile을 읽으므로 이 대조엔 쓸모없고, `bun install --frozen-lockfile --dry-run`은 이 드리프트를 감지하지 못한다(exit 0) — `--frozen-lockfile`은 lockfile↔package.json만 본다
- **diffdeck 범프 전에 릴리스 노트를 읽고, 뷰어 외 변경(CLI 플래그·핑 헤더·토큰 경로·`bin` 경로)이 보이면 계약을 손으로 확인할 것.** 위 3층으로도 남는 구멍이 있어서다: **CI가 검증하는 버전 ≠ 사용자가 실행하는 버전**. 배포 tarball은 `files: ["dist/index.js"]`라 lockfile을 담지 않아 사용자 `bunx`는 배포된 range 내 **최신**을 resolve하는데, CI는 lockfile 버전으로 검증한다(지금도 어긋나 있다 — 배포된 5.0.0의 `^1.2.0` → 사용자는 1.3.0을 받는다). 게다가 이 wire contract는 diffdeck 입장에선 내부 구현이라 **semver가 보호하지 않는다**: `ensure.ts`의 `probeServer` 주석이 기록하듯 pre-0.2.2 diffdeck은 버전 헤더를 아예 보내지 않았다 — 0.2.2는 **패치** 릴리스인데 wire 필드가 늘었다. `maybeSpawn`이 fire-and-forget이라 깨져도 조용하다. (`probeServer`가 아직 인식하는 `x-cc-statusline` 마커는 diffdeck의 변경이 아니라 이 저장소가 뷰어를 분리하면서 남긴 자기 흔적이니, 상류 드리프트의 근거로는 쓰지 말 것.) **range-max를 CI에서 설치하는 테스트는 만들지 않는다** — 네트워크 의존적·비결정적이라 이 저장소와 무관한 diffdeck 릴리스가 PR을 막는다(스케줄 잡으로 빼면 PR 게이트는 피하지만 유지 비용 대비 이득이 낮다). dep이 수동 범프라 **범프 시점이 곧 lockfile = range-max 시점**이고 그때 `diff-contract.test.ts`가 검증한다. **캐럿을 떼고 정확 핀하면 이 구멍은 사라진다** — 배포된 `dependencies`가 곧 사용자 resolve 기준이라 핀은 사용자에게 그대로 전파된다. 대신 diffdeck 버그픽스가 cc-statusline 릴리스를 거쳐야 사용자에게 닿는다. 어느 쪽이 나은지는 아직 결정하지 않았으니, 뷰어 외 변경이 잦아지면 핀으로 전환할 것
