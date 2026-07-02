export type TreeSide = "left" | "right";

export const TREE_SIDE_KEY = "cc-statusline:tree-side";
export const FLATTEN_KEY = "cc-statusline:flatten";

type Getter = (key: string) => string | null;

export function readTreeSide(get: Getter): TreeSide {
	return get(TREE_SIDE_KEY) === "right" ? "right" : "left";
}

export function readFlatten(get: Getter): boolean {
	// Default on; only an explicit "0" disables flatten.
	return get(FLATTEN_KEY) !== "0";
}
