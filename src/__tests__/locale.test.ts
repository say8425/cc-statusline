import { describe, expect, test } from "bun:test";
import { resolveLocale } from "../format/resolveLocale.ts";

describe("resolveLocale", () => {
	test("returns null when no locale env var is set", () => {
		expect(resolveLocale({})).toBe(null);
	});

	test("converts a POSIX LANG value to a BCP-47 tag", () => {
		expect(resolveLocale({ LANG: "ko_KR.UTF-8" })).toBe("ko-KR");
	});

	test("drops the encoding suffix", () => {
		expect(resolveLocale({ LANG: "en_US.UTF-8" })).toBe("en-US");
	});

	test("drops the @modifier suffix", () => {
		expect(resolveLocale({ LANG: "de_DE.UTF-8@euro" })).toBe("de-DE");
	});

	test("accepts a bare language without a region", () => {
		expect(resolveLocale({ LANG: "ja" })).toBe("ja");
	});

	test("prefers LC_ALL over LC_TIME and LANG", () => {
		expect(
			resolveLocale({
				LC_ALL: "ja_JP.UTF-8",
				LC_TIME: "de_DE.UTF-8",
				LANG: "ko_KR.UTF-8",
			}),
		).toBe("ja-JP");
	});

	test("prefers LC_TIME over LANG", () => {
		expect(resolveLocale({ LC_TIME: "de_DE.UTF-8", LANG: "ko_KR.UTF-8" })).toBe(
			"de-DE",
		);
	});

	test("skips an empty value and falls through to the next key", () => {
		expect(resolveLocale({ LC_ALL: "", LANG: "ko_KR.UTF-8" })).toBe("ko-KR");
	});

	test("treats a whitespace-only value the same as an empty one", () => {
		// 공백만 있는 값도 "미설정"이라 다음 키로 넘어간다 — 빈 문자열과 갈리면
		// 같은 뜻의 두 값이 다르게 동작한다
		expect(resolveLocale({ LC_ALL: "   ", LANG: "ko_KR.UTF-8" })).toBe("ko-KR");
	});

	test("treats C and POSIX as no locale at all", () => {
		expect(resolveLocale({ LANG: "C" })).toBe(null);
		expect(resolveLocale({ LANG: "C.UTF-8" })).toBe(null);
		expect(resolveLocale({ LANG: "POSIX" })).toBe(null);
	});

	test("does not fall through when the winning key is unusable", () => {
		// POSIX 우선순위상 LC_ALL=C는 "지역화하지 말라"는 명시적 지시다 —
		// 뒤에 LANG이 있어도 무시하고 Intl 기본값(null)으로 간다
		expect(resolveLocale({ LC_ALL: "C", LANG: "ko_KR.UTF-8" })).toBe(null);
	});

	test("returns null for a structurally invalid tag", () => {
		expect(resolveLocale({ LANG: "not a locale" })).toBe(null);
	});
});
