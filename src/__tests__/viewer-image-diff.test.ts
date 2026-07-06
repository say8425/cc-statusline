import { describe, expect, test } from "bun:test";
import type { DiffFile } from "../diff-server/diff.ts";
import { imageContentType, isImagePath } from "../diff-server/imageTypes.ts";
import { blobUrl, imageEntries } from "../viewer/imageDiff.ts";

const file = (partial: Partial<DiffFile> & { name: string }): DiffFile => ({
	status: "modified",
	binary: true,
	oldContents: "",
	newContents: "",
	...partial,
});

describe("isImagePath", () => {
	test("true for common raster image extensions (case-insensitive)", () => {
		for (const name of [
			"a.png",
			"b.jpg",
			"c.jpeg",
			"d.gif",
			"e.webp",
			"f.avif",
			"g.bmp",
			"h.ico",
			"dir/UPPER.PNG",
		]) {
			expect(isImagePath(name)).toBe(true);
		}
	});

	test("false for text, svg, and extension-less paths", () => {
		for (const name of ["a.ts", "b.txt", "vector.svg", "Makefile", "png"]) {
			expect(isImagePath(name)).toBe(false);
		}
	});
});

describe("imageContentType", () => {
	test("maps extensions to MIME types with octet-stream fallback", () => {
		expect(imageContentType("x.png")).toBe("image/png");
		expect(imageContentType("x.jpg")).toBe("image/jpeg");
		expect(imageContentType("x.jpeg")).toBe("image/jpeg");
		expect(imageContentType("x.webp")).toBe("image/webp");
		expect(imageContentType("x.gif")).toBe("image/gif");
		expect(imageContentType("x.dat")).toBe("application/octet-stream");
	});
});

describe("imageEntries", () => {
	test("keeps only binary image files and derives sides from status", () => {
		const files: DiffFile[] = [
			file({ name: "docs/a.png", blobVersion: "v1" }),
			file({ name: "new.png", status: "untracked", blobVersion: "v2" }),
			file({ name: "added.png", status: "added", blobVersion: "v3" }),
			file({ name: "gone.png", status: "deleted", blobVersion: "v4" }),
			file({
				name: "moved.png",
				oldName: "old.png",
				status: "renamed",
				blobVersion: "v5",
			}),
			file({ name: "data.bin" }), // binary but not an image
			file({ name: "code.ts", binary: false }), // text
		];
		const entries = imageEntries(files);
		expect(entries.map((e) => e.name)).toEqual([
			"docs/a.png",
			"new.png",
			"added.png",
			"gone.png",
			"moved.png",
		]);
		const byName = new Map(entries.map((e) => [e.name, e]));
		expect(byName.get("docs/a.png")).toMatchObject({
			oldPath: "docs/a.png",
			showOld: true,
			showNew: true,
			version: "v1",
		});
		expect(byName.get("new.png")).toMatchObject({
			showOld: false,
			showNew: true,
		});
		expect(byName.get("added.png")).toMatchObject({
			showOld: false,
			showNew: true,
		});
		expect(byName.get("gone.png")).toMatchObject({
			showOld: true,
			showNew: false,
		});
		expect(byName.get("moved.png")).toMatchObject({
			oldPath: "old.png",
			showOld: true,
			showNew: true,
		});
	});
});

describe("blobUrl", () => {
	test("builds a relative /api/blob URL with encoded params", () => {
		const url = blobUrl({
			repo: "/Users/p/dev/repo",
			token: "tok",
			path: "docs/a b.png",
			side: "old",
			mode: "base",
			version: "v1",
		});
		expect(url.startsWith("/api/blob?")).toBe(true);
		const params = new URLSearchParams(url.slice("/api/blob?".length));
		expect(params.get("repo")).toBe("/Users/p/dev/repo");
		expect(params.get("token")).toBe("tok");
		expect(params.get("path")).toBe("docs/a b.png");
		expect(params.get("side")).toBe("old");
		expect(params.get("mode")).toBe("base");
		expect(params.get("v")).toBe("v1");
	});

	test("omits the version param when absent", () => {
		const url = blobUrl({
			repo: "/r",
			token: "t",
			path: "a.png",
			side: "new",
			mode: "working",
		});
		expect(url).not.toContain("v=");
	});
});
