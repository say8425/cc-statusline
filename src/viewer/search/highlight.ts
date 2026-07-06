export interface MatchRange {
	start: number;
	length: number;
}

/**
 * Case-insensitive plain-substring match ranges within `text`.
 * Non-overlapping, left-to-right. Empty query → []. Shared by the search
 * index (searchIndex.ts) and the DOM highlighter (highlightDom.ts) so both
 * agree on what counts as a match.
 */
export const findRanges = (text: string, query: string): MatchRange[] => {
	if (query === "") return [];
	const haystack = text.toLowerCase();
	const needle = query.toLowerCase();
	const ranges: MatchRange[] = [];
	let from = 0;
	for (;;) {
		const idx = haystack.indexOf(needle, from);
		if (idx === -1) break;
		ranges.push({ start: idx, length: needle.length });
		from = idx + needle.length;
	}
	return ranges;
};
