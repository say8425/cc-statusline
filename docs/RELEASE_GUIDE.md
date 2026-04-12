# Release Guide

이 프로젝트는 [release-please](https://github.com/googleapis/release-please)를 사용하여 버전 관리 및 릴리스를 자동화합니다.

## 동작 방식

1. main 브랜치에 커밋이 푸시되면 release-please가 자동으로 실행
2. [Conventional Commits](https://www.conventionalcommits.org/) 기반으로 버전 범프 결정
3. Release PR이 자동 생성 (CHANGELOG.md, package.json 버전 업데이트)
4. Release PR이 머지되면 GitHub Release + npm publish 자동 실행

## 커밋 메시지와 버전 범프

release-please는 커밋 메시지의 **type**으로 버전을 결정합니다.

### 릴리스를 트리거하는 타입

| 커밋 메시지 | 버전 범프 | 예시 |
|------------|----------|------|
| `fix: ...` | patch (x.x.**1**) | `fix: handle null rate_limits` |
| `feat: ...` | minor (x.**1**.0) | `feat: add weekly usage display` |
| `feat!: ...` | **major** (**1**.0.0) | `feat!: upgrade TypeScript to v6` |
| `fix!: ...` | **major** (**1**.0.0) | `fix!: change rate_limits format` |
| `refactor!: ...` | **major** (**1**.0.0) | `refactor!: restructure JSON input` |

### 릴리스를 트리거하지 않는 타입

| 타입 | 용도 |
|------|------|
| `chore` | 유지보수 (의존성 업데이트 등) |
| `docs` | 문서 변경 |
| `test` | 테스트 추가/수정 |
| `ci` | CI/CD 설정 변경 |
| `refactor` | 코드 리팩토링 (breaking 아닌 경우) |
| `perf` | 성능 개선 |

### Breaking Change (Major 버전 범프)

Major 버전을 올리려면 두 가지 방법이 있습니다:

**방법 1: `!` 접미사 사용**
```
feat!: change input format

description here
```

**방법 2: BREAKING CHANGE footer 사용**
```
feat: change input format

BREAKING CHANGE: rate_limits field renamed to usage_limits
```

두 방법 모두 major 버전을 트리거합니다.

## 워크플로우 구성

`.github/workflows/release.yml`에 정의되어 있습니다:

- **release-please job**: Release PR 생성 및 자동 머지 설정
- **publish job**: Release 생성 시 `bun build` → `npm publish --provenance` 실행
- **트리거**: main 브랜치 push 또는 수동 실행 (workflow_dispatch)

## 릴리스 절차

### 일반 릴리스

1. feature 브랜치에서 작업 후 PR 생성
2. PR 머지 → main에 커밋 푸시
3. release-please가 자동으로 Release PR 생성
4. Release PR이 자동 머지됨 (`--auto --rebase`)
5. npm에 자동 배포

### 수동 릴리스 트리거

Actions 탭에서 Release 워크플로우를 수동 실행할 수 있습니다:
```
GitHub → Actions → Release → Run workflow
```

## 참고

- release-please 공식 문서: https://github.com/googleapis/release-please
- Conventional Commits 스펙: https://www.conventionalcommits.org
- release-please 설정 옵션: https://github.com/googleapis/release-please/blob/main/docs/customizing.md
