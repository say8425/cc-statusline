import { describe, expect, test } from "bun:test";
import {
	FLATTEN_KEY,
	readFlatten,
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

describe("readFlatten", () => {
	test("defaults to on when unset", () => {
		expect(readFlatten(fake({}))).toBe(true);
	});
	test("off only when stored 0", () => {
		expect(readFlatten(fake({ [FLATTEN_KEY]: "0" }))).toBe(false);
	});
	test("on when stored 1", () => {
		expect(readFlatten(fake({ [FLATTEN_KEY]: "1" }))).toBe(true);
	});
});
