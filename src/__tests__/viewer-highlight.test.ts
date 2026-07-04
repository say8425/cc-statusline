import { describe, expect, test } from "bun:test";
import { findRanges } from "../viewer/search/highlight.ts";

describe("findRanges", () => {
	test("빈 검색어는 빈 배열", () => {
		expect(findRanges("hello", "")).toEqual([]);
	});
	test("단일 매치", () => {
		expect(findRanges("hello world", "world")).toEqual([
			{ start: 6, length: 5 },
		]);
	});
	test("겹치지 않는 다중 매치", () => {
		expect(findRanges("ababab", "ab")).toEqual([
			{ start: 0, length: 2 },
			{ start: 2, length: 2 },
			{ start: 4, length: 2 },
		]);
	});
	test("대소문자 무시", () => {
		expect(findRanges("Foo FOO foo", "foo")).toEqual([
			{ start: 0, length: 3 },
			{ start: 4, length: 3 },
			{ start: 8, length: 3 },
		]);
	});
	test("겹치는 후보는 겹치지 않게 매치 (aaa/aa → 1개)", () => {
		expect(findRanges("aaa", "aa")).toEqual([{ start: 0, length: 2 }]);
	});
	test("무매치", () => {
		expect(findRanges("hello", "xyz")).toEqual([]);
	});
});
