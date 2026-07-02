# 커밋 후에도 유지되는 diff 뷰어 진입점 (적응형 ✏️) 설계

- 날짜: 2026-07-02
- 상태: 설계 승인됨
- 대상: `@say8425/cc-statusline` statusline + diff 뷰어 (PR #48 브랜치에 이어서)

## 1. 목표 / 동기

statusline의 `✏️ N files +X -Y`는 **working-tree 변경이 있을 때만** 표시된다
(`render.ts`의 `hasGitChanges`). 전부 커밋하면 이 세그먼트가 사라져 diff 뷰어를 열
클릭 진입점이 없어진다 — 정작 vs-base 모드가 유용한 "커밋 후" 상황에서 접근 불가.

`✏️` 세그먼트를 **상황전환형**으로 만들어, working 변경이 없어도 브랜치가 base보다
앞서 있으면 base 대비 stat을 보여주고 클릭 시 뷰어를 base 모드로 연다.

## 2. 결정된 동작 (render.ts)

`✏️` 세그먼트는 다음 우선순위로 하나만 표시한다:
1. **working 변경 있음** → `✏️ N files +X -Y` (기존) → 링크는 working 모드
2. **working 없음 + 브랜치가 base보다 앞섬** → `✏️ vs <base> N files +X -Y` → 링크는 base 모드
3. **둘 다 없음** → 세그먼트 숨김

- 두 변형 모두 클릭 가능(OSC 8, 밑줄 — PR 링크와 동일 스타일).
- 라벨 형식: working은 기존 그대로, base 변형은 앞에 `vs <base> `를 붙인다.

## 3. 링크가 모드를 지정 + 뷰어가 URL 우선

- `buildDiffViewerUrl`에 선택적 `mode` 파라미터 추가 → URL에 `&mode=working`/`&mode=base`.
- working 변형 링크 = `mode=working`, base 변형 링크 = `mode=base`.
- **뷰어(`main.ts`)는 URL의 `mode`가 있으면 그것을 우선 적용**(localStorage 덮어쓰고
  저장). base ✏️를 눌렀는데 localStorage가 working이라 "No changes"가 뜨는 혼란 방지.
- URL에 `mode`가 없으면 기존대로 localStorage → 기본 working.

## 4. 브랜치 stat 계산 (index.ts / git)

- **working이 clean일 때만** 계산한다(핫패스 보호). working 변경이 있으면 base 계산 생략.
- `getBaseChangesCached()`:
  1. `resolveBaseRef(repo)` (기존 `src/diff-server/diff.ts` 재사용) → `{ base, ref }`.
  2. `ref`가 없으면 `null` 반환.
  3. `mb = git -C <repo> merge-base <ref> HEAD`; 없으면 `null`.
  4. `git -C <repo> diff <mb> --shortstat` → 기존 shortstat 파싱(단수/복수)으로
     `{ files, insertions, deletions }`.
  5. 모두 0이면(브랜치==base) `null`. 아니면 `{ base, files, insertions, deletions }`.
- **캐시**: base 해결(`gh pr view`)이 느리므로 `cache.ts`에 `baseRef` 항목 추가(TTL ~30초,
  기존 `prUrl` 패턴). shortstat은 저렴하므로 매번 계산.
- untracked는 stat에 포함하지 않는다(working `✏️`와 동일 기준).

## 5. RenderContext 확장 (types.ts)

- `baseChanges: { base: string; files: number; insertions: number; deletions: number } | null`
- `baseDiffViewerUrl: string | null` (base 모드 링크; base 변형을 표시할 때만 non-null)
- 기존 `diffViewerUrl`은 working 변형 링크로 유지(index.ts가 `mode=working`으로 빌드).

## 6. 변경 대상 파일
| 파일 | 변경 |
|------|------|
| `src/diff-server/link.ts` | `buildDiffViewerUrl`에 선택적 `mode` |
| `src/cache.ts` | `baseRef` 캐시 항목 + `CACHE_TTL.baseRef` |
| `src/git/` (예: `baseChanges.ts` + `index.ts` re-export) | `getBaseChangesCached()` |
| `src/types.ts` | `RenderContext`에 `baseChanges`, `baseDiffViewerUrl` |
| `src/render.ts` | 적응형 `✏️` (working → base → 숨김) |
| `src/index.ts` | working clean일 때 baseChanges 계산, working/base URL 빌드, ctx 주입 |
| `src/viewer/main.ts` | URL `mode` 파라미터 우선 적용 |

## 7. 에러 처리 / 엣지
- detached HEAD / 브랜치 없음 / base 미해결 → `baseChanges` null → base 변형 미표시.
- 브랜치가 base와 동일(merge-base=HEAD) → 변경 0 → 미표시.
- `gh`/`git` 실패 → null(안전 폴백), 기존 gitChanges 실패 처리와 동일 톤.

## 8. 테스트 전략
- **render.ts (순수)**: 3케이스 — (a) working 변경 → working `✏️` + working 링크,
  (b) working 없음 + baseChanges → `vs <base>` `✏️` + base 링크(밑줄), (c) 둘 다 없음 → 숨김.
- **link.ts**: `mode` 파라미터가 `&mode=` 로 인코딩되는지.
- **getBaseChangesCached**: 임시 repo(로컬 base 브랜치 + 앞선 커밋)로 stat 계산 + 캐시.
- **뷰어 URL mode**: 브라우저 수동 — base ✏️ 링크로 열면 뷰어가 base 모드로 시작.
- 기존 `bun test` 회귀 없이 통과.

## 9. 범위 밖 (YAGNI)
- ahead/behind 카운트, 원격 자동 fetch, base 외 임의 ref 비교.
- working + base 를 동시에 두 세그먼트로 표시(옵션 B에서 배제, 단일 적응형 세그먼트).
