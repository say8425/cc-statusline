# Diff 뷰어 Watch Mode 설계

- 날짜: 2026-07-02
- 상태: 설계 승인됨
- 대상: `@say8425/cc-statusline` diff 뷰어 (PR #48 브랜치에 이어서)

## 1. 목표

diff 뷰어 웹페이지에 **Watch 토글**을 추가한다. ON이면 repo 변경을 감지해 diff를
자동 갱신하되 **스크롤/보던 위치를 유지**한다. OFF면 자동 갱신을 중단한다.

## 2. 범위

- **클라이언트(뷰어) 전용**: `src/viewer/main.ts` + `src/viewer/index.html`만 변경.
- **서버/데몬/토큰/보안 표면 변경 없음** — 기존 `/api/diff` 엔드포인트를 그대로 폴링한다.
- 새 서버 코드가 없으므로 새 서버 테스트 불필요. 뷰어는 브라우저 전용이라 수동 검증.

## 3. 결정된 선택지

| 항목 | 결정 |
|------|------|
| 변경 감지 | **클라이언트 폴링 + 변경감지** (SSE 아님) |
| 갱신 방식 | **In-place 갱신(스크롤 보존)** — 인스턴스 재사용 |
| 폴링 간격 | **2초** (상수, 조정 용이) |
| 토글 지속성 | `localStorage`에 ON/OFF 저장 → 새로고침 후 복원 |
| 백그라운드 탭 | `document.hidden`이면 폴링 skip (복귀 시 기존 focus 리스너가 따라잡음) |
| 기본 상태 | **OFF** |

## 4. 동작

### 4.1 폴링 루프 + 변경감지
- Watch ON → `setInterval(2000ms)`로 `/api/diff`(현재 `diffStyle`·`includeUntracked`
  파라미터 그대로) fetch.
- fetch한 raw patch 문자열을 직전 `lastPatch`와 비교 → **다를 때만** 재렌더.
  같으면 아무 것도 안 함(idle 시 플리커/불필요 재렌더 없음).
- `document.hidden`이면 이번 틱 skip.
- Watch OFF → `clearInterval` + 타이머 참조 정리.

### 4.2 In-place 갱신 (스크롤 보존)
`renderFiles`를 리팩터해, 인스턴스가 이미 있으면 **재사용**한다:
- **CodeView**: 최초 1회만 `new CodeView(...)` + `setup(diffMount)`. 이후 갱신은
  같은 인스턴스에 `setItems(newItems)`(reconcile로 스크롤 보존). 안전장치로
  갱신 직전 `getScrollTop()`을 저장했다가 `scrollTo({ type: "position", position })`로 복원.
- **FileTree**: 최초 1회만 `new FileTree(...)` + `render(...)`. 이후 갱신은 같은
  인스턴스에 `resetPaths(newPaths)` + `setGitStatus(newStatus)`로 파일 목록/상태 반영.
- **구조 전환 처리**: "빈 diff(No changes)" ↔ "내용 있음" 전환 시 인스턴스를
  적절히 생성/폐기(`cleanUp`)한다. `diffStyle` 변경(unified↔split)은 CodeView
  옵션 변경이 필요하므로 인스턴스를 재생성한다.
- **부수 효과(개선)**: 기존 수동 Refresh·창 포커스·untracked 토글도 같은 경로를
  타므로 모두 스크롤을 보존하게 되어 부드러워진다.

### 4.3 토글 UI + 지속성
- 툴바(`index.html`)에 `Refresh` 옆으로 `☐ Watch` 체크박스 추가. 기본 OFF.
- 상태를 `localStorage["cc-statusline:diff-watch"]`("1"/"0")에 저장.
- 페이지 로드 시 저장된 상태로 체크박스 복원. 복원값이 ON이면 폴링 시작.

## 5. 에러 처리
- 폴링 중 `/api/diff` 실패(네트워크/비ok): 루프를 멈추지 않고 다음 틱에 재시도,
  마지막으로 성공한 내용을 화면에 유지한다(에러로 화면을 덮지 않음).
- 데몬이 유휴 종료된 경우: 다음 사용자 상호작용/포커스로 재기동되며, 폴링은 실패를
  삼키고 계속 시도한다.

## 6. 수정 대상 파일
| 파일 | 변경 |
|------|------|
| `src/viewer/index.html` | 툴바에 Watch 체크박스 추가 |
| `src/viewer/main.ts` | in-place `renderFiles` 리팩터, 폴링/변경감지, 토글+localStorage, hidden 처리 |
| `build.ts` | 변경 없음 (기존 뷰어 번들에 포함됨) |

## 7. 테스트 전략
- 서버 변경 없음 → 기존 `bun test` 스위트 그대로 통과 유지(회귀 없음).
- 뷰어 로직은 브라우저 전용(DOM/Pierre)이라 단위 테스트 범위 밖. **수동 브라우저
  검증**으로 커버:
  1. Watch ON → 대상 repo의 파일을 저장 → ~2초 내 diff가 **스크롤 유지한 채** 갱신.
  2. 변경이 없을 때는 재렌더/플리커 없음.
  3. Watch OFF → 자동 갱신 중단.
  4. 새로고침 후 토글 상태(localStorage) 유지, ON이면 폴링 재개.
  5. 파일 추가/삭제 시 트리 목록·상태 갱신.
- 순수 로직으로 뽑을 수 있는 부분(예: patch 변경 여부 판정)이 있으면 작은 단위
  테스트를 추가할 수 있으나, 대부분 DOM 결합이라 필수는 아님.

## 8. 범위 밖 (YAGNI)
- 서버 SSE/파일시스템 watch.
- 사용자 조정 가능한 폴링 간격 UI (상수 2초로 고정).
- 스크롤을 라인 단위로 정밀 앵커링(변경으로 라인 수가 바뀌면 best-effort 위치 복원).
