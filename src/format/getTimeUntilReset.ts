// 리셋까지 남은 시간 계산
export const getTimeUntilReset = (
	resetTime: Date,
): {
	hours: number;
	minutes: number;
} => {
	const now = new Date();
	const diff = resetTime.getTime() - now.getTime();

	if (diff <= 0) {
		return { hours: 0, minutes: 0 };
	}

	const hours = Math.floor(diff / (1000 * 60 * 60));
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

	return { hours, minutes };
};
