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


### 사용량 지표

![사용량 지표가 포함된 상태표시줄 스크린샷](usage_metrics.png)

## 기능

- **세션 시간**: 현재 세션 경과 시간
- **비용**: 세션 비용 (USD)
- **컨텍스트**: 토큰 사용량 및 백분율 (색상 표시)
- **Git Diff**: 파일 수, 추가, 삭제
- **PR URL**: 클릭 가능한 OSC 8 하이퍼링크
- **TrueColor**: 임계값에 따른 동적 색상
- **제한 리셋 타이머**: 사용량 제한 리셋까지 남은 시간
- **블록 사용량**: 5시간 사용률 (서버 API 기반)
- **주간 사용량**: 7일 사용률 (서버 API 기반)

## Emoji 가이드

| Emoji | 설명                   |
| ----- | ---------------------- |
| 📁    | 프로젝트 폴더명        |
| 🌿    | 현재 Git 브랜치        |
| ⏱️    | 세션 경과 시간         |
| 💰    | 세션 비용 (USD)        |
| 🧠    | 컨텍스트 창 사용량     |
| ⏳    | 제한 리셋 카운트다운   |
| 📊    | 5시간 사용률 %         |
| 📅    | 7일 사용률 %           |
| ✏️    | 커밋되지 않은 변경사항 |
| 📎    | Pull Request 링크      |

## 사용량 지표

Anthropic Usage API에서 사용량 정보를 가져와 표시합니다.

> [!WARNING]
> `--show-usage` 기능은 비공식적으로 리버스 엔지니어링된 Anthropic API 엔드포인트를 사용하여 사용량 데이터를 가져옵니다. 이는 공식 지원 API가 아니며, 예고 없이 변경되거나 중단될 수 있습니다. **사용에 따른 책임은 본인에게 있습니다.** 이 기능 사용으로 인해 발생할 수 있는 계정 제한이나 서비스 중단 등 모든 결과에 대해 저자는 책임을 지지 않습니다.

> [!NOTE]
> 이 기능은 macOS Keychain(`Claude Code-credentials`)에서 OAuth 토큰을 읽기 때문에 **macOS 전용**입니다.

### 동작 방식

macOS Keychain의 OAuth 액세스 토큰을 사용하여 Anthropic Usage API(`/api/oauth/usage`)를 호출합니다:

1. **5시간 사용률** - 현재 빌링 블록의 서버 계산 사용 백분율
2. **7일 사용률** - 서버 계산 주간 사용 백분율
3. **리셋 타이머** - 서버에서 제공하는 정확한 리셋 시간 (`resets_at`)

### 활성화

사용량 지표는 **기본적으로 숨겨져 있습니다**. 활성화하려면 `--show-usage` 플래그를 사용하세요:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline --show-usage",
    "padding": 0
  }
}
```

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
