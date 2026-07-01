import { describe, expect, test } from "bun:test";
import { buildDiffViewerUrl } from "../diff-server/link.ts";

describe("buildDiffViewerUrl", () => {
	test("builds a 127.0.0.1 URL with encoded repo and token", () => {
		const url = buildDiffViewerUrl({
			port: 49573,
			repo: "/Users/me/my project",
			token: "abc123",
		});
		expect(url).toBe(
			"http://127.0.0.1:49573/?repo=%2FUsers%2Fme%2Fmy+project&token=abc123",
		);
	});
});
