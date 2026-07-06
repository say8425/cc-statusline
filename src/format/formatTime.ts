// 시간 포맷팅 (HH:MM)
export const formatTime = (hours: number, mins: number): string =>
	`${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
