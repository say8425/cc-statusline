#!/usr/bin/env bun

import { $ } from "bun";
import { readdir, stat } from "fs/promises";
import { join } from "path";
import {
  loadSessionData,
  loadSessionBlockData,
} from "ccusage/data-loader";

// TrueColor 색상 정의
const C = {
  RESET: "\x1b[0m",
  CYAN: "\x1b[38;2;0;255;255m",
  MAGENTA: "\x1b[38;2;255;100;200m",
  GREEN: "\x1b[38;2;100;255;100m",
  YELLOW: "\x1b[38;2;255;220;100m",
  RED: "\x1b[38;2;255;100;100m",
  BLUE: "\x1b[38;2;100;150;255m",
  WHITE: "\x1b[38;2;200;200;200m",
  UNDERLINE: "\x1b[4m",
};

// 동적 색상 함수
function getTimerColor(mins: number): string {
  if (mins > 10) return C.WHITE;
  if (mins > 1) return C.YELLOW;
  return C.RED;
}

function getContextColor(pct: number): string {
  if (pct < 50) return C.WHITE;
  if (pct < 80) return C.YELLOW;
  return C.RED;
}

// 숫자 포맷팅 (천 단위 콤마)
function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// 시간 포맷팅 (HH:MM)
function formatTime(hours: number, mins: number): string {
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

// stdin에서 JSON 읽기
async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// 가장 최근 수정된 transcript 파일 찾기
async function findLatestTranscript(projectDir: string): Promise<string | null> {
  try {
    const files = await readdir(projectDir);
    const jsonlFiles = files.filter(
      (f) => f.endsWith(".jsonl") && !f.startsWith("agent-")
    );

    if (jsonlFiles.length === 0) return null;

    let latestFile = "";
    let latestMtime = 0;

    for (const file of jsonlFiles) {
      const filePath = join(projectDir, file);
      const fileStat = await stat(filePath);
      if (fileStat.mtimeMs > latestMtime) {
        latestMtime = fileStat.mtimeMs;
        latestFile = filePath;
      }
    }

    return latestFile || null;
  } catch {
    return null;
  }
}

// 직접 transcript 파싱하여 context 계산 (캐싱 없이 즉시 반영)
async function parseContextFromTranscript(
  transcriptPath: string
): Promise<{ inputTokens: number; percentage: number } | null> {
  try {
    const file = Bun.file(transcriptPath);
    const content = await file.text();
    const lines = content.trim().split("\n").reverse();

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        // assistant 메시지의 usage 찾기
        if (entry.type === "assistant" && entry.message?.usage) {
          const usage = entry.message.usage;
          const inputTokens =
            (usage.input_tokens || 0) +
            (usage.cache_read_input_tokens || 0) +
            (usage.cache_creation_input_tokens || 0);
          // 200k context window, 80% usable
          const contextLimit = 160000;
          const percentage = Math.round((inputTokens / contextLimit) * 100);
          return { inputTokens, percentage };
        }
      } catch {
        continue;
      }
    }
    return { inputTokens: 0, percentage: 0 };
  } catch {
    return null;
  }
}

// Git 변경사항 가져오기
async function getGitChanges(): Promise<{ insertions: number; deletions: number }> {
  try {
    const diffResult = await $`git diff --shortstat 2>/dev/null`.text();
    const stagedResult = await $`git diff --cached --shortstat 2>/dev/null`.text();
    const combined = diffResult + " " + stagedResult;

    const insertionMatch = combined.match(/(\d+) insertion/g);
    const deletionMatch = combined.match(/(\d+) deletion/g);

    const insertions = insertionMatch
      ? insertionMatch.reduce((sum, m) => sum + parseInt(m), 0)
      : 0;
    const deletions = deletionMatch
      ? deletionMatch.reduce((sum, m) => sum + parseInt(m), 0)
      : 0;

    return { insertions, deletions };
  } catch {
    return { insertions: 0, deletions: 0 };
  }
}

// PR URL 가져오기
async function getPrUrl(): Promise<string | null> {
  try {
    const result = await $`gh pr view --json url -q .url 2>/dev/null`.text();
    return result.trim() || null;
  } catch {
    return null;
  }
}

// 메인 함수
async function main() {
  // 1. stdin에서 Claude Code JSON 읽기
  const claudeJson = JSON.parse(await readStdin());

  // 2. 기본 정보
  const cwd = process.cwd();
  const folder = cwd.split("/").pop() || "";
  const sessionId = cwd.replace(/[/.]/g, "-");

  // 3. 가장 최근 transcript 파일 찾기 (compact/clear 후 즉시 반영)
  const projectDir = join(
    process.env.HOME || "",
    ".claude",
    "projects",
    sessionId
  );
  const transcriptPath = await findLatestTranscript(projectDir);

  // 4. 세션 시간 계산
  const sessionMs = claudeJson.cost?.total_duration_ms || 0;
  const sessionSec = Math.floor(sessionMs / 1000);
  const sessionHrs = Math.floor(sessionSec / 3600);
  const sessionMins = Math.floor((sessionSec % 3600) / 60);

  // 5. 병렬로 데이터 수집
  const [contextResult, sessions, blocks, gitChanges, branch, prUrl] =
    await Promise.all([
      transcriptPath
        ? parseContextFromTranscript(transcriptPath)
        : Promise.resolve(null),
      loadSessionData({ offline: true }),
      loadSessionBlockData({ offline: true }),
      getGitChanges(),
      $`git branch --show-current 2>/dev/null`.text().catch(() => "no-git"),
      getPrUrl(),
    ]);

  // 6. 현재 세션 토큰 찾기
  const currentSession = Array.isArray(sessions)
    ? sessions.find((s: any) => s.sessionId === sessionId)
    : null;
  const totalTokens =
    (currentSession?.inputTokens || 0) +
    (currentSession?.outputTokens || 0) +
    (currentSession?.cacheCreationTokens || 0) +
    (currentSession?.cacheReadTokens || 0);

  // 7. 활성 블록에서 남은 시간 계산
  const activeBlock = Array.isArray(blocks)
    ? blocks.find((b: any) => b.isActive)
    : null;

  let remainingMins = 0;
  if (activeBlock?.endTime) {
    const endTime = new Date(activeBlock.endTime).getTime();
    const now = Date.now();
    remainingMins = Math.max(0, Math.floor((endTime - now) / 60000));
  }

  const remHours = Math.floor(remainingMins / 60);
  const remMins = remainingMins % 60;

  // 8. Context 정보
  const contextTokens = contextResult?.inputTokens || 0;
  const contextPct = contextResult?.percentage || 0;

  // 9. 색상 결정
  const timerColor = getTimerColor(remainingMins);
  const ctxColor = getContextColor(contextPct);

  // 10. 출력
  // 1번째 줄: 폴더 | 브랜치 | git 변경사항
  let line1 = `${C.WHITE}📁 ${folder}${C.RESET} | ${C.WHITE}🌿 ${branch.trim()}${C.RESET}`;
  if (gitChanges.insertions > 0 || gitChanges.deletions > 0) {
    line1 += ` | ✏️ ${C.GREEN}+${gitChanges.insertions}${C.RESET} ${C.RED}-${gitChanges.deletions}${C.RESET}`;
  }
  console.log(line1);

  // 2번째 줄: 세션 시간 | 블록 타이머 | 컨텍스트
  console.log(
    `${C.WHITE}⏱️ ${formatTime(sessionHrs, sessionMins)}${C.RESET} | ` +
      `${timerColor}🕰️ ${formatTime(remHours, remMins)} left${C.RESET} | ` +
      `${ctxColor}🧠 ${formatNumber(totalTokens)} (${contextPct}%)${C.RESET}`
  );

  // 3번째 줄: PR URL (있을 경우만)
  if (prUrl) {
    const prLabel = prUrl
      .replace("https://github.com/", "")
      .replace("/pull/", "#");
    // OSC 8 하이퍼링크
    console.log(
      `📎 ${C.WHITE}${C.UNDERLINE}\x1b]8;;${prUrl}\x07${prLabel}\x1b]8;;\x07${C.RESET}`
    );
  }
}

main().catch(console.error);
