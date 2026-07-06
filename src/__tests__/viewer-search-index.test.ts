import { describe, expect, test } from "bun:test";
import type { FileDiffMetadata } from "@pierre/diffs";
import { buildRows, findMatches } from "../viewer/search/searchIndex.ts";

// 최소 fixture: buildRows가 읽는 필드만 채운다 (라이브러리 런타임 미사용).
// 새 파일 5줄, 옛 파일 5줄. 3번째 줄이 REMOVED→ADDED로 교체.
// 1번째 줄은 hunk 앞 collapsed context, 5번째 줄은 trailing context.
const fixture = (): FileDiffMetadata => {
	const additionLines = [
		"import a",
		"const x = 1",
		"ADDED foo",
		"const y = 2",
		"tail foo",
	];
	const deletionLines = [
		"import a",
		"const x = 1",
		"REMOVED foo",
		"const y = 2",
		"tail foo",
	];
	const hunks = [
		{
			additionStart: 2, // 새 파일 2번째 줄(=index1)부터 hunk 표시
			hunkContent: [
				{
					type: "context",
					additionLineIndex: 1,
					deletionLineIndex: 1,
					lines: 1,
				},
				{
					type: "change",
					deletionLineIndex: 2,
					deletions: 1,
					additionLineIndex: 2,
					additions: 1,
				},
				{
					type: "context",
					additionLineIndex: 3,
					deletionLineIndex: 3,
					lines: 1,
				},
			],
		},
	];
	return { additionLines, deletionLines, hunks } as unknown as FileDiffMetadata;
};

describe("buildRows", () => {
	test("unified 순서로 재구성 (collapsed 앞/삭제/추가/trailing, context 1회)", () => {
		expect(buildRows(fixture())).toEqual([
			{ side: "additions", lineNumber: 1, text: "import a" },
			{ side: "additions", lineNumber: 2, text: "const x = 1" },
			{ side: "deletions", lineNumber: 3, text: "REMOVED foo" },
			{ side: "additions", lineNumber: 3, text: "ADDED foo" },
			{ side: "additions", lineNumber: 4, text: "const y = 2" },
			{ side: "additions", lineNumber: 5, text: "tail foo" },
		]);
	});
});

describe("findMatches", () => {
	test("삭제 줄 포함, 방출 순서, 정확한 열/줄번호/side", () => {
		const files = [{ fileId: "f.ts", fileDiff: fixture() }];
		expect(findMatches(files, "foo")).toEqual([
			{
				fileId: "f.ts",
				side: "deletions",
				lineNumber: 3,
				column: 8,
				length: 3,
			},
			{
				fileId: "f.ts",
				side: "additions",
				lineNumber: 3,
				column: 6,
				length: 3,
			},
			{
				fileId: "f.ts",
				side: "additions",
				lineNumber: 5,
				column: 5,
				length: 3,
			},
		]);
	});
	test("대소문자 무시", () => {
		const files = [{ fileId: "f.ts", fileDiff: fixture() }];
		expect(findMatches(files, "FOO").length).toBe(3);
	});
	test("빈 검색어 → []", () => {
		expect(findMatches([{ fileId: "f.ts", fileDiff: fixture() }], "")).toEqual(
			[],
		);
	});
	test("무매치 → []", () => {
		expect(
			findMatches([{ fileId: "f.ts", fileDiff: fixture() }], "zzz"),
		).toEqual([]);
	});
	test("여러 파일은 files 순서대로", () => {
		const files = [
			{ fileId: "a.ts", fileDiff: fixture() },
			{ fileId: "b.ts", fileDiff: fixture() },
		];
		const ids = findMatches(files, "foo").map((m) => m.fileId);
		expect(ids).toEqual(["a.ts", "a.ts", "a.ts", "b.ts", "b.ts", "b.ts"]);
	});
});
