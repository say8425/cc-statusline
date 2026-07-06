// A small "copy file path" button placed next to a diff header's filename.
// Clicking copies `path` to the clipboard and briefly swaps to a check icon.
// Clicks are stopped from bubbling so they never toggle the header's fold.

const COPY_SVG =
	'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_SVG =
	'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
const RESET_MS = 1200;

export const createCopyButton = (path: string): HTMLButtonElement => {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.dataset.copyName = "";
	btn.setAttribute("aria-label", "Copy file path");
	btn.setAttribute("title", "Copy path");
	btn.innerHTML = COPY_SVG;

	let resetTimer: ReturnType<typeof setTimeout> | null = null;
	const showCopied = (): void => {
		btn.innerHTML = CHECK_SVG;
		btn.setAttribute("aria-label", "Copied");
		btn.setAttribute("title", "Copied");
		if (resetTimer !== null) clearTimeout(resetTimer);
		resetTimer = setTimeout(() => {
			btn.innerHTML = COPY_SVG;
			btn.setAttribute("aria-label", "Copy file path");
			btn.setAttribute("title", "Copy path");
			resetTimer = null;
		}, RESET_MS);
	};

	// Keep copy interactions from reaching the header's fold toggle (a header
	// click collapses the file; its pointerdown starts drag tracking).
	btn.addEventListener("pointerdown", (event) => event.stopPropagation());
	btn.addEventListener("click", (event) => {
		event.stopPropagation();
		event.preventDefault();
		const clip = navigator.clipboard;
		if (!clip?.writeText) {
			console.warn("clipboard API unavailable");
			return;
		}
		clip.writeText(path).then(showCopied, (err) => console.warn(err));
	});

	return btn;
};
