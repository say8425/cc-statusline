import { describe, expect, test } from "bun:test";
import { compareTreePaths, sortFilesLikeTree } from "../viewer/fileOrder.ts";

const names = (paths: string[]): string[] =>
	sortFilesLikeTree(paths.map((name) => ({ name }))).map((f) => f.name);

describe("sortFilesLikeTree", () => {
	test("directories sort before files at every level (like the file tree)", () => {
		expect(
			names([
				"README.md",
				"src/index.ts",
				"biome.json",
				"docs/a.png",
				"src/viewer/main.ts",
			]),
		).toEqual([
			"docs/a.png",
			"src/viewer/main.ts",
			"src/index.ts",
			"biome.json",
			"README.md",
		]);
	});

	test("case-insensitive alphabetical within a level", () => {
		expect(
			names(["README.md", "biome.json", "bun.lock", "package.json"]),
		).toEqual(["biome.json", "bun.lock", "package.json", "README.md"]);
	});

	test("natural sort for numbered names", () => {
		expect(
			names(["shots/img10.png", "shots/img2.png", "shots/img1.png"]),
		).toEqual(["shots/img1.png", "shots/img2.png", "shots/img10.png"]);
	});

	test("same lowercase falls back to raw comparison (stable, deterministic)", () => {
		expect(names(["a.txt", "A.txt"])).toEqual(["A.txt", "a.txt"]);
	});

	test("input order does not matter (untracked appended last still interleaves)", () => {
		expect(names(["zz.txt", "docs/new.png", "aa.txt", "docs/old.png"])).toEqual(
			["docs/new.png", "docs/old.png", "aa.txt", "zz.txt"],
		);
	});
});

describe("compareTreePaths", () => {
	test("deeper hierarchy compared segment by segment", () => {
		expect(compareTreePaths("src/a/b.ts", "src/a/b.ts")).toBe(0);
		expect(
			compareTreePaths("src/__tests__/x.ts", "src/diff-server/y.ts"),
		).toBeLessThan(0);
		expect(compareTreePaths("src/viewer/z.ts", "src/index.ts")).toBeLessThan(0);
	});
});
