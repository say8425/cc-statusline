import type { DiffFileStatus } from "../diff-server/diff.ts";

// 플랫 목록 한 행: 전체 경로 + git 상태. FileTree와 달리 폴더 계층 없이
// 변경 파일을 한 줄씩 나열한다 (VS Code "List" 뷰 스타일).
export interface FlatListFile {
	path: string;
	status: DiffFileStatus;
}

export interface FlatListHandle {
	root: HTMLElement;
}

interface StatusMeta {
	letter: string;
	label: string;
	color: string;
}

// 상태 → 배지 글자·색. 색은 viewer 다크 팔레트에 맞춘 하드코딩(뷰어는 다크 전용).
export const flatFileStatusMeta = (status: DiffFileStatus): StatusMeta => {
	switch (status) {
		case "added":
			return { letter: "A", label: "Added", color: "#3fb950" };
		case "untracked":
			return { letter: "U", label: "Untracked", color: "#3fb950" };
		case "deleted":
			return { letter: "D", label: "Deleted", color: "#f85149" };
		case "renamed":
			return { letter: "R", label: "Renamed", color: "#d29922" };
		default:
			return { letter: "M", label: "Modified", color: "#009fff" };
	}
};

// 경로 부분 문자열(대소문자 무시) 필터. 빈/공백 쿼리는 전체 반환, 순서 보존.
export const filterFlatFiles = (
	files: readonly FlatListFile[],
	query: string,
): FlatListFile[] => {
	const q = query.trim().toLowerCase();
	if (!q) return files.slice();
	return files.filter((f) => f.path.toLowerCase().includes(q));
};

// 플랫 목록을 mount에 렌더한다: 상단 필터 입력 + 스크롤 목록. 각 행 클릭 시
// onSelect(path). 필터는 행을 숨겨서 스크롤 위치를 보존한다.
export const renderFlatList = (
	mount: HTMLElement,
	files: readonly FlatListFile[],
	onSelect: (path: string) => void,
): FlatListHandle => {
	const root = document.createElement("div");
	root.className = "flat-list";

	const filter = document.createElement("input");
	filter.type = "text";
	filter.className = "flat-filter";
	filter.placeholder = "Filter files…";
	filter.setAttribute("aria-label", "Filter files");
	root.appendChild(filter);

	const rows = document.createElement("div");
	rows.className = "flat-rows";
	root.appendChild(rows);

	const rowByPath = new Map<string, HTMLButtonElement>();
	for (const file of files) {
		const meta = flatFileStatusMeta(file.status);
		const row = document.createElement("button");
		row.type = "button";
		row.className = "flat-row";
		row.dataset.path = file.path;

		const badge = document.createElement("span");
		badge.className = "flat-status";
		badge.textContent = meta.letter;
		badge.style.color = meta.color;
		badge.title = meta.label;
		badge.setAttribute("aria-label", meta.label);

		const label = document.createElement("span");
		label.className = "flat-path";
		label.textContent = file.path;
		label.title = file.path;

		row.append(badge, label);
		row.addEventListener("click", () => onSelect(file.path));
		rows.appendChild(row);
		rowByPath.set(file.path, row);
	}

	filter.addEventListener("input", () => {
		const matched = new Set(
			filterFlatFiles(files, filter.value).map((f) => f.path),
		);
		for (const [path, row] of rowByPath) {
			row.hidden = !matched.has(path);
		}
	});

	mount.appendChild(root);
	return { root };
};
