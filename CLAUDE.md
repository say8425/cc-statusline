# cc-statusline

Claude Code용 커스텀 statusline 스크립트.

## WHAT

```
cc-statusline/
├── statusline.sh    # 메인 스크립트 (Claude Code statusLine command로 실행)
└── CLAUDE.md
```

**기술 스택**: Bash, jq, ccusage, gh CLI

**데이터 소스** (5개):
| 데이터 | 출처 |
|--------|------|
| 세션 시간 | Claude Code JSON (stdin) |
| 세션 토큰 | ccusage session |
| 블록 타이머 | ccusage blocks |
| Context % | transcript JSONL 파일 |
| Git/PR | git, gh CLI |

## WHY

Claude Code 기본 statusbar에 다음 정보를 추가로 표시:
- 세션 누적 토큰 및 현재 context window 사용률 (%)
- 5시간 블록 남은 시간 (ccusage 연동)
- Git 변경사항 (+/- 라인)
- PR URL (클릭 가능한 OSC 8 하이퍼링크)
- TrueColor 동적 색상 (임계값 기반 경고)

## HOW

### 설치

```bash
# ~/.claude/settings.json
{
  "statusLine": {
    "type": "command",
    "command": "~/dev/cc-statusline/statusline.sh",
    "padding": 0
  }
}
```

### 의존성

- `jq`: JSON 파싱
- `ccusage`: `bunx ccusage@latest` (블록 타이머, 세션 토큰)
- `gh`: GitHub CLI (PR URL)

### 테스트

```bash
echo '{"transcript_path":"","cost":{"total_duration_ms":3600000}}' | ./statusline.sh
```

### 수정 시 주의사항

- 300ms마다 실행되므로 외부 명령어 최소화
- macOS/Linux 호환성 유지 (`tail -r` || `tac`)
- sessionId 변환: `pwd | tr '/.' '-'` (ccusage 방식)
