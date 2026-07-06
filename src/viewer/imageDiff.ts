import type { DiffFile } from "../diff-server/diff.ts";
import { isImagePath } from "../diff-server/imageTypes.ts";

// 이미지 diff 카드 하나를 그리는 데 필요한 순수 데이터.
export interface ImageEntry {
	name: string;
	/** old 쪽 blob 경로 — renamed면 oldName, 아니면 name */
	oldPath: string;
	status: DiffFile["status"];
	showOld: boolean;
	showNew: boolean;
	/** 바이트 해시 — watch 갱신 감지 및 blob URL 캐시버스터 */
	version?: string;
}

export const imageEntries = (files: DiffFile[]): ImageEntry[] =>
	files
		.filter((f) => f.binary && isImagePath(f.name))
		.map((f) => {
			const entry: ImageEntry = {
				name: f.name,
				oldPath: f.oldName ?? f.name,
				status: f.status,
				showOld: f.status !== "added" && f.status !== "untracked",
				showNew: f.status !== "deleted",
			};
			if (f.blobVersion) entry.version = f.blobVersion;
			return entry;
		});

export const blobUrl = (params: {
	repo: string;
	token: string;
	path: string;
	side: "old" | "new";
	mode: "working" | "base";
	version?: string;
}): string => {
	const query = new URLSearchParams({
		repo: params.repo,
		token: params.token,
		path: params.path,
		side: params.side,
		mode: params.mode,
	});
	if (params.version) query.set("v", params.version);
	return `/api/blob?${query.toString()}`;
};
