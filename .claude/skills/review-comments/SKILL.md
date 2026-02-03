---
name: review-comments
description: PR에 달린 리뷰 코멘트를 검토하고, 필요한 작업을 수행한 후, 각 코멘트에 reply를 달고 resolve합니다. PR 번호를 인자로 전달하거나 생략하면 현재 브랜치의 PR을 사용합니다.
---

# PR Review Comments Handler

PR 리뷰 코멘트를 처리하는 워크플로우입니다.

## 사용법

```
/review-comments [PR번호]
```

PR 번호를 생략하면 현재 브랜치의 PR을 자동으로 찾습니다.

## 워크플로우

### Step 1: PR 정보 확인

PR 번호가 주어지지 않은 경우:

```bash
gh pr view --json number -q .number
```

### Step 2: 리뷰 코멘트 가져오기

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments
```

반환되는 주요 필드:

- `id`: 코멘트 ID
- `body`: 코멘트 내용
- `path`: 파일 경로
- `line`: 라인 번호
- `diff_hunk`: 관련 diff

### Step 3: 각 코멘트 분석 및 처리

각 코멘트에 대해:

1. 코멘트 내용을 읽고 요청사항 파악
2. 제안의 적절성 판단:
   - **적절한 경우**: `suggestion` 코드 블록이 있으면 적용, 필요한 코드 수정 수행, 변경사항 커밋 및 푸시
   - **부적절한 경우**: 거부하고 거부 사유를 명확히 작성 (예: 기존 설계 의도와 충돌, 성능 저하, 범위 초과 등)

### Step 4: Reply 달기

각 코멘트에 조치 내용을 reply로 작성:

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments/{comment_id}/replies \
  -f body="조치 내용을 여기에 작성"
```

### Step 5: Thread Resolve

1. 먼저 review thread ID를 가져옵니다:

```bash
gh api graphql -f query='
query {
  repository(owner: "{owner}", name: "{repo}") {
    pullRequest(number: {pr_number}) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes { body }
          }
        }
      }
    }
  }
}'
```

2. 각 thread를 resolve합니다:

```bash
gh api graphql -f query='
mutation {
  resolveReviewThread(input: {threadId: "{thread_id}"}) {
    thread { isResolved }
  }
}'
```

## 주의사항

- Reply와 Resolve 전에 반드시 코드 변경을 먼저 커밋/푸시해야 함
- Bot이 작성한 코멘트도 처리 대상에 포함됨 (Gemini Code Assist 등)
- `suggestion` 블록이 있는 코멘트는 해당 코드를 적용
- Thread ID와 Comment ID는 다름에 주의 (Thread resolve에는 Thread ID 필요)
- 거부 시에도 반드시 reply와 resolve를 수행 (거부 사유를 명확히 기재)
- 거부 사유 예시: 설계 의도와 충돌, 과도한 추상화, 성능 저하, 범위 초과, 이미 다른 방식으로 해결됨

## 예시 출력

| 코멘트                | 조치                                     | 상태        |
| --------------------- | ---------------------------------------- | ----------- |
| Type Safety 개선 제안 | 적용 완료                                | ✅ Resolved |
| Argument Parsing 개선 | 적용 완료                                | ✅ Resolved |
| 불필요한 추상화 제안  | 거부: 현재 단일 사용처이며 과도한 추상화 | ❌ Resolved |
