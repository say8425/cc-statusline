// TrueColor 색상 정의
export const C = {
	RESET: "\x1b[0m",
	CYAN: "\x1b[38;2;0;255;255m",
	MAGENTA: "\x1b[38;2;255;100;200m",
	GREEN: "\x1b[38;2;100;255;100m",
	YELLOW: "\x1b[38;2;255;220;100m",
	RED: "\x1b[38;2;255;100;100m",
	BLUE: "\x1b[38;2;100;150;255m",
	WHITE: "\x1b[38;2;200;200;200m",
	UNDERLINE: "\x1b[4m",
};

// 사용률에 따른 색상 (Context 및 Block Usage 공통)
export function getUsageColor(pct: number): string {
	if (pct < 50) return C.WHITE;
	if (pct < 80) return C.YELLOW;
	return C.RED;
}
