# 클릭 가능한 로컬 diff 뷰어 설계

- 날짜: 2026-07-01
- 상태: 설계 승인됨, 스펙 리뷰 대기
- 대상 저장소: `@say8425/cc-statusline`

## 1. 목표

statusline의 `✏️ N files +X -Y` 부분을 클릭하면, Pierre의 오픈소스 컴포넌트
(`@pierre/diffs` + `@pierre/trees`, diffshub.com을 구성하는 라이브러리)로 만든
**로컬 diff 뷰어**가 브라우저에서 열리도록 한다. 뷰어는 파일 트리 사이드바 +
diff 패널을 조합해, 현재 저장소의 uncommitted 변경사항을 보여준다.

## 2. 핵심 제약과 그로부터 도출되는 아키텍처

1. **OSC 8 하이퍼링크는 URL을 "열" 뿐, 명령을 실행하지 못한다.**
   따라서 클릭 시점에 뷰어를 서빙하는 HTTP 서버가 **이미 떠 있어야** 한다.
2. **statusline은 ~300ms마다 실행되는 무상태(stateless) 프로세스다.**
   서버를 statusline 프로세스 안에서 유지할 수 없다 → 별도의 **백그라운드 데몬**이
   필요하고, statusline은 매 틱마다 "없으면 띄우는(spawn-if-not-running)" 역할을 한다.
3. **성능이 중요하다(300ms).** 데몬 ensure 로직은 캐시 TTL로 게이팅하고
   fire-and-forget으로 실행해 렌더링을 절대 블로킹하지 않는다.
4. **프라이버시.** 코드는 절대 외부로 나가지 않는다. 데몬은 `127.0.0.1`에만 바인딩하고,
   Pierre/Shiki는 완전히 로컬에서 동작한다(오프라인).

결론: **OSC 8 링크 → 로컬 데몬(`Bun.serve`, `127.0.0.1:49573`) → 프리번들 Pierre 뷰어**.

## 3. 결정된 선택지

| 항목 | 결정 |
|------|------|
| 번들 분배 | **A: 빌드 시 프리번들.** Pierre는 devDependency로만. `build.ts`가 `dist/viewer/`(html+js)를 생성. 런타임엔 정적 파일 + `/api/diff`만 서빙. 완전 오프라인, 클릭 시 네트워크 0. |
| diff 범위 | **기본 `git diff HEAD`** (staged+unstaged 추적 변경 — `✏️` 카운트와 일치). 뷰어에 **untracked 포함 토글** 제공. |
| 데몬 포트 | 기본 **49573** (dynamic/private 대역). `CC_STATUSLINE_DIFF_PORT`로 오버라이드. |
| 프론트 프레임워크 | **Pierre 바닐라 JS API** 사용(React 런타임 불필요). |
| 킬 스위치 | `CC_STATUSLINE_DIFF_DISABLE=1`이면 기능 전체 비활성(링크 미표시, 데몬 미기동). |

## 4. Pierre 컴포넌트 사용 (리서치 확정 사실)

- `@pierre/diffs` v1.2.12 (Apache-2.0, stable, ESM-only). 바닐라 API로 React 불필요.
  - `parsePatchFiles(gitDiffString): ParsedPatch[]` — raw `git diff` 문자열을 그대로 파싱.
    각 `ParsedPatch = { patchMetadata?, files: FileDiffMetadata[] }`.
  - `FileDiffMetadata.name` = 파일 경로, `.type` ∈ `new|deleted|change|rename-pure|rename-changed`.
  - `CodeView` — 가상화된 멀티파일 스크롤러. `CodeViewItem[]`(`{id, type:'diff', fileDiff}`)을
    받아 렌더, `CodeViewHandle`로 특정 파일/라인으로 스크롤.
  - Shiki 하이라이팅 로컬 내장. 워커 풀은 v1에서 비활성(`disableWorkerPool`)해 단순화.
- `@pierre/trees` v1.0.0-beta.5 (Apache-2.0, beta, Shadow DOM).
  - `new FileTree({ paths, gitStatus, search })` → `.render({ containerWrapper })`,
    `.setGitStatus([{path,status}])`. `status` ∈ `added|deleted|modified|renamed|untracked|ignored`.
  - 선택은 **경로 문자열** 기준. 모델 구독으로 선택 변경 감지 → 해당 경로를 CodeView로 스크롤.
- 조합 방식은 diffshub 본체(`apps/diffshub`)와 동일. 실동작 선례: `oorestisime/opencode-diffs`.

**타입 → gitStatus 매핑** (파싱 결과에서 트리를 만들 때):

| `FileDiffMetadata.type` | 트리 `status` |
|---|---|
| `new` | `added` |
| `deleted` | `deleted` |
| `change` | `modified` |
| `rename-pure` / `rename-changed` | `renamed` |
| (untracked 합성 diff) | `untracked` |

## 5. 컴포넌트 구성

```
src/
├── index.ts                 # (수정) 데몬 ensure 호출 + --diff-server 서브커맨드 분기
├── render.ts                # (수정) ✏️ 텍스트를 OSC 8 링크로 감쌈
├── types.ts                 # (수정) RenderContext에 diffViewerUrl 추가
├── diff-server/
│   ├── ensure.ts            # spawn-if-not-running 가드 (statusline 측)
│   ├── server.ts            # Bun.serve 데몬 본체
│   ├── diff.ts              # git diff HEAD (+ untracked) 실행 → raw 문자열
│   ├── token.ts             # 세션 토큰 생성/읽기, 파일 경로 헬퍼
│   └── link.ts              # OSC 8 URL 빌더 (순수 함수, 테스트 대상)
└── viewer/
    └── main.ts              # 브라우저 진입점: fetch → parsePatchFiles → trees + CodeView

dist/
├── index.js                 # (기존) 번들된 statusline + 데몬
└── viewer/                  # (신규) build.ts가 생성하는 프리번들 뷰어
    ├── index.html
    └── main.js              # @pierre/diffs + @pierre/trees + Shiki 포함
```

### 5.1 `render.ts` (수정)

- `RenderContext`에 `diffViewerUrl: string | null` 추가.
- `hasGitChanges && ctx.diffViewerUrl`일 때 `✏️ N files +X -Y` 텍스트를
  OSC 8 링크로 감싼다 (PR 링크가 `render.ts:105`에서 쓰는 것과 동일한 방식):
  ```
  `\x1b]8;;${ctx.diffViewerUrl}\x07✏️ ${files} files +${ins} -${del}\x1b]8;;\x07`
  ```
- 링크가 없으면(기능 비활성/데몬 정보 없음) 기존처럼 평문 표시. **render는 순수 함수 유지.**

### 5.2 `diff-server/link.ts` (순수 함수)

- `buildDiffViewerUrl({ port, repo, token }): string`
  → `http://127.0.0.1:${port}/?repo=${encodeURIComponent(repo)}&token=${token}`
- 순수 함수라 단위 테스트 용이.

### 5.3 `diff-server/token.ts`

- 캐시 디렉터리: `${XDG_CACHE_HOME:-~/.cache}/cc-statusline/`.
- `diff-server.token` — 데몬 시작 시 `crypto.randomUUID()` 등으로 생성해 기록.
  statusline은 이 파일을 읽어 링크에 포함. 데몬 재시작 시 회전.
- `diff-server.lock` — spawn 스탬피드 방지용 락파일.
- 헬퍼: `getCacheDir()`, `readToken()`, `writeToken()`.

### 5.4 `diff-server/ensure.ts` (statusline 측)

매 틱 호출되지만 실제 작업은 캐시 TTL로 게이팅한다.

1. `CC_STATUSLINE_DIFF_DISABLE=1`이면 즉시 `null` 반환(링크 없음).
2. git 변경이 없으면 아무것도 안 함(링크 없음).
3. 캐시 TTL(~5초) 내 "ensured"면 캐시된 `{port, token}` 반환.
4. 포트 프로브(`127.0.0.1:port`에 짧은 타임아웃 connect):
   - 살아있으면 토큰 읽어 `{port, token}` 캐시 후 반환.
   - 죽어있으면 **락 획득 시도**(원자적) → 성공 시 데몬을 detached spawn
     (`Bun.spawn([process.execPath, selfPath, "--diff-server"], { stdio: 무시 })` + `proc.unref()`),
     실패 시(다른 틱이 이미 spawn 중) 스킵.
5. **fire-and-forget**: 이 함수는 렌더링을 블로킹하지 않는다. spawn 직후 데몬이 아직
   포트를 못 잡았어도, 링크는 방출된다. 사용자가 클릭할 때쯤엔 떠 있음(다음 틱들에서 확정).

**3중 가드로 중복 spawn 방지**: (a) 캐시 TTL 게이팅, (b) 원자적 락파일,
(c) 데몬이 포트를 배타적으로 바인딩(이미 점유면 즉시 종료).

### 5.5 `diff-server/server.ts` (데몬)

- `Bun.serve({ hostname: "127.0.0.1", port })`. 포트 점유 실패 시 즉시 종료(중복 데몬 방지).
- 시작 시 토큰 생성/기록. 종료 시 토큰·락 파일 정리.
- 라우트:
  | 경로 | 동작 |
  |------|------|
  | `GET /` | `dist/viewer/index.html` 서빙 (토큰 불필요 — 정적 셸) |
  | `GET /assets/*` · `GET /main.js` | 프리번들 뷰어 자산 |
  | `GET /api/diff?repo=&token=&untracked=` | 토큰 검증 → `repo`가 실제 git 저장소인지 검증 → `git diff HEAD` (+옵션 untracked) → raw diff 문자열(text/plain) 반환 |
- **멀티 레포**: `?repo=<abs>`로 구분. 데몬 1개가 모든 저장소를 서빙.
- **유휴 자동 종료**: 마지막 요청 시각을 추적, 1분마다 검사해 15분 유휴면 `process.exit(0)`.

### 5.6 `diff-server/diff.ts`

- `git -C <repo> diff HEAD --no-color` 실행 → 추적 파일의 staged+unstaged 변경.
- `untracked=1`이면: `git -C <repo> ls-files --others --exclude-standard`로 untracked 목록을
  얻고, 각 파일을 `git -C <repo> diff --no-index --no-color /dev/null <file>`로 합성 diff 생성,
  본 diff 뒤에 이어붙여 하나의 patch 문자열로 만든다.
- 저장소가 아니거나 에러면 빈 문자열/명확한 에러 응답.

### 5.7 `viewer/main.ts` (브라우저 진입점, 프리번들)

1. `location.search`에서 `repo`, `token` 파싱.
2. `/api/diff?repo=&token=&untracked=<toggle>` fetch → raw diff 문자열.
3. `parsePatchFiles(diff)` → `ParsedPatch[]`.
4. `paths` + `gitStatus`(4절 매핑)를 만들어 `@pierre/trees` `FileTree` 렌더(사이드바).
5. `CodeViewItem[]`(`{id, type:'diff', fileDiff}`)을 만들어 `@pierre/diffs` `CodeView` 렌더(패널).
6. 트리 선택(경로) 변경 구독 → `CodeViewHandle`로 해당 파일 스크롤.
7. 컨트롤: **split/unified 토글**, **untracked 포함 토글**(재fetch), **refresh** 버튼,
   창 포커스 시 재fetch. 기본 다크 테마.
- Shiki는 JS regex 엔진 사용(WASM 로딩 회피)으로 오프라인 정적 서빙을 단순화(구현 시 확정).

### 5.8 `build.ts` (수정)

- 기존 `dist/index.js` 번들 유지.
- 추가로 `src/viewer/main.ts`를 `Bun.build`로 `dist/viewer/main.js`에 번들
  (`@pierre/diffs`, `@pierre/trees`, Shiki 포함, `target: "browser"`).
- `dist/viewer/index.html` 생성/복사.
- `package.json` `files`에 `dist/viewer` 추가, `@pierre/diffs`·`@pierre/trees`를 devDependencies 추가.

## 6. 데이터 흐름

```
[터미널] ✏️ 3 files +86 -3  ── 클릭 ──▶ http://127.0.0.1:49573/?repo=/abs&token=T
                                              │
                              [데몬] GET / ──▶ dist/viewer/index.html + main.js
                                              │
              [뷰어] fetch /api/diff?repo&token&untracked ──▶ [데몬] git diff HEAD (+untracked)
                                              │◀── raw diff 문자열
              parsePatchFiles ─▶ FileTree(사이드바) + CodeView(패널), 경로로 연결
```

statusline 측(매 틱):
```
git 변경 감지 ─▶ ensureDiffServer() (캐시 TTL 게이팅, fire-and-forget)
             ─▶ {port, token} ─▶ buildDiffViewerUrl ─▶ RenderContext.diffViewerUrl
             ─▶ render.ts가 ✏️ 를 OSC 8로 감쌈
```

## 7. 보안

localhost 서버의 실제 위험: 브라우저에 열린 임의 웹사이트가
`fetch('http://127.0.0.1:49573/api/diff?...')`로 로컬 코드를 읽으려 시도할 수 있다.

- **① 127.0.0.1 전용 바인딩** — 외부 네트워크 노출 없음.
- **② 세션 토큰** — `/api/diff`는 `token`이 데몬의 토큰과 일치해야 응답. 토큰은
  OSC 8 링크(터미널)에만 존재. 임의 사이트는 토큰을 모름 → 403.
- **③ permissive CORS 헤더 절대 미설정** — 교차 출처 사이트는 응답 본문을 읽을 수 없음
  (브라우저 CORS 기본 차단). `Access-Control-Allow-Origin: *` 같은 헤더 금지.
- **④ repo 검증** — `?repo=`가 실제 존재하는 git 워크트리인지 확인 후에만 git 실행.
- git은 읽기 전용(`diff`)만 실행. 쓰기/체크아웃 등 부작용 명령 없음.

## 8. 에러 처리 / 폴백

- OSC 8 미지원 터미널: 링크 없이 평문 표시(PR 링크와 동일 전제, 기존 동작).
- 데몬 spawn 실패/포트 점유 불가: 링크는 방출되나 클릭 시 브라우저 연결 실패
  — 기능 실패가 statusline 렌더를 깨지 않음(fire-and-forget).
- `git diff` 실패/비저장소: 뷰어에 "변경 없음/에러" 표시, 데몬은 계속 동작.
- `CC_STATUSLINE_DIFF_DISABLE=1`: 기능 전체 우회.

## 9. 테스트 전략

프로젝트 관례(bun test, 함수 100% 지향) 유지. 테스트 대상:

- **순수/로직 단위 테스트**:
  - `link.ts` `buildDiffViewerUrl` — URL 인코딩/형식.
  - `diff.ts` 명령 빌더 — `untracked` on/off 시 실행 명령/합성 로직.
  - 타입→gitStatus 매핑 함수.
  - `token.ts` 생성/읽기 — 임시 디렉터리.
  - `ensure.ts` 락 획득/캐시 게이팅 — 임시 디렉터리/모킹.
- **데몬 통합 테스트**: 임시 포트로 `Bun.serve` 기동 →
  `/api/diff` 토큰 유/무 → 200/403, permissive CORS 헤더 부재 확인, 비저장소 처리.
- **render 테스트**: `main.test.ts`에 `diffViewerUrl` 유/무 시 OSC 8 래핑 케이스 추가.
- **뷰어(브라우저 DOM/Shadow DOM)**: 단위 테스트 범위 밖. 수동 검증 계획으로 커버
  (실제 저장소에서 클릭 → 트리+diff 렌더 → 파일 선택 스크롤 → untracked 토글).

## 10. 범위 밖 (YAGNI)

- 주석/코멘트, 인라인 편집, 머지 컨플릭트 UI, 에디터로 파일 열기.
- 커밋/브랜치 vs base 비교(이번엔 uncommitted에 집중; 추후 확장 여지).
- 토큰 이상의 인증, HTTPS.
- Windows 특화 경로(프로젝트는 Bun/darwin·linux 중심).

## 11. 미해결/구현 시 확정할 사항

- Shiki 엔진(JS regex vs WASM)과 워커 풀 비활성 여부의 정확한 설정.
- `dist/viewer` 자산 경로 해석(`import.meta.dir` 기준) 및 `bunx` 캐시 경로에서의 동작 검증.
- 유휴 종료 타임아웃(15분) 미세조정.
