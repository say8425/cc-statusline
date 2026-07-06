import { describe, expect, test } from "bun:test";
import {
	filterFlatFiles,
	type FlatListFile,
	flatFileStatusMeta,
} from "../viewer/flatList.ts";

const files: FlatListFile[] = [
	{ path: "docs/README.ko.md", status: "modified" },
	{ path: "src/render.ts", status: "modified" },
	{ path: "src/ultracode.ts", status: "added" },
	{ path: "old/gone.ts", status: "deleted" },
];

describe("filterFlatFiles", () => {
	test("returns all files for an empty query", () => {
		expect(filterFlatFiles(files, "")).toEqual(files);
	});

	test("returns all files for a whitespace-only query", () => {
		expect(filterFlatFiles(files, "   ")).toEqual(files);
	});

	test("matches a case-insensitive substring anywhere in the path", () => {
		expect(filterFlatFiles(files, "README")).toEqual([
			{ path: "docs/README.ko.md", status: "modified" },
		]);
		expect(filterFlatFiles(files, "readme")).toEqual([
			{ path: "docs/README.ko.md", status: "modified" },
		]);
	});

	test("matches on the directory portion of the path", () => {
		expect(filterFlatFiles(files, "src/")).toEqual([
			{ path: "src/render.ts", status: "modified" },
			{ path: "src/ultracode.ts", status: "added" },
		]);
	});

	test("preserves input order", () => {
		expect(filterFlatFiles(files, ".ts").map((f) => f.path)).toEqual([
			"src/render.ts",
			"src/ultracode.ts",
			"old/gone.ts",
		]);
	});

	test("returns an empty array when nothing matches", () => {
		expect(filterFlatFiles(files, "nonexistent")).toEqual([]);
	});
});

describe("flatFileStatusMeta", () => {
	test("maps each status to a non-empty letter and color", () => {
		for (const status of [
			"added",
			"deleted",
			"modified",
			"renamed",
			"untracked",
		] as const) {
			const meta = flatFileStatusMeta(status);
			expect(meta.letter.length).toBeGreaterThan(0);
			expect(meta.color).toMatch(/^#[0-9a-fA-F]{6}$/);
			expect(meta.label.length).toBeGreaterThan(0);
		}
	});

	test("uses distinct letters for add / modify / delete", () => {
		expect(flatFileStatusMeta("added").letter).toBe("A");
		expect(flatFileStatusMeta("modified").letter).toBe("M");
		expect(flatFileStatusMeta("deleted").letter).toBe("D");
		expect(flatFileStatusMeta("renamed").letter).toBe("R");
		expect(flatFileStatusMeta("untracked").letter).toBe("U");
	});
});
