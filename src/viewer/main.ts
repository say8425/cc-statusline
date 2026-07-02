import {
	CodeView,
	type FileDiffMetadata,
	parsePatchFiles,
} from "@pierre/diffs";
import { FileTree } from "@pierre/trees";
import { changeTypeToGitStatus } from "./mapStatus.ts";

const params = new URLSearchParams(location.search);
const repo = params.get("repo") ?? "";
const token = params.get("token") ?? "";

const treeMount = document.getElementById("tree") as HTMLElement;
const diffMount = document.getElementById("diff") as HTMLElement;
const statusEl = document.getElementById("status") as HTMLElement;

let diffStyle: "unified" | "split" = "unified";
let includeUntracked = false;
let codeView: CodeView | null = null;
let fileTree: FileTree | null = null;

function renderFiles(files: FileDiffMetadata[]): void {
	treeMount.replaceChildren();
	diffMount.replaceChildren();

	if (files.length === 0) {
		diffMount.innerHTML = '<div id="empty">No changes.</div>';
		statusEl.textContent = "";
		return;
	}
	statusEl.textContent = `${files.length} file(s)`;

	fileTree = new FileTree({
		paths: files.map((f) => f.name),
		gitStatus: files.map((f) => ({
			path: f.name,
			status: changeTypeToGitStatus(f.type),
		})),
		initialExpansion: "open",
		flattenEmptyDirectories: true,
		search: true,
		onSelectionChange: (selected) => {
			const path = selected[0];
			if (path && codeView) codeView.scrollTo({ type: "item", id: path });
		},
	});
	fileTree.render({ containerWrapper: treeMount });

	codeView = new CodeView({
		diffStyle,
		themeType: "dark",
		stickyHeaders: true,
	});
	codeView.setup(diffMount);
	codeView.setItems(
		files.map((f) => ({ id: f.name, type: "diff" as const, fileDiff: f })),
	);
	codeView.render();
	// 첫 페인트 안정화: 가상화된 CodeView는 컨테이너 크기가 측정된 뒤에야
	// 보이는 범위를 채운다. 초기 mount 직후엔 비어 보일 수 있으므로 다음
	// 프레임들에서 다시 렌더해 확실히 그리게 한다.
	// 이후 다른 렌더로 교체된 인스턴스라면 재렌더하지 않는다 (빠른 토글/refresh 시
	// 이전 rAF가 orphaned CodeView를 건드리는 것을 방지).
	const cv = codeView;
	requestAnimationFrame(() => {
		if (cv !== codeView) return;
		cv.render();
		requestAnimationFrame(() => {
			if (cv === codeView) cv.render();
		});
	});
}

async function load(): Promise<void> {
	statusEl.textContent = "Loading…";
	try {
		const query = new URLSearchParams({
			repo,
			token,
			untracked: includeUntracked ? "1" : "0",
		});
		const res = await fetch(`/api/diff?${query.toString()}`);
		if (!res.ok) {
			diffMount.innerHTML = `<div id="empty">Error: ${res.status}</div>`;
			return;
		}
		const patch = await res.text();
		renderFiles(parsePatchFiles(patch).flatMap((p) => p.files));
	} catch (err) {
		diffMount.innerHTML = `<div id="empty">Failed to load diff.</div>`;
		console.error(err);
	}
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

void load();
