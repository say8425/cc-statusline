export type TreeSide = "left" | "right";
export type FileView = "tree" | "list";

export const TREE_SIDE_KEY = "cc-statusline:tree-side";
export const FILE_VIEW_KEY = "cc-statusline:file-view";

type Getter = (key: string) => string | null;

export const readTreeSide = (get: Getter): TreeSide =>
	get(TREE_SIDE_KEY) === "right" ? "right" : "left";

// Folder tree by default; only an explicit "list" opts into the flat file list.
export const readFileView = (get: Getter): FileView =>
	get(FILE_VIEW_KEY) === "list" ? "list" : "tree";
