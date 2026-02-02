# cc-statusline

[English](../README.md) | 한국어 | [日本語](README.ja.md) | [中文](README.zh.md) | [Español](README.es.md)

Claude Code를 위한 커스텀 상태표시줄.

[![Claude Code](https://img.shields.io/badge/Claude_Code-D97757?style=flat&logo=claude&logoColor=white)](https://code.claude.com/docs/en/statusline)
[![npm](https://img.shields.io/npm/v/%40say8425%2Fcc-statusline?logo=npm&logoColor=%23CC3534&color=%23CC3534)](https://www.npmjs.com/package/@say8425/cc-statusline)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-black?style=flat&logo=bun)](https://bun.sh)

## 스크린샷

### Git diff만 표시

![scenario1_diff_only](scenario1_diff_only.png)

### PR만 표시

![scenario2_pr_only](scenario2_pr_only.png)

### Git diff + PR

![scenario3_diff_pr](scenario3_diff_pr.png)

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

## 기능

- **세션 시간**: 현재 세션 경과 시간
- **비용**: 세션 비용 (USD)
- **컨텍스트**: 토큰 사용량 및 백분율 (색상 표시)
- **Git Diff**: 파일 수, 추가, 삭제
- **PR URL**: 클릭 가능한 OSC 8 하이퍼링크
- **TrueColor**: 임계값에 따른 동적 색상

## Emoji 가이드

| Emoji | 설명                   |
| ----- | ---------------------- |
| 📁    | 프로젝트 폴더명        |
| 🌿    | 현재 Git 브랜치        |
| ⏱️    | 세션 경과 시간         |
| 💰    | 세션 비용 (USD)        |
| 🧠    | 컨텍스트 창 사용량     |
| ✏️    | 커밋되지 않은 변경사항 |
| 📎    | Pull Request 링크      |

## 의존성

- [Bun](https://bun.sh) - JavaScript 런타임
- [gh](https://cli.github.com) - GitHub CLI (선택사항, PR URL용)

## 색상 임계값

| 지표       | 정상 (흰색) | 경고 (노란색) | 위험 (빨간색) |
| ---------- | ----------- | ------------- | ------------- |
| 컨텍스트 % | < 50%       | 50-80%        | > 80%         |

## 라이선스

MIT
