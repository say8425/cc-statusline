/**
 * Promise.all의 무제한 팬아웃 대신 동시 실행 수를 제한하는 map.
 * getDiffFiles가 파일 수만큼 git 서브프로세스를 한꺼번에 띄우지 않도록
 * 사용한다 (수백 파일 diff + watch 폴링에서 EMFILE/CPU 스파이크 방지).
 * 결과 순서는 입력 순서를 유지하고, 하나라도 실패하면 전체가 reject된다.
 */
export const mapWithLimit = async <T, R>(
	items: readonly T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
	const results: R[] = [];
	let next = 0;
	const worker = async (): Promise<void> => {
		while (next < items.length) {
			const index = next;
			next += 1;
			// 워커별 순차 실행이 동시성 제한의 핵심 — 의도된 await-in-loop.
			// oxlint-disable-next-line no-await-in-loop
			results[index] = await fn(items[index], index);
		}
	};
	const workers = Array.from(
		{ length: Math.max(1, Math.min(limit, items.length)) },
		() => worker(),
	);
	await Promise.all(workers);
	return results;
};
