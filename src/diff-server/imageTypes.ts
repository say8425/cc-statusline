// 이미지 diff 대상 확장자와 MIME 매핑 (서버 content-type과 뷰어 필터가 공유).
// SVG는 텍스트라 일반 diff가 더 유용하므로 의도적으로 제외.
const IMAGE_MIME: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	avif: "image/avif",
	bmp: "image/bmp",
	ico: "image/x-icon",
};

const extensionOf = (name: string): string | null => {
	const dot = name.lastIndexOf(".");
	if (dot <= 0 || dot === name.length - 1) return null;
	return name.slice(dot + 1).toLowerCase();
};

export const isImagePath = (name: string): boolean => {
	const ext = extensionOf(name);
	return ext !== null && ext in IMAGE_MIME;
};

export const imageContentType = (name: string): string => {
	const ext = extensionOf(name);
	return (ext && IMAGE_MIME[ext]) || "application/octet-stream";
};
