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
│   │   ├── pr.ts                   # getPrUrlCached
│   │   └── worktree.ts             # getMainProjectNameCached
│   ├── diff-server/
│   │   ├── config.ts               # getCacheDir, resolveDiffPort, isDiffViewerDisabled
│   │   ├── link.ts                 # buildDiffViewerUrl
│   │   ├── token.ts                # ensureToken, readTokenSync
│   │   ├── diff.ts                 # getDiffFiles, getFileBytes, isGitRepo
│   │   ├── imageTypes.ts           # isImagePath, imageContentType (이미지 확장자·MIME)
│   │   ├── server.ts               # startDiffServer (로컬 diff 뷰어 HTTP 서버, /api/diff·/api/blob)
│   │   └── ensure.ts               # ensureDiffServer (spawn-if-not-running 데몬)
│   ├── viewer/
│   │   ├── main.ts                 # 뷰어 프론트엔드 엔트리포인트
│   │   ├── index.html              # 뷰어 HTML 셸
│   │   ├── imageDiff.ts            # imageEntries/blobUrl (이미지 diff 순수 헬퍼)
│   │   ├── imageCard.ts            # 인라인 Old/New 카드 shadow DOM 주입 (ensureImageCard)
│   │   ├── fileOrder.ts            # sortFilesLikeTree (트리 comparator 복제)
│   │   └── search/
│   │       ├── highlight.ts        # 순수 하이라이트 유틸 (텍스트 → 매치 구간)
│   │       ├── searchIndex.ts      # buildRows/findMatches (SearchMatch, 삭제 줄 포함 검색)
│   │       ├── findBar.ts          # find bar 컨트롤러 (입력·키보드·카운트·이동)
│   │       └── highlightDom.ts     # DOM에 노랑/주황 mark 적용
│   └── __tests__/                  # 테스트 파일
│       ├── pure.test.ts            # 순수 함수 테스트
│       ├── cached.test.ts          # 캐시 메커니즘 테스트
│       ├── main.test.ts            # renderStatusLine 테스트
│       ├── async.test.ts           # 비동기 함수 통합 테스트
│       ├── integration.test.ts     # main 함수 통합 테스트
│       ├── stdin.test.ts           # readStdin 테스트
│       ├── ultracode.test.ts       # ultracode settings 경로·우선순위·캐시 테스트
│       ├── diff-config.test.ts     # diff-server/config 테스트
│       ├── diff-token.test.ts      # diff-server/token 테스트
│       ├── diff-command.test.ts    # diff-server/diff 테스트
│       ├── diff-server.test.ts     # diff-server/server 테스트 (403 경로 탐색 포함)
│       ├── diff-ensure.test.ts     # diff-server/ensure 테스트
│       ├── diff-link.test.ts       # diff-server/link 테스트
│       ├── viewer-image-diff.test.ts   # imageTypes + viewer/imageDiff 테스트
│       ├── viewer-file-order.test.ts   # fileOrder(트리 동일 정렬) 테스트
│       ├── map-limit.test.ts       # mapWithLimit 동시성 테스트
│       ├── viewer-highlight.test.ts    # search/highlight 테스트
│       └── viewer-search-index.test.ts # search/searchIndex 테스트
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
| Ultracode 여부 | settings 파일 `ultracode` 키 (local → project → user 순, stdin엔 미노출) |
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
- 현재 사용 중인 모델명·reasoning effort (`🤖 Fable 5 high`, 🧠 컨텍스트 세그먼트 오른쪽) — ultracode가 켜져 있으면 `⚡ultra` 배지 추가 (`🤖 Fable 5 xhigh ⚡ultra`)
- Git diff 통계 (파일 수, +insertions, -deletions)
- 클릭 가능한 diff 뷰어: `✏️` 클릭 시 로컬 diff 뷰어(Pierre `@pierre/diffs`+`@pierre/trees`)를 `127.0.0.1:49573`에 띄워 브라우저로 표시
- diff 뷰어 Watch 토글: 켜면 ~2초 폴링으로 변경을 감지해 스크롤 유지한 채 자동 갱신 (localStorage에 상태 저장)
- diff 뷰어 모드 전환: `Working tree`(HEAD 대비) / `vs <base>`(PR 타겟 또는 기본 브랜치 대비, merge-base vs 워킹트리) — 커밋해도 base 모드에선 변경이 유지됨 (base는 `gh pr view`→`origin/HEAD`→main/master로 결정, X-Diff-Base 헤더)
- `✏️` 진입점 유지: working 변경이 없어도 브랜치가 base보다 앞서면 `✏️ vs <base> N files +X -Y`로 표시되고 클릭 시 뷰어가 base 모드로 열림 (URL `mode` 파라미터가 localStorage보다 우선) — 커밋 후에도 진입점 유지
- diff 뷰어 chrome은 Pierre 다크 팔레트(#141415/#adadb1/#070707, accent #009fff)로 통일 (툴바·드롭다운·버튼·토글 스위치; 뷰어는 다크 전용이라 다크 값 하드코딩). 오버플로 메뉴의 체크박스는 pill 토글 스위치로 커스텀(appearance:none + ::before 노브, 라벨 좌/스위치 우) — 네이티브 input이라 키보드·focus-visible 유지
- diff 뷰어 툴바는 좌(모드·Unified/Split·Refresh)/우(상태·검색·⋯ 오버플로) 클러스터로 정렬; 저중요 컨트롤(Include untracked·Watch·Flatten·파일트리 좌/우)은 `⋯` 오버플로 메뉴에 위치. Unified/Split은 Pierre식 세그먼트 그룹(`.tb-seg`, `aria-pressed`가 CSS 활성 조각(#2a2a2c)과 접근성 겸용)으로 현재 모드가 항상 표시되고, Refresh는 아이콘 버튼(인라인 rotate-cw SVG, aria-label 유지). 검색(`#find-open`, 돋보기 아이콘)은 클릭 시 find bar를 여는(=Cmd/Ctrl+F) 발견성 버튼 — find bar가 열려 있는 동안 `:has()` CSS로 숨김
- 파일트리 좌/우 배치(`data-tree-side`, localStorage `cc-statusline:tree-side`, 기본 left)와 flatten(빈 디렉터리 접기, localStorage `cc-statusline:flatten`, 기본 on)은 토글 가능; flatten 변경 시 FileTree 재생성. 파일트리 상단 padding은 diff의 8px(`--diffs-gap-fallback`)와 일치
- diff 뷰어 파일 폴딩: 파일 헤더 바 전체(파일명·stats·chevron ▾/▸)를 클릭해 접기/펼치기 (diffMount의 composedPath 위임: `data-diffs-header` 경로면 헤더 클릭, 감싼 `<diffs-container>`의 `[data-fold]`로 파일 id → CodeView.updateItem, 세션 인메모리 collapsedIds). 드래그(pointerdown 대비 이동 > 6px)나 텍스트 선택 시엔 토글 안 함(bad UX 방지, src/viewer/drag.ts). 헤더는 `unsafeCSS`로 pointer 커서 + hover 배경(rgba(255,255,255,.05), .15s). fold chevron(SVG ▾/▸)은 파일별 버튼 노드를 `foldButtons` Map으로 재사용해 토글 시 `transform .15s` 회전 트윈이 실제 재생됨(새 노드 생성 시 트윈 불가; teardownViews에서 clear)
- diff 뷰어 파일명 복사: 각 파일 헤더의 파일명 바로 옆(shadow DOM `[data-title]` 뒤, onPostRender로 멱등 주입) 복사 아이콘 — 클릭 시 전체 상대경로를 클립보드에 복사(체크마크 피드백), 헤더 hover 시 노출. 클릭은 stopPropagation으로 폴드와 분리(src/viewer/copyButton.ts)
- 대용량 파일 기본 접힘: 락파일(pnpm-lock.yaml 등) 또는 변경 줄 수 > 1500이면 첫 렌더 시 접힘(seenIds로 1회성 → 펼치면 유지). 판정은 src/viewer/largeFile.ts
- diff 데이터: diff-server가 패치 대신 파일별 old/new 전체 내용을 JSON으로 제공(`getDiffFiles`: `git diff --name-status` + `git show <base>:path`/워킹트리 읽기, 바이너리는 NUL 감지로 표식). viewer는 `parseDiffFromFile`로 파싱 → non-partial diff라 @pierre/diffs가 미변경 구간을 `collapsedContextThreshold:3`로 접고 `hunkSeparators:"line-info"`+`expansionLineCount:10`의 내장 expand 캐럿으로 실제 노출(파일별 old/new가 있어야 expand 가능 — patch=partial은 불가). 바이너리 파일은 트리 + 인라인 이미지 카드에 표시(비이미지 바이너리는 트리만)
- 이미지 diff: 바이너리 이미지(png/jpg/gif/webp/avif/bmp/ico, SVG는 텍스트 diff 유지)는 **diff 흐름에 인라인**으로 표시 — CodeView가 diff/file 아이템만 지원하므로 이미지 파일마다 빈 `parseDiffFromFile` diff 아이템(헤더·폴드·트리 scrollTo 제공)을 만들고, `onPostRender`에서 shadow DOM 헤더 뒤에 체커보드 배경 Old/New 카드를 주입(src/viewer/imageCard.ts의 ensureImageCard; 멱등 — blobVersion 같으면 no-op, 바뀌면 교체, 접히면 제거; 카드 CSS는 unsafeCSS로 shadow에 주입; "-0 +0" 스탯 숨김, 상태 아이콘은 스프라이트에 심볼 있을 때만 A/D로 교체). 데이터는 `/api/blob?path&side=old|new&mode`(토큰 보호, **이미지 경로 전용** — 빈 경로·비이미지·repo 밖 경로는 404, side old는 HEAD 또는 merge-base의 `git show`). `DiffFile.blobVersion`(바이트 해시, 바이너리 전용)이 watch 폴링의 JSON 비교로 바이너리 변경을 감지시키고 blob URL 캐시버스터(`v`)로 쓰임. 상태별 사이드: A/untracked→New만, D→Old만
- diff 아이템 순서는 사이드바 트리와 동일: `sortFilesLikeTree`(src/viewer/fileOrder.ts)가 @pierre/trees comparator(디렉터리 우선 + 대소문자 무시 자연 정렬)를 복제해 renderPatch 진입 시 파일 배열을 정렬 — git diff 출력 순서(+untracked 뒤 덧붙임)를 그대로 쓰면 트리와 어긋난다
- getDiffFiles의 파일별 buildFile(git show/워킹트리 읽기)은 `mapWithLimit`(src/diff-server/mapLimit.ts)로 동시성 8 제한 병렬 실행 — 대형 diff + watch 폴링에서 git 서브프로세스 폭증 방지 (순서 보존)
- diff 뷰어 in-app find bar (Cmd/Ctrl+F): diff 내용(삭제 줄 포함) 검색, 매치 순회(n/N, ↑↓/Enter), 전체 노랑·현재 주황 하이라이트, 접힌 context/대용량 파일 자동 노출(닫기/검색어 비움 시 원상복구)
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
- ultracode 여부는 stdin JSON·env에 세션 단위로 노출되지 않음 (`effort.level`은 ultracode여도 `xhigh`로만 보고, CLI 2.1.201에서 실측 확인). 따라서 `src/ultracode.ts`가 Claude Code settings 파일(`<project>/.claude/settings.local.json` → `<project>/.claude/settings.json` → `~/.claude/settings.json`)의 `ultracode` boolean 키를 직접 읽는다 (5초 TTL 캐시, 읽기는 병렬·판정은 우선순위 순). 공식 스키마에 ultracode 필드가 추가되면 stdin 우선으로 전환할 것
- diff 뷰어 데몬은 statusline이 spawn-if-not-running으로 관리 (env `CC_STATUSLINE_DIFF_PORT` 기본 49573, `CC_STATUSLINE_DIFF_DISABLE=1`로 비활성)
- diff 뷰어 데몬은 statusline 종속: statusline이 `repo && (hasChanges || baseChanges)`일 때만 spawn-if-not-running. **유휴 종료 없음**(`index.ts`에서 `idleTimeoutMs` 미전달) → 한번 뜨면 재부팅/수동 종료 전까지 상주해 작업 중 안 죽음. 부팅 자동시작은 없어 재부팅 시엔 죽고 다음 statusline tick(~5초, `ENSURE_TTL`)에 respawn. 따라서 뷰어는 북마크 URL 대신 statusline의 `✏️` 링크로 여는 것을 권장(✏️는 클릭 직전 데몬 ensure + 현재 토큰 포함). 토큰은 `~/.cache/cc-statusline/diff-server.token`에 영속되어 재부팅에도 유효(캐시 삭제 시 옛 북마크는 403). 지속 데몬(launchd 등)은 의도적으로 미도입 — 본 기능이 statusline 종속이라. (`server.ts`의 옵션 idle 기능은 남아있고 테스트만 `idleTimeoutMs:0`으로 사용)
- Pierre 컴포넌트는 devDependency이며 `build.ts`가 `dist/viewer/`로 프리번들 (런타임 `dist/index.js`엔 미포함)
