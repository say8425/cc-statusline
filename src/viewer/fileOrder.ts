// @pierre/trees FileTree의 정렬 규칙(path-store/src/sort.ts)을 복제:
// 각 depth에서 디렉터리가 파일보다 먼저, 세그먼트는 대소문자 무시 자연
// 정렬(숫자 토큰은 수치 비교), 동률이면 소문자값 → 원문 순으로 tiebreak.
// diff 패널·이미지 카드가 사이드바 트리와 같은 순서로 보이게 하는 근거.

type NaturalToken = string | number;

const isDigit = (code: number): boolean => code >= 48 && code <= 57;

const naturalTokens = (value: string): NaturalToken[] => {
	const tokens: NaturalToken[] = [];
	let start = 0;
	let i = 0;
	while (i < value.length) {
		while (i < value.length && !isDigit(value.charCodeAt(i))) i += 1;
		if (i >= value.length) break;
		if (i > start) tokens.push(value.slice(start, i));
		let num = 0;
		while (i < value.length && isDigit(value.charCodeAt(i))) {
			num = num * 10 + (value.charCodeAt(i) - 48);
			i += 1;
		}
		tokens.push(num);
		start = i;
	}
	if (start < value.length || tokens.length === 0)
		tokens.push(value.slice(start));
	return tokens;
};

const compareSegments = (a: string, b: string): number => {
	const lowerA = a.toLowerCase();
	const lowerB = b.toLowerCase();
	if (lowerA !== lowerB) {
		const tokensA = naturalTokens(lowerA);
		const tokensB = naturalTokens(lowerB);
		const shared = Math.min(tokensA.length, tokensB.length);
		for (let i = 0; i < shared; i++) {
			const x = tokensA[i];
			const y = tokensB[i];
			if (x === y) continue;
			if (typeof x === "number" && typeof y === "number") {
				return x < y ? -1 : 1;
			}
			const sx = String(x);
			const sy = String(y);
			if (sx !== sy) return sx < sy ? -1 : 1;
		}
		if (tokensA.length !== tokensB.length) {
			return tokensA.length < tokensB.length ? -1 : 1;
		}
		return lowerA < lowerB ? -1 : 1;
	}
	if (a === b) return 0;
	return a < b ? -1 : 1;
};

export const compareTreePaths = (a: string, b: string): number => {
	const segsA = a.split("/");
	const segsB = b.split("/");
	const shared = Math.min(segsA.length, segsB.length);
	for (let depth = 0; depth < shared; depth++) {
		const segA = segsA[depth];
		const segB = segsB[depth];
		if (segA === segB) continue;
		// 마지막 세그먼트가 아니면 그 depth에서는 디렉터리다.
		const dirA = depth < segsA.length - 1;
		const dirB = depth < segsB.length - 1;
		if (dirA !== dirB) return dirA ? -1 : 1;
		return compareSegments(segA, segB);
	}
	return segsA.length - segsB.length;
};

export const sortFilesLikeTree = <T extends { name: string }>(
	files: readonly T[],
): T[] => files.toSorted((x, y) => compareTreePaths(x.name, y.name));
