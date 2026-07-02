# Diff 뷰어 "vs base 브랜치" 모드 설계

- 날짜: 2026-07-02
- 상태: 설계 승인됨
- 대상: `@say8425/cc-statusline` diff 뷰어 (PR #48 브랜치에 이어서)

## 1. 목표 / 동기

현재 뷰어는 워킹트리 diff(`git diff HEAD`)만 보여준다. **커밋하면 그 변경이 diff에서
사라져서** 브랜치 전체 변경을 보려면 GitHub PR diff로 가야 하는 불편이 있다.

**base 브랜치 대비 diff 모드**를 추가한다: 브랜치가 base에서 갈라진 이후의 모든 변경
(커밋된 것 + 아직 커밋 안 한 것)을 보여줘, 커밋해도 사라지지 않게 한다. base 브랜치는
**PR의 merge 타겟**(PR이 있으면), 없으면 **저장소 기본 브랜치**로 자동 결정한다.

## 2. 범위

- 서버(`src/diff-server/diff.ts`, `server.ts`)와 뷰어(`src/viewer/main.ts`, `index.html`) 모두 변경.
- base 결정에 `gh`(PR 타겟) + `git`(기본 브랜치)을 사용 — 기존 PR URL 기능과 동일한 도구.

## 3. 결정된 선택지

| 항목 | 결정 |
|------|------|
| vs base diff 범위 | **merge-base vs 워킹트리**: `git diff $(git merge-base <ref> HEAD)` (커밋+미커밋 모두) |
| base 브랜치 | PR 타겟(`gh pr view --json baseRefName`) → 없으면 기본 브랜치(`origin/HEAD`) |
| diff 기준 ref | `origin/<base>` 우선(있으면), 없으면 로컬 `<base>` |
| base 미해결 시 | "vs base" 옵션 비활성 + 힌트 |
| 모드 UI | 툴바 드롭다운 `Working tree` / `vs <base>` |
| 모드 지속성 | `localStorage`에 선택 저장 |
| 기본 모드 | `Working tree` (기존 동작) |

## 4. 동작

### 4.1 base 브랜치 결정 (`resolveBaseRef(repo)`, 데몬에서 캐시 ~10초/repo)
1. **PR 타겟**: `gh pr view --json baseRefName -q .baseRefName` (cwd=repo). 성공 시 그 이름.
2. **폴백 기본 브랜치**: `git -C <repo> rev-parse --abbrev-ref origin/HEAD` → `origin/main`에서
   `origin/` 제거 → `main`. 실패 시 `origin/main`·`origin/master` 존재 순서로 시도.
3. **diff 기준 ref 선택**: `git -C <repo> rev-parse --verify origin/<base>`가 성공하면
   `origin/<base>`, 아니면 로컬 `<base>`가 존재하면 `<base>`, 둘 다 없으면 `null`.
4. 결과: `{ base: string | null, ref: string | null }`. `ref`가 null이면 base 모드 불가.

### 4.2 diff 계산 (`/api/diff`에 `mode` 파라미터)
- `mode=working` (기본): 기존 `getDiff(repo, {untracked})` — `git diff HEAD` (+ untracked).
- `mode=base`:
  - `resolveBaseRef(repo)`로 `ref` 획득. `ref`가 null이면 빈 diff + 헤더 `X-Diff-Base: ""`.
  - `mb = git -C <repo> merge-base <ref> HEAD`.
  - `git -C <repo> diff <mb> --no-color` (merge-base vs 워킹트리 = 커밋+미커밋).
  - `untracked=1`이면 기존과 동일하게 untracked 파일을 합성 diff로 이어붙인다.
  - 응답 헤더 `X-Diff-Base: <base>`로 base 이름 전달.

### 4.3 뷰어 UI
- 툴바에 `<select id="diff-mode">` 추가: 옵션 `working`("Working tree"), `base`("vs <base>").
- base 라벨은 로드 시 채운다: `/api/diff` 응답의 `X-Diff-Base` 헤더(또는 초기 요청)에서
  base 이름을 읽어 옵션 텍스트를 "vs main" 등으로 갱신. base가 비어 있으면 "base" 옵션을
  `disabled`로 두고 title로 사유 힌트.
- 기본값 `working`. 선택은 `localStorage["cc-statusline:diff-mode"]`에 저장·복원.
- 모드 변경 시 `mode` 파라미터를 반영해 재fetch.

### 4.4 상호작용
- **untracked 토글**: 두 모드 모두에서 적용(base 모드에서도 untracked는 base에 없으므로 added로 표시).
- **watch mode**: 활성 모드를 폴링. base 모드에선 커밋해도 계속 보이므로, "커밋하면 사라짐"
  문제를 정확히 해결. 폴링 fetch도 `mode`를 포함.
- **fetch 쿼리**: `repo`, `token`, `untracked`, `mode` 4개 파라미터.

## 5. 에러 처리
- `gh`가 없거나 PR 없음 → 폴백 기본 브랜치. 기본 브랜치도 못 찾으면 base 모드 비활성.
- `merge-base` 실패(관련 없는 히스토리 등) → 빈 diff + 헤더로 사유 없이 base "" 반환,
  뷰어는 "No changes/보이지 않음" 처리(기존 empty 경로 재사용).
- 폴링 중 실패는 기존과 동일하게 삼키고 마지막 내용 유지.

## 6. 변경 대상 파일
| 파일 | 변경 |
|------|------|
| `src/diff-server/diff.ts` | `resolveBaseRef(repo)`, base 모드 diff (`getDiff`에 `mode`/`baseRef` 확장 또는 별도 함수) |
| `src/diff-server/server.ts` | `/api/diff?mode=` 처리 + `X-Diff-Base` 헤더 |
| `src/viewer/index.html` | 모드 드롭다운 추가 |
| `src/viewer/main.ts` | 모드 상태/드롭다운/localStorage, fetch에 `mode` 포함, base 라벨 갱신 |

## 7. 테스트 전략
- **서버 단위/통합** (임시 git repo):
  - `resolveBaseRef`: repo에 `main` 브랜치 + 분기 커밋을 만들고 기본-브랜치 폴백 경로로 base/ref 해결 확인. (`gh` PR 경로는 gh 의존이라 자동 테스트에서 제외, 수동 확인.)
  - base 모드 diff: base에서 갈라진 뒤 커밋 1개 + 워킹트리 변경 1개를 만들고 `mode=base`가
    둘 다 포함하는지, `mode=working`은 워킹트리만인지 확인. `X-Diff-Base` 헤더 확인.
  - untracked가 base 모드에서도 포함되는지.
- **뷰어**: 브라우저 전용이라 수동 E2E — 모드 드롭다운 전환, 커밋 후에도 base 모드가
  변경을 유지, watch와 조합, 라벨이 실제 base 이름 표시, base 미해결 시 비활성.
- 기존 `bun test` 스위트 회귀 없이 통과 유지.

## 8. 범위 밖 (YAGNI)
- 임의 브랜치/커밋 선택 UI(작성 시점엔 base/working 2모드만).
- PR 목록·다중 PR 처리(현재 브랜치의 단일 PR만).
- base가 원격에서 갱신될 때 자동 fetch(로컬 `origin/<base>` 스냅샷 사용; 사용자가 최신을
  원하면 별도로 `git fetch`).
