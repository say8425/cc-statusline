import { describe, expect, test } from "bun:test";
import { parseCredentialString } from "../usage/token.ts";

const VALID_JSON = '{"claudeAiOauth":{"accessToken":"tok"}}';

describe("parseCredentialString", () => {
	test("정상 JSON → accessToken 추출", () => {
		expect(parseCredentialString(VALID_JSON)).toBe("tok");
	});

	test("hex-encoded JSON → accessToken 추출", () => {
		const hex = Buffer.from(VALID_JSON, "utf-8").toString("hex");
		expect(parseCredentialString(hex)).toBe("tok");
	});

	test("hex + binary prefix (\\x07) → accessToken 추출", () => {
		const prefixed = `\x07${VALID_JSON}`;
		const hex = Buffer.from(prefixed, "utf-8").toString("hex");
		expect(parseCredentialString(hex)).toBe("tok");
	});

	test("claudeAiOauth key 없음 → null", () => {
		expect(parseCredentialString('{"other":"data"}')).toBeNull();
	});

	test("빈 문자열 → null", () => {
		expect(parseCredentialString("")).toBeNull();
	});

	test("공백만 있는 문자열 → null", () => {
		expect(parseCredentialString("   ")).toBeNull();
	});

	test("잘못된 입력 (JSON도 hex도 아님) → null", () => {
		expect(parseCredentialString("not-json-or-hex")).toBeNull();
	});

	test("앞뒤 공백 포함 JSON → accessToken 추출", () => {
		expect(parseCredentialString(`  ${VALID_JSON}  `)).toBe("tok");
	});

	test("accessToken 필드 없음 → null", () => {
		expect(
			parseCredentialString('{"claudeAiOauth":{"refreshToken":"rt"}}'),
		).toBeNull();
	});
});
