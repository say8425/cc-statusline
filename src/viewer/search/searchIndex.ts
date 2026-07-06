import type { FileDiffMetadata } from "@pierre/diffs";
import { findRanges } from "./highlight.ts";

export type MatchSide = "additions" | "deletions";

export interface SearchMatch {
	fileId: string;
	side: MatchSide;
	lineNumber: number; // 1-based
	column: number; // 0-based
	length: number;
}

export interface SearchRow {
	side: MatchSide;
	lineNumber: number; // 1-based
	text: string;
}

export interface SearchFile {
	fileId: string;
	fileDiff: FileDiffMetadata;
}

/**
 * Reconstruct a file's unified render stream as an ordered row list: context
 * lines once (additions side), deletions on the deletions side, additions on
 * the additions side, top-to-bottom. Requires isPartial=false diffs (full
 * old/new contents), which parseDiffFromFile produces.
 */
export const buildRows = (fileDiff: FileDiffMetadata): SearchRow[] => {
	const { additionLines, deletionLines, hunks } = fileDiff;
	const rows: SearchRow[] = [];

	const pushAdditions = (start: number, count: number): void => {
		for (let i = 0; i < count; i++) {
			const idx = start + i;
			if (idx < 0 || idx >= additionLines.length) continue;
			rows.push({
				side: "additions",
				lineNumber: idx + 1,
				text: additionLines[idx],
			});
		}
	};
	const pushDeletions = (start: number, count: number): void => {
		for (let i = 0; i < count; i++) {
			const idx = start + i;
			if (idx < 0 || idx >= deletionLines.length) continue;
			rows.push({
				side: "deletions",
				lineNumber: idx + 1,
				text: deletionLines[idx],
			});
		}
	};

	let newCursor = 0; // next unemitted additionLines index

	for (const hunk of hunks) {
		const hunkStart = hunk.additionStart - 1; // 0-based new-file index of hunk start
		if (hunkStart > newCursor) {
			pushAdditions(newCursor, hunkStart - newCursor); // collapsed context before hunk
			newCursor = hunkStart;
		}
		for (const content of hunk.hunkContent) {
			if (content.type === "context") {
				pushAdditions(content.additionLineIndex, content.lines);
				newCursor = content.additionLineIndex + content.lines;
			} else {
				pushDeletions(content.deletionLineIndex, content.deletions);
				pushAdditions(content.additionLineIndex, content.additions);
				newCursor = content.additionLineIndex + content.additions;
			}
		}
	}
	if (newCursor < additionLines.length) {
		pushAdditions(newCursor, additionLines.length - newCursor); // trailing context
	}
	return rows;
};

/**
 * All matches across files, ordered files[] → unified stream (top-to-bottom)
 * → column. Empty query → [].
 */
export const findMatches = (
	files: readonly SearchFile[],
	query: string,
): SearchMatch[] => {
	if (query === "") return [];
	const matches: SearchMatch[] = [];
	for (const { fileId, fileDiff } of files) {
		for (const row of buildRows(fileDiff)) {
			for (const range of findRanges(row.text, query)) {
				matches.push({
					fileId,
					side: row.side,
					lineNumber: row.lineNumber,
					column: range.start,
					length: range.length,
				});
			}
		}
	}
	return matches;
};
