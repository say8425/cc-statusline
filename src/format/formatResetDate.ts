// 리셋 시각을 "MM/DD HH:MM" 포맷으로 변환 (로컬 시간 기준)
export const formatResetDate = (date: Date): string => {
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");

	return `${month}/${day} ${hours}:${minutes}`;
};
