export function buildDiffViewerUrl(params: {
	port: number;
	repo: string;
	token: string;
}): string {
	const query = new URLSearchParams({
		repo: params.repo,
		token: params.token,
	});
	return `http://127.0.0.1:${params.port}/?${query.toString()}`;
}
