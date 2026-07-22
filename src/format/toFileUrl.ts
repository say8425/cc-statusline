// 절대경로를 file:// URI로 변환 (OSC 8 하이퍼링크용).
export const toFileUrl = (absolutePath: string): string => {
	const normalized = absolutePath.replace(/\\/g, "/");
	const withLeadingSlash = normalized.startsWith("/")
		? normalized
		: `/${normalized}`;
	return `file://${encodeURI(withLeadingSlash)}`;
};
