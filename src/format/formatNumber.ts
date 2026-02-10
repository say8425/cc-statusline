// 숫자 포맷팅 (천 단위 콤마)
export function formatNumber(n: number): string {
	return n.toLocaleString("en-US");
}
