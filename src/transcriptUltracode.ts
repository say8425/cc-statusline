import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getCacheDir } from "./diff-server/config.ts";

// 세션 단위 ultracode 상태는 stdin에도 settings에도 없다. CLI 2.1.284+의
// `/effort ultracode`는 "this session only"라 settings에 쓰지 않고(공식 문서:
// "Claude Code reads this key but never writes it"), ultracode는 xhigh가 아닌
// effort에서도 켜진다. 대신 Claude Code가 ultracode를 켜고 끌 때마다 transcript
// JSONL에 attachment 줄을 남긴다(2.1.308~2.1.327 실측):
//   {"type":"attachment","attachment":{"type":"ultra_effort_enter","reminderType":"full"|"sparse"},...}
//   {"type":"attachment","attachment":{"type":"ultra_effort_exit"},...}
// enter는 켜져 있는 동안 주기적으로(sparse) 다시 붙고 exit는 꺼질 때 한 번 붙으므로,
// 마지막 표시가 현재 상태다. 두 표시 모두 다음 API 요청 때 기록되므로 토글 직후
// 첫 프롬프트를 보내기 전까지는 배지가 한 박자 늦다.
//
// 바늘은 따옴표가 이스케이프되지 않은 원문 그대로다. 도구 출력 등 문자열 안에
// 인용된 같은 텍스트는 JSONL에서 `\"`로 이스케이프되므로 걸리지 않는다
// (전 transcript 실측: 원문 바늘 678건이 전부 실제 attachment 줄).
const NEEDLE = Buffer.from('"attachment":{"type":"ultra_effort_');
const ENTER = Buffer.from('enter"');
const EXIT = Buffer.from('exit"');
const NEWLINE = 0x0a;

// 처음 보는 transcript는 끝에서 이만큼만 읽는다 (수백 MB짜리도 있다).
// 이후 틱은 저장한 오프셋부터 새로 붙은 바이트만 읽는다.
export const INITIAL_SCAN_BYTES = 32 * 1024 * 1024;

// true = enter, false = exit, null = 표시 없음
export type UltracodeMarker = boolean | null;

interface ScanState {
	path: string;
	offset: number;
	marker: UltracodeMarker;
}

// 버퍼에서 마지막 ultracode 표시를 찾는다 (순수 함수)
export const lastUltracodeMarker = (buf: Buffer): UltracodeMarker => {
	let idx = buf.lastIndexOf(NEEDLE);
	while (idx !== -1) {
		const rest = buf.subarray(idx + NEEDLE.length);
		if (rest.subarray(0, ENTER.length).equals(ENTER)) return true;
		if (rest.subarray(0, EXIT.length).equals(EXIT)) return false;
		idx = idx === 0 ? -1 : buf.lastIndexOf(NEEDLE, idx - 1);
	}
	return null;
};

export const ultracodeStateDir = (): string => join(getCacheDir(), "ultracode");

const statePathFor = (stateDir: string, transcriptPath: string): string => {
	const key = createHash("sha256").update(transcriptPath).digest("hex");
	return join(stateDir, `${key.slice(0, 32)}.json`);
};

const loadState = async (
	file: string,
	transcriptPath: string,
): Promise<ScanState | null> => {
	try {
		const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"path" in parsed &&
			parsed.path === transcriptPath &&
			"offset" in parsed &&
			typeof parsed.offset === "number" &&
			"marker" in parsed &&
			(typeof parsed.marker === "boolean" || parsed.marker === null)
		) {
			return {
				path: transcriptPath,
				offset: parsed.offset,
				marker: parsed.marker,
			};
		}
	} catch {
		// 상태 없음·깨짐 — 처음부터 스캔
	}
	return null;
};

// 여러 statusline 프로세스가 겹쳐 돌 수 있어 tmp → rename으로 원자적으로 쓴다
const saveState = async (file: string, state: ScanState): Promise<void> => {
	try {
		await mkdir(join(file, ".."), { recursive: true });
		const tmp = `${file}.${process.pid}.tmp`;
		await writeFile(tmp, JSON.stringify(state));
		await rename(tmp, file);
	} catch {
		// 저장 실패는 다음 틱의 재스캔으로 이어질 뿐이다
	}
};

interface ReadResult {
	buf: Buffer;
	start: number;
	// 저장한 오프셋에서 이어 읽었는지 (false면 끝부분 창을 새로 읽은 것)
	resumed: boolean;
}

const readRange = async (
	path: string,
	from: number | null,
): Promise<ReadResult> => {
	const handle = await open(path, "r");
	try {
		const { size } = await handle.stat();
		// 오프셋이 파일보다 크면 파일이 다시 쓰인 것 — 처음 보는 파일처럼 다룬다
		const resumed = from !== null && from <= size;
		const start = resumed ? from : Math.max(0, size - INITIAL_SCAN_BYTES);
		const buf = Buffer.allocUnsafe(size - start);
		const { bytesRead } = await handle.read(buf, 0, buf.length, start);
		return { buf: buf.subarray(0, bytesRead), start, resumed };
	} finally {
		await handle.close();
	}
};

// transcript에서 현재 세션의 ultracode 상태를 읽는다. 표시가 없거나 읽을 수
// 없으면 null을 돌려 호출부가 settings 값으로 폴백하게 한다. 절대 throw하지 않는다.
export const readTranscriptUltracode = async (
	transcriptPath: string | undefined,
	stateDir: string = ultracodeStateDir(),
): Promise<UltracodeMarker> => {
	if (!transcriptPath) return null;
	try {
		const stateFile = statePathFor(stateDir, transcriptPath);
		const prev = await loadState(stateFile, transcriptPath);
		const { buf, start, resumed } = await readRange(
			transcriptPath,
			prev?.offset ?? null,
		);
		// 마지막 줄은 아직 쓰는 중일 수 있으니 완결된 줄까지만 소비한다
		const complete = buf.subarray(0, buf.lastIndexOf(NEWLINE) + 1);
		const carried = resumed ? (prev?.marker ?? null) : null;
		const marker = lastUltracodeMarker(complete) ?? carried;
		const offset = start + complete.length;
		if (prev?.offset !== offset || prev?.marker !== marker) {
			await saveState(stateFile, { path: transcriptPath, offset, marker });
		}
		return marker;
	} catch {
		return null;
	}
};
