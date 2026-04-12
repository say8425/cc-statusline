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
- **Git Diff**: 파일 수, 추가, 삭제
- **PR URL**: 클릭 가능한 OSC 8 하이퍼링크
- **TrueColor**: 임계값에 따른 동적 색상
- **리셋 시각**: 5시간 사용량 리셋 시각 (HH:MM)
- **워크트리 지원**: `cc --worktree` 세션에서 실제 프로젝트 이름 표시
- **블록 사용량**: 5시간 사용률
- **주간 리셋 타이머**: 7일 사용량 리셋 시각 (MM/DD HH:MM)
- **주간 사용량**: 7일 사용률

## Emoji 가이드

| Emoji | 설명                   |
| ----- | ---------------------- |
| 📁    | 프로젝트 폴더명        |
| 🌲    | 워크트리 이름 (워크트리 세션에서 표시) |
| 🌿    | 현재 Git 브랜치        |
| ⏱️    | 세션 경과 시간         |
| 💰    | 세션 비용 (USD)        |
| 🧠    | 컨텍스트 창 사용량     |
| ⏳    | 리셋 시각              |
| 📊    | 5시간 사용률 %         |
| ⏰    | 주간 제한 리셋 시간    |
| 📅    | 7일 사용률 %           |
| ✏️    | 커밋되지 않은 변경사항 |
| 📎    | Pull Request 링크      |

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
