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

## CLI 옵션

| 옵션                          | 설명                                            | 기본값 |
| ----------------------------- | ----------------------------------------------- | :----: |
| [`--plan <plan>`](#플랜-선택) | 구독 플랜별 비용 한도 설정 (pro, max5x, max20x) | `pro`  |
| [`--no-usage`](#비활성화)     | 사용량 지표 줄 숨김                             |   -    |

## 스크린샷

### Git diff만 표시

![scenario1_diff_only](scenario1_diff_only.png)

### PR만 표시

![scenario2_pr_only](scenario2_pr_only.png)

### Git diff + PR

![scenario3_diff_pr](scenario3_diff_pr.png)

### Context 정상 (< 50%)

![정상 컨텍스트 사용량(50% 미만)의 상태표시줄 스크린샷](context_normal.png)

### Context 경고 (50-80%)

![경고 컨텍스트 사용량(50%-80%)의 상태표시줄 스크린샷](context_warning.png)

### Context 위험 (> 80%)

![위험 컨텍스트 사용량(80% 초과)의 상태표시줄 스크린샷](context_critical.png)

### 제한 리셋 타이머

![제한 리셋 타이머가 포함된 상태표시줄 스크린샷](limit_reset.png)

## 기능

- **세션 시간**: 현재 세션 경과 시간
- **비용**: 세션 비용 (USD)
- **컨텍스트**: 토큰 사용량 및 백분율 (색상 표시)
- **Git Diff**: 파일 수, 추가, 삭제
- **PR URL**: 클릭 가능한 OSC 8 하이퍼링크
- **TrueColor**: 임계값에 따른 동적 색상
- **제한 리셋 타이머**: 사용량 제한 리셋까지 남은 시간
- **블록 사용량**: 5시간 블록 비용 사용량 및 백분율
- **번레이트**: 분당 토큰 소비율

## Emoji 가이드

| Emoji | 설명                   |
| ----- | ---------------------- |
| 📁    | 프로젝트 폴더명        |
| 🌿    | 현재 Git 브랜치        |
| ⏱️    | 세션 경과 시간         |
| 💰    | 세션 비용 (USD)        |
| 🧠    | 컨텍스트 창 사용량     |
| ⏳    | 제한 리셋 카운트다운   |
| 📊    | 5시간 블록 비용 사용량 |
| 🔥    | 토큰 번레이트 (분당)   |
| ✏️    | 커밋되지 않은 변경사항 |
| 📎    | Pull Request 링크      |

## 사용량 지표

5시간 빌링 블록의 사용량 정보를 표시합니다.

> [!NOTE]
> Anthropic은 구독제 사용량 계산 공식을 공개하지 않습니다. 블록 사용량은 API 공시 가격 기반 추정치이며, 실제 `/usage` 값과 다를 수 있습니다.

### 동작 방식

`~/.claude/projects/`의 JSONL 파일을 자동으로 파싱하여 감지:

1. **5시간 빌링 블록** - 누적 시간 및 비활동 갭 기반 블록 경계 감지 (리셋 타이머는 시간 단위 floor 적용)
2. **비용 계산** - 모델별 가격(opus/sonnet/haiku) × 토큰 수로 비용 산출
3. **크로스 프로젝트 스캔** - `~/.claude/projects/` 전체 프로젝트 스캔 (블록은 프로젝트 간 통합)
4. **번레이트** - 분당 평균 토큰 소비량 계산

수동 설정이 필요 없습니다.

### 플랜 선택

플랜은 macOS Keychain (`Claude Code-credentials` → `rateLimitTier`)에서 **자동 감지**되므로 별도 설정이 필요 없습니다.

> [!NOTE]
> 자동 감지는 **macOS 전용**입니다. 다른 플랫폼에서는 `--plan` 플래그로 플랜을 직접 지정하세요.

수동으로 지정하려면 `--plan` 플래그를 사용하세요:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline --plan max5x",
    "padding": 0
  }
}
```

| 플랜              | 비용 한도 | 명령어         |
| ----------------- | --------- | -------------- |
| Pro               | $8        | `--plan pro`   |
| Max 5x            | $40       | `--plan max5x` |
| Max 20x           | $160      | `--plan max20x`|
| 자동 감지 (기본값) | -         | -              |

### 비활성화

사용량 지표 줄(리셋 타이머, 블록 사용량, 번레이트)을 숨기려면 `--no-usage` 플래그를 사용하세요:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline --no-usage",
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
