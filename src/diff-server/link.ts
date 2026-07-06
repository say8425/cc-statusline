export const buildDiffViewerUrl = (params: {
	port: number;
	repo: string;
	token: string;
	mode?: "working" | "base";
}): string => {
	const query = new URLSearchParams({
		repo: params.repo,
		token: params.token,
	});
	if (params.mode) query.set("mode", params.mode);
	return `http://127.0.0.1:${params.port}/?${query.toString()}`;
};
