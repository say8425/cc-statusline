import { findRanges } from "./highlight.ts";
import type { SearchMatch } from "./searchIndex.ts";

const HIT = "cc-find-hit";
const ACTIVE = "cc-find-hit--active";

/** Remove all mark.cc-find-hit wrappers under root, restoring original text. */
const unwrap = (root: HTMLElement | ShadowRoot): void => {
	const marks = root.querySelectorAll<HTMLElement>(`mark.${HIT}`);
	for (const mark of marks) {
		const parent = mark.parentNode;
		if (!parent) continue;
		parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
		parent.normalize();
	}
};

const sideOf = (lineType: string | undefined): "additions" | "deletions" =>
	lineType?.includes("deletion") ? "deletions" : "additions";

/**
 * Wrap query matches inside root's code content lines in <mark>. Idempotent:
 * unwraps previous marks first; empty query → unwrap only. Scopes to Pierre's
 * `[data-line]` rows (excludes the gutter), derives each row's 1-based line
 * number and side, and tracks each text node's column offset within the full
 * line so the active occurrence (fileId + side + lineNumber + column) is the
 * only one marked `--active`.
 */
export const highlightDom = (
	root: HTMLElement | ShadowRoot,
	query: string,
	active: SearchMatch | null,
	fileId: string,
): void => {
	unwrap(root);
	if (query === "") return;

	const lineEls = root.querySelectorAll<HTMLElement>("[data-line]");
	for (const lineEl of lineEls) {
		const lineNumber = Number(lineEl.dataset.line);
		if (!Number.isFinite(lineNumber)) continue;
		const side = sideOf(lineEl.dataset.lineType);
		const activeHere =
			active !== null &&
			active.fileId === fileId &&
			active.side === side &&
			active.lineNumber === lineNumber;

		const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
		const nodes: { node: Text; offset: number }[] = [];
		let lineOffset = 0;
		for (let n = walker.nextNode(); n; n = walker.nextNode()) {
			const textNode = n as Text;
			const len = textNode.nodeValue?.length ?? 0;
			if (len > 0) nodes.push({ node: textNode, offset: lineOffset });
			lineOffset += len;
		}

		for (const { node, offset } of nodes) {
			const text = node.nodeValue ?? "";
			const ranges = findRanges(text, query);
			if (ranges.length === 0) continue;
			const frag = document.createDocumentFragment();
			let cursor = 0;
			for (const range of ranges) {
				if (range.start > cursor) {
					frag.appendChild(
						document.createTextNode(text.slice(cursor, range.start)),
					);
				}
				const mark = document.createElement("mark");
				mark.className = HIT;
				mark.textContent = text.slice(range.start, range.start + range.length);
				if (activeHere && active.column === offset + range.start) {
					mark.classList.add(ACTIVE);
				}
				frag.appendChild(mark);
				cursor = range.start + range.length;
			}
			if (cursor < text.length)
				frag.appendChild(document.createTextNode(text.slice(cursor)));
			node.parentNode?.replaceChild(frag, node);
		}
	}
};
