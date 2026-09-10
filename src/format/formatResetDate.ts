// 요일 이름을 locale에 맞춰 뽑는다 — ko-KR이면 "금", en-US면 "Fri".
// locale이 null이면 Intl 기본값(호스트 로케일)에 맡긴다.
// 포맷터는 렌더당 한 번만 만들어진다 (formatResetDate 호출이 렌더당 한 번).
const weekdayOf = (date: Date, locale: string | null): string =>
	new Intl.DateTimeFormat(locale ?? undefined, { weekday: "short" }).format(
		date,
	);

// 리셋 시각을 "MM/DD(요일) HH:MM" 포맷으로 변환 (로컬 시간 기준).
// 요일만 locale을 타고 나머지 자릿수 표기는 고정이다. 다만 그게 세그먼트 폭까지
// 고정해 주진 않는다 — 축약 요일명은 로케일마다 길이가 다르고, th·he·ar·hi·vi는
// 같은 로케일 안에서도 요일마다 달라 리셋 요일이 바뀌면 ⏰ 뒤 세그먼트가 주마다
// 밀린다 (로케일별 실측은 CLAUDE.md).
// locale 판정은 src/format/resolveLocale.ts가 하고 여기선 결과만 받는다
// (💰 showCost와 같은 DI 방식). 기본값을 두지 않는 것도 그 관례를 따른 것 —
// 기본값이 있으면 나중에 붙는 호출자가 인자를 빠뜨려도 타입 체커가 잡지 못해
// 로케일이 조용히 사라진다. 호스트 기본값을 원하면 null을 명시적으로 넘긴다.
export const formatResetDate = (date: Date, locale: string | null): string => {
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");

	return `${month}/${day}(${weekdayOf(date, locale)}) ${hours}:${minutes}`;
};
