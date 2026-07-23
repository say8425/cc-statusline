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
	// 채도 낮춘 버전 — PR 배지([Open](3 running) 등) 전용, 다른 세그먼트(✏️, 사용량
	// 임계치)의 선명한 색상에는 영향 없음
	GREEN_MUTED: "\x1b[38;2;140;195;140m",
	YELLOW_MUTED: "\x1b[38;2;210;185;130m",
	RED_MUTED: "\x1b[38;2;210;130;130m",
	MAGENTA_MUTED: "\x1b[38;2;195;140;175m",
	UNDERLINE: "\x1b[4m",
};

// 사용률에 따른 색상 (Context 및 Block Usage 공통)
export const getUsageColor = (pct: number): string => {
	if (pct < 50) return C.WHITE;
	if (pct < 80) return C.YELLOW;
	return C.RED;
};
