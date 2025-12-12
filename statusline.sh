#!/bin/bash

# TrueColor 색상 정의
C_RESET=$'\e[0m'
C_CYAN=$'\e[38;2;0;255;255m'
C_MAGENTA=$'\e[38;2;255;100;200m'
C_GREEN=$'\e[38;2;100;255;100m'
C_YELLOW=$'\e[38;2;255;220;100m'
C_RED=$'\e[38;2;255;100;100m'
C_BLUE=$'\e[38;2;100;150;255m'
C_WHITE=$'\e[38;2;200;200;200m'
C_UNDERLINE=$'\e[4m'

# 동적 색상 함수
get_timer_color() {
  local mins=$1
  if [ "$mins" -gt 10 ]; then printf "$C_WHITE"
  elif [ "$mins" -gt 1 ]; then printf "$C_YELLOW"
  else printf "$C_RED"; fi
}

get_context_color() {
  local pct=$1
  if [ "$pct" -lt 50 ]; then printf "$C_WHITE"
  elif [ "$pct" -lt 80 ]; then printf "$C_YELLOW"
  else printf "$C_RED"; fi
}

# Claude Code stdin JSON 읽기
claude_json=$(cat)

# transcript 파일에서 context 길이 계산 (ccstatusline 방식)
# contextLength = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
# 가장 최근 메인 체인 메시지 기준
transcript_path=$(echo "$claude_json" | jq -r '.transcript_path // ""')
context_length=0
usable_tokens=160000  # 200k * 0.8 (자동 압축 임계값)

if [ -n "$transcript_path" ] && [ -f "$transcript_path" ]; then
  # usage 정보가 있는 마지막 assistant 메시지 가져오기 (메인 체인만)
  # macOS: tail -r, Linux: tac
  last_usage=$( (tail -r "$transcript_path" 2>/dev/null || tac "$transcript_path" 2>/dev/null) | grep -m1 '"input_tokens"')
  if [ -n "$last_usage" ]; then
    input_tokens=$(echo "$last_usage" | jq -r '.message.usage.input_tokens // 0' 2>/dev/null || echo 0)
    cache_read=$(echo "$last_usage" | jq -r '.message.usage.cache_read_input_tokens // 0' 2>/dev/null || echo 0)
    cache_creation=$(echo "$last_usage" | jq -r '.message.usage.cache_creation_input_tokens // 0' 2>/dev/null || echo 0)
    context_length=$((input_tokens + cache_read + cache_creation))
  fi
fi

# 퍼센트 계산 (usable context) - 현재 윈도우 사용량
if [ "$context_length" -gt 0 ]; then
  ctx_pct=$((context_length * 100 / usable_tokens))
else
  ctx_pct=0
fi

# ccusage session에서 세션 누적 토큰 가져오기 (현재 세션 매칭)
# sessionId 변환: /와 . 모두 -로 변환 (ccusage 방식)
cwd=$(pwd | tr '/.' '-')
session_json=$(bunx ccusage@latest session --json 2>/dev/null)
total_session_tokens=$(echo "$session_json" | jq -r --arg sid "$cwd" \
  '.sessions[] | select(.sessionId == $sid) | .totalTokens // 0' | head -1)
if [ -z "$total_session_tokens" ] || [ "$total_session_tokens" = "null" ]; then
  total_session_tokens=0
fi
tokens_fmt=$(printf "%'d" "$total_session_tokens")

# Claude Code JSON에서 세션 시간 가져오기
session_ms=$(echo "$claude_json" | jq -r '.cost.total_duration_ms // 0')
session_sec=$((session_ms / 1000))
session_hrs=$((session_sec / 3600))
session_mins=$(((session_sec % 3600) / 60))
session_fmt=$(printf "%02d:%02d" "$session_hrs" "$session_mins")

# ccusage에서 블록 타이머 가져오기
block_json=$(bunx ccusage@latest blocks --json --active 2>/dev/null)
remaining=$(echo "$block_json" | jq -r '.blocks[0].projection.remainingMinutes // 0')

# 남은 시간 HH:MM 포맷
rem_hours=$((remaining / 60))
rem_mins=$((remaining % 60))
remaining_fmt=$(printf "%02d:%02d" "$rem_hours" "$rem_mins")

# Git 변경사항 (+/- 라인)
git_diff=$(git diff --shortstat 2>/dev/null)
git_staged=$(git diff --cached --shortstat 2>/dev/null)
insertions=$(echo "$git_diff $git_staged" | grep -oE '[0-9]+ insertion' | awk '{s+=$1} END {print s+0}')
deletions=$(echo "$git_diff $git_staged" | grep -oE '[0-9]+ deletion' | awk '{s+=$1} END {print s+0}')

# 동적 색상 적용
timer_color=$(get_timer_color "$remaining")
ctx_color=$(get_context_color "$ctx_pct")

# 1번째 줄: 폴더 | 브랜치 | git 변경사항 (있을 경우)
folder=$(pwd | xargs basename)
branch=$(git branch --show-current 2>/dev/null || echo 'no-git')

printf "${C_WHITE}📁 %s${C_RESET} | ${C_WHITE}🌿 %s${C_RESET}" "$folder" "$branch"
if [ "$insertions" -gt 0 ] || [ "$deletions" -gt 0 ]; then
  printf " | ✏️ ${C_GREEN}+%s${C_RESET} ${C_RED}-%s${C_RESET}" "$insertions" "$deletions"
fi
printf '\n'

# 2번째 줄: 세션 시간 | 블록 타이머 | 컨텍스트
printf "${C_WHITE}⏱️ %s${C_RESET} | ${timer_color}🕰️ %s left${C_RESET} | ${ctx_color}🧠 %s (%s%%)${C_RESET}\n" \
  "$session_fmt" "$remaining_fmt" "$tokens_fmt" "$ctx_pct"

# 3번째 줄: PR URL (PR이 있을 경우만)
url=$(gh pr view --json url -q .url 2>/dev/null)
if [ -n "$url" ]; then
  # 포맷: musinsa/engagement-frontend#116
  pr_label=$(echo "$url" | sed 's|https://github.com/||; s|/pull/|#|')
  printf "📎 ${C_WHITE}${C_UNDERLINE}\e]8;;%s\e\\%s\e]8;;\e\\${C_RESET}" "$url" "$pr_label"
fi
