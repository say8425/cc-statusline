import { describe, expect, test } from "bun:test";
import { parseShortstat } from "../git/shortstat.ts";

describe("parseShortstat", () => {
	test("parses files/insertions/deletions", () => {
		expect(
			parseShortstat(" 3 files changed, 86 insertions(+), 3 deletions(-)"),
		).toEqual({ files: 3, insertions: 86, deletions: 3 });
	});
	test("handles singular and missing parts", () => {
		expect(parseShortstat(" 1 file changed, 1 insertion(+)")).toEqual({
			files: 1,
			insertions: 1,
			deletions: 0,
		});
	});
	test("sums multiple shortstat lines", () => {
		expect(
			parseShortstat(
				" 1 file changed, 2 insertions(+)\n 1 file changed, 3 deletions(-)",
			),
		).toEqual({ files: 2, insertions: 2, deletions: 3 });
	});
	test("empty string yields zeros", () => {
		expect(parseShortstat("")).toEqual({
			files: 0,
			insertions: 0,
			deletions: 0,
		});
	});
});
