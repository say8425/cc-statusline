import { describe, expect, test } from "bun:test";
import {
	FILE_VIEW_KEY,
	readFileView,
	readTreeSide,
	TREE_SIDE_KEY,
} from "../viewer/prefs.ts";

const fake =
	(store: Record<string, string>) =>
	(key: string): string | null =>
		store[key] ?? null;

describe("readTreeSide", () => {
	test("defaults to left when unset", () => {
		expect(readTreeSide(fake({}))).toBe("left");
	});
	test("returns right when stored right", () => {
		expect(readTreeSide(fake({ [TREE_SIDE_KEY]: "right" }))).toBe("right");
	});
	test("falls back to left for unknown value", () => {
		expect(readTreeSide(fake({ [TREE_SIDE_KEY]: "bogus" }))).toBe("left");
	});
});

describe("readFileView", () => {
	test("defaults to tree when unset", () => {
		expect(readFileView(fake({}))).toBe("tree");
	});
	test("returns list only when stored list", () => {
		expect(readFileView(fake({ [FILE_VIEW_KEY]: "list" }))).toBe("list");
	});
	test("falls back to tree for unknown value", () => {
		expect(readFileView(fake({ [FILE_VIEW_KEY]: "bogus" }))).toBe("tree");
	});
});
