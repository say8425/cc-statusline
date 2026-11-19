import { createHash } from "node:crypto";
import {
	type FileHandle,
	mkdir,
	open,
	readFile,
	rename,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { getCacheDir } from "./diff-server/config.ts";

// 세션 단위 ultracode 상태는 stdin에도 settings에도 없다. CLI 2.1.284+의
// `/effort ultracode`는 "this session only"라 settings에 쓰지 않고(공식 문서:
// "Claude Code reads this key but never writes it"), ultracode는 xhigh가 아닌
// effort에서도 켜진다. 대신 Claude Code가 ultracode를 켜고 끌 때마다 transcript
// JSONL에 attachment 줄을 남긴다(2.1.170~2.1.327 실측):
//   {"type":"attachment","attachment":{"type":"ultra_effort_enter","reminderType":"full"|"sparse"},...}
//   {"type":"attachment","attachment":{"type":"ultra_effort_exit"},...}
// enter는 켜져 있는 동안 주기적으로(sparse) 다시 붙고 exit는 꺼질 때 한 번 붙으므로,
// 마지막 표시가 현재 상태다. 두 표시 모두 다음 API 요청 때 기록되므로 토글 직후
// 첫 프롬프트를 보내기 전까지는 배지가 한 박자 늦다.
//
// 바늘은 따옴표가 이스케이프되지 않은 원문 그대로다. 도구 출력 등 문자열 안에
// 인용된 같은 텍스트는 JSONL에서 `\"`로 이스케이프되므로 걸리지 않는다
// (전 transcript 실측: 원문 바늘 678건이 전부 실제 attachment 줄). 대신 attachment
// 객체의 키 순서(`type`이 첫 키)에 기댄다.
const NEEDLE = Buffer.from('"attachment":{"type":"ultra_effort_');
const ENTER = Buffer.from('enter"');
const EXIT = Buffer.from('exit"');
const NEWLINE = 0x0a;
// 청크 경계에 걸친 바늘을 놓치지 않도록 이웃 청크와 겹쳐 읽는 길이
const OVERLAP = NEEDLE.length + ENTER.length;

export interface ScanLimits {
	// 한 번에 읽는 크기
	chunkBytes: number;
	// 끝에서 거꾸로 훑는 최대 거리. transcript는 수백 MB까지 커지고(실측 최대
	// 812MB) enter 표시 간격도 최대 96MB까지 벌어지므로, 처음 보는 파일은 이만큼까지
	// 거슬러 올라가 본다. 결과를 저장하므로 transcript당 한 번만 든다.
	maxBackscanBytes: number;
}

export const DEFAULT_SCAN_LIMITS: ScanLimits = {
	chunkBytes: 4 * 1024 * 1024,
	maxBackscanBytes: 256 * 1024 * 1024,
};

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

const isMarker = (value: unknown): value is UltracodeMarker =>
	typeof value === "boolean" || value === null;

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
			Number.isSafeInteger(parsed.offset) &&
			(parsed.offset as number) >= 0 &&
			"marker" in parsed &&
			isMarker(parsed.marker)
		) {
			return {
				path: transcriptPath,
				offset: parsed.offset as number,
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

const readAt = async (
	handle: FileHandle,
	from: number,
	to: number,
): Promise<Buffer> => {
	const buf = Buffer.allocUnsafe(Math.max(0, to - from));
	const { bytesRead } = await handle.read(buf, 0, buf.length, from);
	return buf.subarray(0, bytesRead);
};

// 완결된 줄의 끝(마지막 줄바꿈 다음 바이트). 마지막 줄은 아직 쓰는 중일 수 있어
// 소비하지 않는다. 마지막 청크에 줄바꿈이 없으면 그 청크 시작에서 멈춘다.
const completeEnd = async (
	handle: FileHandle,
	floor: number,
	size: number,
	limits: ScanLimits,
): Promise<number> => {
	const lo = Math.max(floor, size - limits.chunkBytes);
	const tail = await readAt(handle, lo, size);
	return lo + tail.lastIndexOf(NEWLINE) + 1;
};

// [floor, end) 구간을 끝에서부터 청크 단위로 거꾸로 훑어 마지막 표시를 찾는다.
// 평소 틱은 floor(저장한 오프셋)가 end 바로 앞이라 청크 하나로 끝난다.
const scanBackward = async (
	handle: FileHandle,
	floor: number,
	end: number,
	limits: ScanLimits,
): Promise<UltracodeMarker> => {
	let hi = end;
	while (hi > floor) {
		const lo = Math.max(floor, hi - limits.chunkBytes);
		const found = lastUltracodeMarker(
			// oxlint-disable-next-line no-await-in-loop -- 표시를 찾으면 멈춰야 해 순차로 읽는다
			await readAt(handle, lo, Math.min(end, hi + OVERLAP)),
		);
		if (found !== null) return found;
		hi = lo;
	}
	return null;
};

// transcript에서 현재 세션의 ultracode 상태를 읽는다. 표시가 없거나 읽을 수
// 없으면 null을 돌려 호출부가 settings 값으로 폴백하게 한다. 절대 throw하지 않는다.
export const readTranscriptUltracode = async (
	transcriptPath: string | undefined,
	stateDir: string = ultracodeStateDir(),
	limits: ScanLimits = DEFAULT_SCAN_LIMITS,
): Promise<UltracodeMarker> => {
	if (!transcriptPath) return null;
	try {
		const stateFile = statePathFor(stateDir, transcriptPath);
		const loaded = await loadState(stateFile, transcriptPath);
		const handle = await open(transcriptPath, "r");
		try {
			const { size } = await handle.stat();
			// 오프셋이 파일보다 크면 파일이 다시 쓰인 것 — 처음 보는 파일처럼 다룬다
			const prev = loaded && loaded.offset <= size ? loaded : null;
			const floor = Math.max(prev?.offset ?? 0, size - limits.maxBackscanBytes);
			const end = await completeEnd(handle, floor, size, limits);
			// 표시가 없으면 이전 상태를 이어 쓴다. 오프셋이 한도보다 더 뒤처져 중간을
			// 건너뛴 경우에도 이전 상태가 가장 그럴듯한 추정이다
			const marker =
				(await scanBackward(handle, floor, end, limits)) ??
				prev?.marker ??
				null;
			if (loaded?.offset !== end || loaded?.marker !== marker) {
				await saveState(stateFile, {
					path: transcriptPath,
					offset: end,
					marker,
				});
			}
			return marker;
		} finally {
			await handle.close();
		}
	} catch {
		return null;
	}
};
