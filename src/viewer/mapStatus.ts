import type { ChangeTypes } from "@pierre/diffs";
import type { GitStatus } from "@pierre/trees";

export function changeTypeToGitStatus(type: ChangeTypes): GitStatus {
	switch (type) {
		case "new":
			return "added";
		case "deleted":
			return "deleted";
		case "rename-pure":
		case "rename-changed":
			return "renamed";
		default:
			return "modified";
	}
}
