import { findRanges } from "./highlight.ts";
import type { SearchMatch } from "./searchIndex.ts";

const HIT = "cc-find-hit";
const ACTIVE = "cc-find-hit--active";

/** Remove all mark.cc-find-hit wrappers under root, restoring original text. */
function unwrap(root: HTMLElement | ShadowRoot): void {
	const marks = root.querySelectorAll<HTMLElement>(`mark.${HIT}`);
	for (const mark of marks) {
		const parent = mark.parentNode;
		if (!parent) continue;
		parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
		parent.normalize();
	}
}

/**
 * Wrap query matches inside root's code content in <mark>. Idempotent: unwraps
 * previous marks first. `active` (the current match) gets an extra class when
 * its file matches and it sits on a text node whose match column lines up.
 *
 * Code content lines are located via the shared line container selector. The
 * exact selector is confirmed during E2E; the default below walks text nodes
 * under elements carrying Pierre's line role, skipping gutters/headers.
 */
export function highlightDom(
	root: HTMLElement | ShadowRoot,
	query: string,
	active: SearchMatch | null,
	fileId: string,
): void {
	unwrap(root);
	if (query === "") return;

	// Content cells: Pierre renders code line text inside the diff grid content
	// column. Confirmed in E2E; `[data-diffs-content] *, pre code` covers the
	// rendered code text while excluding gutter line numbers and the header.
	const contentRoots = root.querySelectorAll<HTMLElement>(
		"[data-diffs-content], pre",
	);
	const scope =
		contentRoots.length > 0 ? Array.from(contentRoots) : [root as HTMLElement];

	for (const container of scope) {
		const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
		const textNodes: Text[] = [];
		for (let n = walker.nextNode(); n; n = walker.nextNode()) {
			const t = n as Text;
			if (t.parentElement?.closest(`mark.${HIT}`)) continue;
			if (t.nodeValue && t.nodeValue.length > 0) textNodes.push(t);
		}
		for (const textNode of textNodes) {
			const text = textNode.nodeValue ?? "";
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
				if (
					active &&
					active.fileId === fileId &&
					active.column === range.start
				) {
					mark.classList.add(ACTIVE);
				}
				frag.appendChild(mark);
				cursor = range.start + range.length;
			}
			if (cursor < text.length)
				frag.appendChild(document.createTextNode(text.slice(cursor)));
			textNode.parentNode?.replaceChild(frag, textNode);
		}
	}
}
