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
│   │   └── worktree.ts             # getMainProjectCached ({name, path} 반환)
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
├── .npmrc             # registry를 public npm으로 고정 (전역 npmrc가 다른 레지스트리를 가리켜도 무관하게)
├── package.json
├── tsconfig.json
├── bun.lock           # diff-contract.test.ts가 resolved 버전을 읽는 대상
├── .github/
│   ├── dependabot.yml          # diffdeck 범프 PR 자동 생성 (매일 09시 KST, diffdeck만)
│   └── workflows/{pr-check,release}.yml
├── docs/
│   ├── RELEASE_GUIDE.md        # 아래 「릴리스」 절이 참조
│   └── README.{ko,ja,zh,es}.md # 다국어 README (루트 README.md가 영문)
└── CLAUDE.md
```

> 트리는 루트 설정 파일과 `src/`, 그리고 이 문서가 직접 참조하는 경로만 싣는다. `.gitignore`·`CHANGELOG.md`·`LICENSE`·`README.md`·스크린샷 등은 생략.

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
| Git diff | `git diff --shortstat` + `git diff --cached --shortstat` (unstaged·staged 합산, `src/git/changes.ts`) |
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
# 전체 표시 (사용량 줄 + 🧠 컨텍스트 + 🤖 모델)
# 🧠는 used_percentage, 🤖는 model.display_name이 있을 때만 렌더된다 (render.ts) —
# 둘 다 빼면 그 세그먼트가 통째로 사라지므로 스니펫에 넣어 둔다
echo '{
  "cost":{"total_duration_ms":3600000,"total_cost_usd":0.50},
  "context_window":{
    "context_window_size":200000,
    "used_percentage":34,
    "current_usage":{"input_tokens":50000,"output_tokens":10000,"cache_creation_input_tokens":5000,"cache_read_input_tokens":2000}
  },
  "model":{"display_name":"Fable 5"},
  "effort":{"level":"high"},
  "workspace":{"project_dir":"/Users/penguin/dev/cc-statusline"},
  "rate_limits":{
    "five_hour":{"used_percentage":56,"resets_at":1704114000},
    "seven_day":{"used_percentage":37,"resets_at":1704585600}
  }
}' | bun src/index.ts

# rate_limits·used_percentage·model 없음 (사용량 줄·🧠·🤖 전부 미표시)
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

**커버리지**: 함수 98%+, 라인 95%+ (diff-server 데몬 spawn/에러 경로 등 일부 브랜치 제외). 실측은 `bun test --coverage`의 `All files` 행으로 확인할 것 — 하한만 적어 두므로 실제 수치는 이보다 높다

**테스트도 typecheck 대상이다** — `tsconfig.json`의 `exclude`는 `node_modules`뿐이라 `bun run typecheck`가 `src/__tests__`까지 검사한다. `bun test`는 타입을 보지 않고 트랜스파일만 하므로, 테스트의 타입 오류는 이 게이트에서만 걸린다. 실질적 영향 둘: 테스트 헬퍼도 소스와 같은 수준으로 타입이 맞아야 하고, `@ts-expect-error`가 **실제로 검증된다**(가리키는 줄에 오류가 없으면 TS2578로 실패). 과거 `exclude`에 `src/__tests__`가 있던 시절엔 이 파일들이 한 번도 검사되지 않아, 붙어 있던 `@ts-expect-error` 16개가 전부 불필요한 것이었는데도 드러나지 않았다

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
- TypeScript는 7.x(네이티브 Go 구현)를 쓴다. 6.x와 패키징이 다르다: **`tsserver`가 없고**(`bin`은 `tsc` 하나 — 6.x엔 `tsserver.js`·`tsserverlibrary.js`가 있었다), 패키지 `"."` export는 `lib/version.cjs`로 **버전 상수 두 개(`version`·`versionMajorMinor`)뿐**이며 **컴파일러 API는 `typescript/unstable/*`로 옮겨졌다**(`./unstable/sync`·`./unstable/ast` 등). 지금은 소스 어디서도 `typescript`를 import하지 않아 무해하지만, codemod나 AST 스크립트를 붙일 땐 이 경로를 봐야 한다. **번들링은 Bun이 한다**(`build.ts` = `Bun.build`)—`typescript`가 쓰이는 곳은 `typecheck` 게이트(`tsc --noEmit`)뿐이라 배포 산출물은 영향받지 않는다(6.0.3→7.0.2 범프 전후 `dist/index.js` 바이트 동일, sha256 `f9449ba3…`). 저장소엔 에디터 설정 파일이 없어 기본값(에디터 번들 TS)이면 무관하고, 개인 설정에서 "workspace TypeScript"를 쓰고 있다면 가리킬 `tsserver`가 없으니 그때 조정할 것. 린터도 무관하다 — `oxlint-tsgolint`는 `typescript` 패키지에 의존하지 않는 자체 네이티브 바이너리다(`dependencies` 자체가 없고 `@oxlint-tsgolint/<platform>`만 optional)
- diff 뷰어 데몬은 statusline이 spawn-if-not-running으로 관리 (env `CC_STATUSLINE_DIFF_PORT` 기본 49573, `CC_STATUSLINE_DIFF_DISABLE=1`로 비활성 — 계약은 이전과 동일). 다만 이제 뜨는 건 cc-statusline 자체 서버가 아니라 **`@say8425/diffdeck`**(dependency) CLI다: `src/diff-server/ensure.ts`가 `import.meta.resolve("@say8425/diffdeck/package.json")`로 diffdeck의 `bin.diffdeck` 경로를 찾아 `bun <cli> --no-open --port <PORT>`를 `DIFFDECK_PORT` env와 함께 detached로 spawn. 이미 떠 있는지는 `/api/ping` 응답의 `x-diffdeck` 헤더로 판별(과거 자체 서버 시절엔 `x-cc-statusline`)
- diff 뷰어 데몬은 statusline 종속: statusline이 `repo && (hasChanges || baseChanges)`일 때만 spawn-if-not-running. **유휴 종료 없음** → 한번 뜨면 재부팅/수동 종료 전까지 상주해 작업 중 안 죽음. 부팅 자동시작은 없어 재부팅 시엔 죽고 다음 statusline tick(~5초, `ENSURE_TTL_MS`)에 respawn. 따라서 뷰어는 북마크 URL 대신 statusline의 `✏️` 링크로 여는 것을 권장(✏️는 클릭 직전 데몬 ensure + 현재 토큰 포함). 토큰은 이제 diffdeck이 자신의 캐시 디렉터리(`<XDG_CACHE_HOME|~/.cache>/diffdeck/diff-server.token`)에 발급·영속하며, cc-statusline은 `readTokenSync`(`src/diff-server/token.ts`)로 **읽기만** 한다 — 자체 토큰 발급(`ensureToken`)은 제거됨. resolve/spawn 경로의 실패(diffdeck 모듈 미설치, EMFILE 등)는 fire-and-forget try/catch로 조용히 무시되어 300ms 핫 패스가 절대 throw하지 않는다 (`src/diff-server/ensure.ts`의 `maybeSpawn`)
- **데몬을 수동으로 죽일 땐 반드시 LISTEN 소켓만 걸러낼 것** — `lsof -ti tcp:49573`은 리스너뿐 아니라 **그 포트에 연결된 소켓을 가진 프로세스까지** 반환한다. 뷰어를 열어 둔 브라우저가 여기 걸린다: 2026-08-01 실측에서 diffdeck 데몬과 함께 WebKit Networking XPC 서비스가 나왔다(뷰어로의 ESTABLISHED 연결을 쥐고 있어서다). **셸이 막아주지 않는다** — zsh·bash 모두 따옴표 없는 명령 치환을 IFS로 단어 분할하므로(실측: `f $(printf "111\n222\n")` → `argc=2`), `kill $(lsof -ti tcp:49573)`은 두 PID를 각각 인자로 넘겨 브라우저 네트워킹 프로세스에 그대로 시그널을 보낸다. 그때 아무것도 안 죽은 건 명령을 `PIDS=$(...); kill $PIDS` 꼴로 **변수에 담아** 실행했기 때문이다 — zsh는 *파라미터* 확장은 분할하지 않아 `argc=1`이 되고 `illegal pid`로 실패한다(*명령 치환*은 분할한다. 둘을 혼동하지 말 것). 우연이지 안전장치가 아니다. 올바른 형태: `lsof -ti tcp:49573 -sTCP:LISTEN | xargs -r kill` (`-r`은 macOS에선 no-op이고 GNU 호환용). 죽인 뒤엔 spawn 조건(`repo && (hasChanges || baseChanges)`)이 참일 때만 respawn하므로, 워킹트리가 깨끗하고 base보다 앞서지도 않으면 데몬이 안 뜨는 게 정상이다
- 배포된 statusline을 갱신하려면 **bunx 캐시를 지운다** (`rm -rf "$TMPDIR"bunx-*@say8425/cc-statusline*`) — 릴리스가 자동으로 밀어주지 않는다(bunx는 캐시가 살아 있으면 재확인하지 않는다). 반대로 **데몬만 죽이는 건 무의미하다**: 캐시에 남은 옛 cc-statusline이 옛 diffdeck을 도로 띄운다. 다만 캐시를 지우면 diffdeck 버전이 바뀐 경우 **데몬도 알아서 교체된다** — `maybeSpawn`(`src/diff-server/ensure.ts`)은 probe한 버전이 `currentVersion()`과 다르면 그냥 두지 않고 포트 소유자를 SIGTERM → 포트가 비길 대기 → 재spawn 한다(버전 헤더가 없는 구버전 데몬도 `version !== current`라 같이 retire된다). 따라서 수동 kill이 필요한 건 diffdeck 버전이 그대로일 때나 즉시 반영하고 싶을 때뿐이다. 이 교체 역시 spawn 조건이 참인 tick에서만 일어난다
- Pierre 컴포넌트(`@pierre/diffs`, `@pierre/trees`)와 뷰어 프리번들(`dist/viewer/`)은 diffdeck 저장소로 이관되어 이 저장소엔 없음. `build.ts`는 이제 `src/index.ts` → `dist/index.js`만 번들
- diffdeck 버전 검증은 `src/__tests__/diff-contract.test.ts`가 3층으로 고정한다: ① 실제 설치본을 ephemeral port + 격리 `XDG_CACHE_HOME`에 spawn해 pid+version 대조 → *실행 중인 데몬 = 설치본*, ② `Bun.semver.satisfies` range 단언 → *설치본 ∈ 매니페스트 range*, ③ `await import("../../bun.lock")`의 `packages` 항목 대조 → *설치본 = lockfile resolved*. ①②는 이미 서로 비순환이고(①은 설치본에, ②는 package.json에 앵커), ③은 **세 번째 독립 기준점(lockfile)**을 더한다 — ①②는 어느 쪽이든 설치 트리를 읽으므로 lockfile 드리프트를 못 본다. **정확 핀 이후 ③이 단독으로 잡는 건** lockfile이 매니페스트와 어긋났는데 설치본은 매니페스트와 일치하는 경우 — 재설치 없이 lockfile만 손댄 상태다. 다른 버전이 설치돼 있으면 이제 ②도 함께 걸린다(허용 집합이 핀된 한 버전뿐이라). 캐럿이던 시절엔 ③의 니치가 더 넓었고 이 테스트도 그 모양을 겨냥해 쓰였다 — main이 `^1.2.0`인 채 트리엔 다른 브랜치에서 설치한 1.3.0이 있으면 `satisfies("1.3.0", "^1.2.0")`가 true라 ②는 통과하고 ③만 걸렸다. 핀이 그 니치를 좁혔을 뿐 **node_modules가 브랜치 전환으로 어긋나는 것 자체는 그대로다**(git이 node_modules를 관리하지 않으므로). (#62는 그런 드리프트가 실제로 일어난다는 방증이지 ③의 사례는 아니다 — #62는 range를 `^1.2.0`으로 올렸고 1.0.0은 이를 만족하지 못하므로 ②가 잡는다. 그리고 **머지된 코드가 미검증이었던 것도 아니다**: #62의 CI는 `--frozen-lockfile`로 설치해 통과했으니 1.2.0 계약은 제대로 검증됐고, 어긋난 건 로컬 실행을 근거로 PR 본문에 쓴 문장이다.) 파싱 관련 실측 메모: `bun.lock`은 trailing comma JSONC라 `JSON.parse`·`Bun.file().json()`이 **둘 다 실패**하지만 bun 모듈 로더는 파싱하므로 수제 파서가 필요 없다(형식이 바뀌면 시끄럽게 깨지는데, 그게 원하는 실패 방식이다). `bun list`는 node_modules가 아니라 lockfile을 읽으므로 이 대조엔 쓸모없고, `bun install --frozen-lockfile --dry-run`은 이 드리프트를 감지하지 못한다(exit 0) — `--frozen-lockfile`은 lockfile↔package.json만 본다
- **diffdeck은 캐럿 없이 정확 핀한다**(`"@say8425/diffdeck": "1.3.0"`). 배포 tarball은 `files: ["dist/index.js"]`라 lockfile을 담지 않으므로, 배포된 `dependencies`가 곧 사용자 `bunx`의 resolve 기준이다 — 핀은 사용자에게 그대로 전파되고, 그래서 **CI가 계약을 검증한 바로 그 버전이 사용자 머신에서 돈다** — 단 bunx 캐시가 새로 채워지는 시점부터다(위의 캐시 항목 참고: 릴리스가 살아 있는 캐시를 자동으로 갱신하지 않는다). 캐럿이던 시절엔 이 둘이 구조적으로 어긋났다(배포된 5.0.0의 `^1.2.0` → 사용자는 1.3.0을 받았다). 핀하는 이유는 이 wire contract가 diffdeck 입장에선 내부 구현이라 **semver가 보호해주지 않기** 때문이다: `ensure.ts`의 `probeServer` 주석이 기록하듯 pre-0.2.2 diffdeck은 버전 헤더를 아예 보내지 않았는데, 0.2.2는 **패치** 릴리스였다(0.x라 semver가 원래 약속하지 않는 구간이긴 하다 — 다만 근거의 핵심은 버전 번호가 아니라 이 wire contract가 diffdeck 입장에선 내부 구현이라는 점이므로 1.x에서도 보호받지 못한다). 게다가 `maybeSpawn`이 fire-and-forget이라 깨져도 조용하다. (`probeServer`가 아직 인식하는 `x-cc-statusline` 마커는 diffdeck의 변경이 아니라 이 저장소가 뷰어를 분리하며 남긴 자기 흔적이니, 상류 드리프트의 근거로 쓰지 말 것.)
- **핀의 대가와 범프 절차**: diffdeck 버그픽스가 자동으로 흘러오지 않으므로 **cc-statusline 릴리스를 거쳐야 사용자에게 닿는다**. 범프를 시작시키는 건 **Dependabot**이다(`.github/dependabot.yml`, cron으로 매일 09시 KST, diffdeck만 감시 — `daily`는 평일만 돌아 주말 릴리스를 놓치므로 일부러 cron이다). **`cooldown: default-days: 0`이 필수다**: 명시하지 않으면 GitHub이 기본 3일 cooldown을 걸어 갓 나온 버전을 건너뛴다. 실제로 겪었다 — 1.3.1 배포 10시간 뒤 job이 돌았는데 `Filtered out 2 versions due to cooldown` / `Latest version is 1.2.0`으로 끝나 PR이 안 열렸고, **job은 success라 실패 흔적이 어디에도 없었다**. 릴리스가 났는데 PR이 안 보이면 Actions의 `Dependabot Updates` 워크플로 로그부터 볼 것(`gh run view <id> --log`) — 그 사례가 [run 30773993483](https://github.com/say8425/cc-statusline/actions/runs/30773993483)이고, 옵션 전체는 [Dependabot options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)에 있다 — 핀 때문에 저절로 올라오지 않는 걸 대신 발견해 `fix(deps):` PR을 연다(그 prefix라야 release-please가 patch를 낸다). 그 PR에서 사람이 할 일은 ① diffdeck 릴리스 노트를 읽고 뷰어 외 변경(CLI 플래그·핑 헤더·토큰 경로·`bin` 경로)이 있는지 보고, ② 있으면 계약을 손으로 확인하는 것이다. `package.json`·`bun.lock` 갱신은 Dependabot이 이미 해 둔다. **기계가 대신 해 주는 부분**: PR CI가 `--frozen-lockfile`로 새 버전을 설치한 뒤 `diff-contract.test.ts`를 돌리므로, 계약이 깨졌으면 초록이 아니라 빨강으로 드러난다(정확 핀이라 ②층 range 단언은 `satisfies("1.3.0", "1.3.0")`으로 통과하고, 다른 버전이 설치돼 있으면 걸린다). 다만 **뷰어 UX 변경은 테스트가 못 보므로** ①은 여전히 사람 몫이다. **range-max를 CI에서 설치하는 테스트는 만들지 않는다** — 네트워크 의존적·비결정적이라 이 저장소와 무관한 diffdeck 릴리스가 PR을 막는다. 핀 이후로는 range-max라는 개념 자체가 없어져 이 논거가 더 분명해졌다
