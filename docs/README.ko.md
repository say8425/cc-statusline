# cc-statusline

[English](../README.md) | 한국어 | [日本語](README.ja.md) | [中文](README.zh.md) | [Español](README.es.md)

Claude Code를 위한 커스텀 상태표시줄.

[![Claude Code](https://img.shields.io/badge/Claude_Code-D97757?style=flat&logo=claude&logoColor=white)](https://code.claude.com/docs/en/statusline)
[![npm](https://img.shields.io/npm/v/%40say8425%2Fcc-statusline?logo=npm&logoColor=%23CC3534&color=%23CC3534)](https://www.npmjs.com/package/@say8425/cc-statusline)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-black?style=flat&logo=bun)](https://bun.sh)

## 설치

`~/.claude/settings.json`에 다음을 추가하세요:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline",
    "padding": 0
  }
}
```

## 스크린샷

### Git diff만 표시

![scenario1_diff_only](scenario1_diff_only.png)

### PR만 표시

![scenario2_pr_only](scenario2_pr_only.png)

### Git diff + PR

![scenario3_diff_pr](scenario3_diff_pr.png)

### 워크트리

![worktree_diff](worktree_diff.png)

### 워크트리 + 사용량 지표

![worktree_usage](worktree_usage.png)

### 사용량 지표

![사용량 지표가 포함된 상태표시줄 스크린샷](usage_metrics.png)

## 기능

- **세션 시간**: 현재 세션 경과 시간
- **비용**: 세션 비용 (USD)
- **컨텍스트**: 토큰 사용량 및 백분율 (색상 표시)
- **모델**: 현재 사용 중인 모델명과 reasoning effort (예: `Fable 5 high`, effort는 지원 모델에서만 표시), Claude Code 설정에서 ultracode가 켜져 있고 세션 effort가 `xhigh`일 때 `⚡ultra` 배지 표시
- **Git Diff**: 파일 수, 추가, 삭제
- **클릭 가능한 Diff 뷰어**: `✏️`를 클릭하면 로컬 diff 뷰어([diffdeck](https://github.com/say8425/diffdeck), 의존성으로 자동 설치)가 브라우저에 열립니다 — 파일 트리, working-tree / vs-base 모드, watch 모드(자동 새로고침), 파일 폴딩, 전체 diff 대상 인앱 검색(`Cmd/Ctrl+F`, 삭제된 줄 포함)
- **PR URL**: 클릭 가능한 OSC 8 하이퍼링크
- **워크트리 지원**: `cc --worktree` 세션에서 실제 프로젝트 이름 표시
- **TrueColor**: 임계값에 따른 동적 색상
- **리셋 시각**: 5시간 사용량 리셋 시각 (HH:MM)
- **블록 사용량**: 5시간 사용률
- **주간 리셋 타이머**: 7일 사용량 리셋 시각 (MM/DD HH:MM)
- **주간 사용량**: 7일 사용률

## Emoji 가이드

| Emoji | 설명                   |
| ----- | ---------------------- |
| 📁    | 프로젝트 폴더명 (클릭하면 파일 관리자에서 열림) |
| 🌲    | 워크트리 이름 (클릭하면 워크트리 폴더 열림) |
| 🌿    | 현재 Git 브랜치        |
| ⏱️    | 세션 경과 시간         |
| 💰    | 세션 비용 (USD)        |
| 🧠    | 컨텍스트 창 사용량     |
| 🤖    | 현재 모델 및 effort    |
| ⏳    | 리셋 시각              |
| 📊    | 5시간 사용률 %         |
| ⏰    | 주간 제한 리셋 시간    |
| 📅    | 7일 사용률 %           |
| ✏️    | 커밋되지 않은 변경사항 (클릭하면 diff 뷰어 열림) |
| 📎    | Pull Request 링크, PR 상태(Open/Draft/Merged/Closed, 색상별)와 Open 상태일 때 CI 체크 아이콘(✅/🟡/❌) 표시 |

## Diff 뷰어

statusline의 `✏️`를 클릭하면 로컬 diff 뷰어가 브라우저에 열립니다. 뷰어 자체는 [diffdeck](https://github.com/say8425/diffdeck)(npm의 [`@say8425/diffdeck`](https://www.npmjs.com/package/@say8425/diffdeck))가 제공하며, cc-statusline의 런타임 의존성으로 자동 설치됩니다 — statusline이 이를 백그라운드 데몬으로 띄우고 `✏️` 진입점에서 링크합니다.

![diff_viewer](diff_viewer.png)

- **두 가지 diff 모드**: `Working tree`(HEAD 대비)와 `vs <base>`(PR 타겟 또는 기본 브랜치와의 merge-base 대비). 커밋 후에도 진입점이 `✏️ vs <base>`로 유지되어 클릭하면 뷰어가 base 모드로 열립니다 — 리뷰 도중 diff가 사라지지 않습니다.

![diff_vs_base](diff_vs_base.png)

- **이미지 diff**: 변경된 바이너리 이미지(png/jpg/gif/webp/avif/bmp/ico)가 파일트리와 같은 순서로 diff 흐름에 인라인 표시 — 체커보드 배경의 Old/New 패널, 다른 파일처럼 접기 가능

![image_diff](image_diff.png)
- **Unified / Split** 뷰 전환
- **Watch 모드**: 스크롤 위치를 유지한 채 변경을 감지해 자동 갱신 (~2초 폴링)
- **파일 트리**: 좌/우 배치 및 flatten(빈 디렉터리 접기) 토글
- **파일 폴딩**: 파일 헤더를 클릭해 접기/펼치기; 락파일과 변경 줄 수 1,500 초과 파일은 처음부터 접힌 상태
- **인앱 검색**(`Cmd/Ctrl+F`): 삭제된 줄을 포함한 전체 diff 검색, 매치 이동과 하이라이트
- **경로 복사**: 파일 헤더에 마우스를 올리면 상대 경로 복사 버튼 표시
- **Untracked 파일 포함** 토글

### 동작 방식 (Diff 뷰어)

레포에 보여줄 변경이 있으면 statusline이 diffdeck을 `127.0.0.1:49573`에 백그라운드 데몬으로 필요 시 띄웁니다. 요청은 토큰으로 보호되며 localhost에만 바인딩됩니다.

| 환경 변수 | 효과 |
| --------- | ---- |
| `CC_STATUSLINE_DIFF_PORT` | 포트 변경 (기본값: `49573`) |
| `CC_STATUSLINE_DIFF_DISABLE=1` | diff 뷰어 완전 비활성화 |

> [!TIP]
> 북마크 대신 `✏️` 링크로 뷰어를 여세요 — 링크에는 항상 최신 토큰이 포함되며 서버 실행도 보장됩니다.

## 사용량 지표

Claude Code의 stdin JSON 입력에서 사용량 정보를 표시합니다.

### 동작 방식

Claude Code가 stdin JSON 입력으로 `rate_limits`를 전달합니다 (CLI 2.1.80+):

1. **5시간 사용률** - 현재 빌링 블록의 사용 백분율 (`rate_limits.five_hour.used_percentage`)
2. **7일 사용률** - 주간 사용 백분율 (`rate_limits.seven_day.used_percentage`)
3. **리셋 타이머** - 정확한 리셋 시각 (`rate_limits.five_hour.resets_at`), `HH:MM` 포맷
4. **주간 리셋 타이머** - 주간 제한 리셋 시각 (`rate_limits.seven_day.resets_at`), `MM/DD HH:MM` 포맷 (예: `02/15 17:00`)

사용량 지표는 stdin JSON에 `rate_limits`가 포함되어 있으면 **자동으로 표시**됩니다. 추가 플래그나 설정이 필요 없습니다.

> [!NOTE]
> `rate_limits`는 Claude.ai 구독자(Pro/Max)에게만 첫 API 응답 이후 제공됩니다. 전체 JSON 스키마는 [공식 statusline 문서](https://code.claude.com/docs/en/statusline)를 참조하세요.

## 의존성

- [Bun](https://bun.sh) - JavaScript 런타임
- [gh](https://cli.github.com) - GitHub CLI (선택사항, PR URL용)

## 색상 임계값

| 지표          | 정상 (흰색) | 경고 (노란색) | 위험 (빨간색) |
| ------------- | ----------- | ------------- | ------------- |
| 컨텍스트 %    | < 50%       | 50-80%        | > 80%         |
| 블록 사용량 % | < 50%       | 50-80%        | > 80%         |

## 라이선스

MIT
