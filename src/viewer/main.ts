import { CodeView, parsePatchFiles } from "@pierre/diffs";
import { FileTree } from "@pierre/trees";
import { changeTypeToGitStatus } from "./mapStatus.ts";

const params = new URLSearchParams(location.search);
const repo = params.get("repo") ?? "";
const token = params.get("token") ?? "";

const treeMount = document.getElementById("tree") as HTMLElement;
const diffMount = document.getElementById("diff") as HTMLElement;
const statusEl = document.getElementById("status") as HTMLElement;
const modeSelect = document.getElementById("diff-mode") as HTMLSelectElement;

let diffStyle: "unified" | "split" = "unified";
let includeUntracked = false;
let diffMode: "working" | "base" = "working";
let codeView: CodeView | null = null;
let fileTree: FileTree | null = null;

let lastPatch: string | null = null;
let lastTreeKey: string | null = null;
let renderedDiffStyle: "unified" | "split" | null = null;
let renderVersion = 0;

function teardownViews(): void {
	codeView?.cleanUp();
	codeView = null;
	fileTree?.cleanUp();
	fileTree = null;
	renderedDiffStyle = null;
	lastTreeKey = null;
	treeMount.replaceChildren();
}

function renderPatch(patch: string): void {
	const files = parsePatchFiles(patch).flatMap((p) => p.files);

	if (files.length === 0) {
		teardownViews();
		diffMount.replaceChildren();
		diffMount.innerHTML = '<div id="empty">No changes.</div>';
		statusEl.textContent = "";
		return;
	}
	statusEl.textContent = `${files.length} file(s)`;

	const paths = files.map((f) => f.name);
	const gitStatus = files.map((f) => ({
		path: f.name,
		status: changeTypeToGitStatus(f.type),
	}));
	// Bump a monotonic version so CodeView's reconcile re-renders the diff
	// content on reuse (it only updates a reused item when its version changes).
	renderVersion += 1;
	const items = files.map((f) => ({
		id: f.name,
		type: "diff" as const,
		fileDiff: f,
		version: renderVersion,
	}));

	// File tree: create once; afterwards update in place only when the file set
	// or statuses changed (so editing a file's contents doesn't reset it).
	const treeKey = JSON.stringify(gitStatus);
	if (!fileTree) {
		treeMount.replaceChildren();
		fileTree = new FileTree({
			paths,
			gitStatus,
			initialExpansion: "open",
			flattenEmptyDirectories: true,
			search: true,
			onSelectionChange: (selected) => {
				const path = selected[0];
				if (path && codeView) codeView.scrollTo({ type: "item", id: path });
			},
		});
		fileTree.render({ containerWrapper: treeMount });
		lastTreeKey = treeKey;
	} else if (treeKey !== lastTreeKey) {
		fileTree.resetPaths(paths);
		fileTree.setGitStatus(gitStatus);
		lastTreeKey = treeKey;
	}

	// Diff panel: recreate the CodeView on first render, when transitioning from
	// empty, or when diffStyle changed; otherwise reuse it so scroll is
	// preserved across updates.
	if (!codeView || renderedDiffStyle !== diffStyle) {
		codeView?.cleanUp();
		diffMount.replaceChildren();
		codeView = new CodeView({
			diffStyle,
			themeType: "dark",
			stickyHeaders: true,
		});
		codeView.setup(diffMount);
		codeView.setItems(items);
		codeView.render();
		renderedDiffStyle = diffStyle;
		// First-paint stabilization: the virtualized CodeView fills its visible
		// range only after the container is measured. Re-render on the next two
		// frames (guarded against a superseded instance).
		const cv = codeView;
		requestAnimationFrame(() => {
			if (cv !== codeView) return;
			cv.render();
			requestAnimationFrame(() => {
				if (cv === codeView) cv.render();
			});
		});
	} else {
		const scrollTop = codeView.getScrollTop();
		codeView.setItems(items);
		codeView.render();
		codeView.scrollTo({ type: "position", position: scrollTop });
	}
}

// Reflect the resolved base name on the "vs base" option, and disable it
// (falling back to working mode) when no base could be resolved.
function updateBaseOption(base: string): void {
	const opt = modeSelect?.querySelector<HTMLOptionElement>(
		'option[value="base"]',
	);
	if (!opt) return;
	if (base) {
		opt.textContent = `vs ${base}`;
		opt.disabled = false;
		if (modeSelect.value !== diffMode) modeSelect.value = diffMode;
	} else {
		opt.textContent = "vs base (unavailable)";
		opt.disabled = true;
		if (diffMode === "base") {
			diffMode = "working";
			modeSelect.value = "working";
			localStorage.setItem("cc-statusline:diff-mode", "working");
		}
	}
}

async function fetchDiff(): Promise<{ patch: string; base: string } | null> {
	const query = new URLSearchParams({
		repo,
		token,
		untracked: includeUntracked ? "1" : "0",
		mode: diffMode,
	});
	try {
		const res = await fetch(`/api/diff?${query.toString()}`);
		if (!res.ok) return null;
		const patch = await res.text();
		return { patch, base: res.headers.get("x-diff-base") ?? "" };
	} catch (err) {
		console.error(err);
		return null;
	}
}

async function load(): Promise<void> {
	statusEl.textContent = "Loading…";
	const result = await fetchDiff();
	if (result === null) {
		diffMount.innerHTML = '<div id="empty">Failed to load diff.</div>';
		return;
	}
	updateBaseOption(result.base);
	lastPatch = result.patch;
	renderPatch(result.patch);
}

document.getElementById("toggle-style")?.addEventListener("click", () => {
	diffStyle = diffStyle === "unified" ? "split" : "unified";
	void load();
});
const untrackedInput = document.getElementById(
	"toggle-untracked",
) as HTMLInputElement;
untrackedInput?.addEventListener("change", () => {
	includeUntracked = untrackedInput.checked;
	void load();
});
document
	.getElementById("refresh")
	?.addEventListener("click", () => void load());
window.addEventListener("focus", () => void load());

modeSelect?.addEventListener("change", () => {
	diffMode = modeSelect.value === "base" ? "base" : "working";
	localStorage.setItem("cc-statusline:diff-mode", diffMode);
	void load();
});

// URL mode (from the statusline link) wins over the persisted preference so a
// "vs base" edit link opens directly in base mode; otherwise restore localStorage.
const urlMode = params.get("mode");
if (urlMode === "base" || urlMode === "working") {
	diffMode = urlMode;
	localStorage.setItem("cc-statusline:diff-mode", urlMode);
	if (modeSelect) modeSelect.value = urlMode;
} else if (localStorage.getItem("cc-statusline:diff-mode") === "base") {
	diffMode = "base";
	modeSelect.value = "base";
}

void load();

const WATCH_STORAGE_KEY = "cc-statusline:diff-watch";
const WATCH_POLL_MS = 2000;
let watchTimer: ReturnType<typeof setInterval> | null = null;

async function poll(): Promise<void> {
	const result = await fetchDiff();
	if (result === null) return;
	updateBaseOption(result.base);
	if (result.patch === lastPatch) return;
	lastPatch = result.patch;
	renderPatch(result.patch);
}

function startWatch(): void {
	if (watchTimer !== null) return;
	watchTimer = setInterval(() => void poll(), WATCH_POLL_MS);
}

function stopWatch(): void {
	if (watchTimer !== null) {
		clearInterval(watchTimer);
		watchTimer = null;
	}
}

const watchInput = document.getElementById("toggle-watch") as HTMLInputElement;
watchInput?.addEventListener("change", () => {
	if (watchInput.checked) {
		localStorage.setItem(WATCH_STORAGE_KEY, "1");
		startWatch();
	} else {
		localStorage.setItem(WATCH_STORAGE_KEY, "0");
		stopWatch();
	}
});

// 저장된 watch 상태 복원 (ON이면 폴링 시작)
if (watchInput && localStorage.getItem(WATCH_STORAGE_KEY) === "1") {
	watchInput.checked = true;
	startWatch();
}
