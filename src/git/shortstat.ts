// git --shortstat 출력 파싱 (단수/복수 모두, 여러 줄 합산)
export const parseShortstat = (
	text: string,
): {
	files: number;
	insertions: number;
	deletions: number;
} => {
	const [files, insertions, deletions] = [
		/(\d+) files?/g,
		/(\d+) insertions?/g,
		/(\d+) deletions?/g,
	].map((regex) =>
		(text.match(regex) || []).reduce(
			(sum, m) => sum + Number.parseInt(m, 10),
			0,
		),
	);
	return { files, insertions, deletions };
};
