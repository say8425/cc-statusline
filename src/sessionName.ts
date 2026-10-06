import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

type Env = Record<string, string | undefined>;

// Claude Code가 실행 중인 세션마다 쓰는 레지스트리 디렉터리. CLAUDE_CONFIG_DIR을
// 따르며, 각 파일(<pid>.json)에 sessionId와 다른 세션이 SendMessage·@멘션에 쓰는
// 주소 `name`이 들어 있다 (CLI 2.1.289 실측).
export const sessionsDir = (
	env: Env = process.env,
	homeDir: string = homedir(),
): string =>
	join(env.CLAUDE_CONFIG_DIR || join(homeDir, ".claude"), "sessions");

interface SessionEntry {
	name: string;
	updatedAt: number;
}

const parseEntry = (
	content: string,
	sessionId: string,
): SessionEntry | null => {
	try {
		const parsed: unknown = JSON.parse(content);
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			!("sessionId" in parsed) ||
			parsed.sessionId !== sessionId ||
			!("name" in parsed) ||
			typeof parsed.name !== "string"
		) {
			return null;
		}
		const name = parsed.name.trim();
		if (!name) return null;
		const updatedAt =
			"updatedAt" in parsed && typeof parsed.updatedAt === "number"
				? parsed.updatedAt
				: 0;
		return { name, updatedAt };
	} catch {
		return null;
	}
};

// 멘션 가능한 세션 이름을 읽는다. stdin의 공식 `session_name`은 이름이 없을 때 AI가
// 만든 제목을 담는데 그 제목은 멘션 주소가 아니고, 기본 표시 이름(`penguin-01` 등)은
// 아예 담지 않는다 — 그래서 문서화되지 않은 레지스트리를 직접 읽는다. 형식이 바뀌거나
// 읽기에 실패하면 null을 돌려 세그먼트를 숨긴다 (300ms 핫 패스에서 throw 금지).
export const readSessionName = async (
	sessionId: string | undefined,
	dir: string = sessionsDir(),
): Promise<string | null> => {
	if (!sessionId) return null;
	let files: string[];
	try {
		files = (await readdir(dir)).filter((file) => file.endsWith(".json"));
	} catch {
		return null;
	}
	const contents = await Promise.all(
		files.map((file) => readFile(join(dir, file), "utf8").catch(() => null)),
	);
	const matches = contents
		.map((content) =>
			content === null ? null : parseEntry(content, sessionId),
		)
		.filter((entry): entry is SessionEntry => entry !== null);
	if (matches.length === 0) return null;
	// 같은 sessionId가 여럿이면(재개 등으로 남은 파일) 가장 최근 갱신된 항목을 쓴다
	return matches.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a)).name;
};
