import type { SearchFile, SearchMatch } from "./searchIndex.ts";
import { findMatches } from "./searchIndex.ts";

export interface FindBarElements {
	bar: HTMLElement;
	input: HTMLInputElement;
	count: HTMLElement;
	prev: HTMLButtonElement;
	next: HTMLButtonElement;
	close: HTMLButtonElement;
}

export interface FindBarDeps {
	elements: FindBarElements;
	getFiles(): SearchFile[];
	revealMatch(match: SearchMatch): void; // scroll + select
	selectMatch(match: SearchMatch): void; // select only (no scroll)
	clearSelection(): void;
	ensureVisible(match: SearchMatch): void; // Task 5 (Task 3: no-op)
	setExpandAll(on: boolean): void; // Task 5 (Task 3: no-op)
	reapplyHighlights(): void; // Task 4 (Task 3: codeView.render())
}

export interface FindBar {
	open(): void;
	close(): void;
	isOpen(): boolean;
	setData(): void;
	getQuery(): string;
	getActiveMatch(): SearchMatch | null;
}

const DEBOUNCE_MS = 120;

export const createFindBar = (deps: FindBarDeps): FindBar => {
	const { elements } = deps;
	let opened = false;
	let query = "";
	let matches: SearchMatch[] = [];
	let current = -1;

	const renderCount = (): void => {
		elements.count.textContent =
			matches.length === 0
				? query === ""
					? ""
					: "0/0"
				: `${current + 1}/${matches.length}`;
		const none = matches.length === 0;
		elements.prev.disabled = none;
		elements.next.disabled = none;
	};

	const rebuild = (): void => {
		matches = findMatches(deps.getFiles(), query);
		if (matches.length === 0) {
			current = -1;
			deps.clearSelection();
		} else if (current < 0 || current >= matches.length) {
			current = 0;
		}
		renderCount();
	};

	const goTo = (index: number): void => {
		if (matches.length === 0) return;
		current = ((index % matches.length) + matches.length) % matches.length;
		const match = matches[current];
		deps.ensureVisible(match);
		deps.revealMatch(match);
		deps.reapplyHighlights();
		renderCount();
	};

	const applyQuery = (next: string): void => {
		query = next;
		deps.setExpandAll(opened && query !== "");
		rebuild();
		if (matches.length > 0) goTo(0);
		else deps.reapplyHighlights();
	};

	let debounce: ReturnType<typeof setTimeout> | null = null;
	elements.input.addEventListener("input", () => {
		if (debounce !== null) clearTimeout(debounce);
		debounce = setTimeout(() => applyQuery(elements.input.value), DEBOUNCE_MS);
	});
	elements.input.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			goTo(current + (event.shiftKey ? -1 : 1));
		} else if (event.key === "Escape") {
			event.preventDefault();
			close();
		}
	});
	elements.prev.addEventListener("click", () => goTo(current - 1));
	elements.next.addEventListener("click", () => goTo(current + 1));
	elements.close.addEventListener("click", () => close());

	const open = (): void => {
		opened = true;
		elements.bar.hidden = false;
		elements.input.focus();
		elements.input.select();
		deps.setExpandAll(query !== "");
		rebuild();
		if (matches.length > 0) goTo(current < 0 ? 0 : current);
		deps.reapplyHighlights();
	};

	const close = (): void => {
		if (debounce !== null) {
			clearTimeout(debounce);
			debounce = null;
		}
		opened = false;
		elements.bar.hidden = true;
		deps.setExpandAll(false);
		deps.clearSelection();
		deps.reapplyHighlights();
	};

	window.addEventListener("keydown", (event) => {
		if (
			(event.metaKey || event.ctrlKey) &&
			(event.key === "f" || event.key === "F")
		) {
			event.preventDefault();
			if (opened) {
				elements.input.focus();
				elements.input.select();
			} else {
				open();
			}
		}
	});

	return {
		open,
		close,
		isOpen: () => opened,
		setData: () => {
			if (!opened) return;
			rebuild();
			if (matches.length > 0) deps.selectMatch(matches[current]);
			deps.reapplyHighlights();
		},
		getQuery: () => (opened ? query : ""),
		getActiveMatch: () => (opened && current >= 0 ? matches[current] : null),
	};
};
