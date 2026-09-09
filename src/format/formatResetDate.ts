// 요일 이름을 locale에 맞춰 뽑는다 — ko-KR이면 "금", en-US면 "Fri".
// locale이 null이면 Intl 기본값(호스트 로케일)에 맡긴다.
// 포맷터는 렌더당 한 번만 만들어진다 (formatResetDate 호출이 렌더당 한 번).
const weekdayOf = (date: Date, locale: string | null): string =>
	new Intl.DateTimeFormat(locale ?? undefined, { weekday: "short" }).format(
		date,
	);

// 리셋 시각을 "MM/DD(요일) HH:MM" 포맷으로 변환 (로컬 시간 기준).
// 요일만 locale을 타고 나머지 자릿수 표기는 고정이다 — 폭이 흔들리면
// statusline 정렬이 매주 달라진다.
// locale 판정은 src/format/resolveLocale.ts가 하고 여기선 결과만 받는다
// (💰 showCost와 같은 DI 방식).
export const formatResetDate = (
	date: Date,
	locale: string | null = null,
): string => {
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");

	return `${month}/${day}(${weekdayOf(date, locale)}) ${hours}:${minutes}`;
};
