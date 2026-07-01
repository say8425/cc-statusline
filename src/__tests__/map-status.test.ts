import { describe, expect, test } from "bun:test";
import { changeTypeToGitStatus } from "../viewer/mapStatus.ts";

describe("changeTypeToGitStatus", () => {
	test("maps every ChangeType", () => {
		expect(changeTypeToGitStatus("new")).toBe("added");
		expect(changeTypeToGitStatus("deleted")).toBe("deleted");
		expect(changeTypeToGitStatus("rename-pure")).toBe("renamed");
		expect(changeTypeToGitStatus("rename-changed")).toBe("renamed");
		expect(changeTypeToGitStatus("change")).toBe("modified");
	});
});
