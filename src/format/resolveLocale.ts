type Env = Record<string, string | undefined>;

// 시간 표기 로케일을 결정하는 env 키 — POSIX 우선순위 순서다.
// integration 테스트가 main()의 env 격리 목록에 그대로 얹어 쓴다.
export const LOCALE_ENV_KEYS = ["LC_ALL", "LC_TIME", "LANG"] as const;

// POSIX 로케일("ko_KR.UTF-8@euro")에서 BCP-47 태그("ko-KR")만 남긴다.
// 인코딩(.UTF-8)과 modifier(@euro)는 Intl이 모르는 표기라 떼어 낸다.
// modifier는 종류를 가리지 않고 버리므로 script 변종도 함께 사라진다:
// "sr_RS.UTF-8@latin"은 "sr-RS"(키릴)가 되어 라틴 표기 사용자에게 키릴 요일이
// 나온다. 고치려면 @latin/@cyrillic만 -Latn/-Cyrl로 매핑하면 되지만, 나머지
// modifier(@valencia·@euro 등)는 script가 아니라 일괄 규칙이 서지 않아 두었다.
const toBcp47 = (posix: string): string | null => {
	const base = posix.split(".")[0]?.split("@")[0]?.trim() ?? "";
	// "C"/"POSIX"는 "지역화하지 말라"는 뜻의 특수값이다. "C"는 언어 서브태그
	// 길이(2~8자)에 못 미쳐 어차피 아래 검증에서 걸리지만, "POSIX"는 5글자라
	// 구조적으론 멀쩡한 태그로 통과해 버리므로 여기서 명시적으로 막는다.
	if (!base || base === "C" || base === "POSIX") return null;

	const tag = base.replace(/_/g, "-");
	try {
		Intl.DateTimeFormat.supportedLocalesOf([tag]);
	} catch {
		// 구조적으로 깨진 태그는 RangeError를 던진다 — 버리고 Intl 기본값으로.
		// (지원하지 않는 태그는 여기서 안 걸리지만 Intl이 알아서 대체해 준다)
		return null;
	}
	return tag;
};

// 현재 로케일을 env에서 해석한다. 못 고르면 null을 돌려 Intl 기본값에 위임한다.
//
// env를 직접 읽는 이유: Bun(JSC)의 Intl 기본 로케일은 이 변수들을 보지 않는다.
// macOS에서 LANG=ko_KR.UTF-8인 셸에서도 `new Intl.DateTimeFormat()
// .resolvedOptions().locale`이 "en-US"로 나온다 (bun 1.3.12 실측). 그래서
// 터미널 로케일을 반영하려면 POSIX 변수를 직접 보는 수밖에 없다.
export const resolveLocale = (env: Env = process.env): string | null => {
	for (const key of LOCALE_ENV_KEYS) {
		// 공백만 있는 값은 빈 문자열과 같이 "미설정"으로 본다 — 여기서 trim하지
		// 않으면 LC_ALL=""는 다음 키로 넘어가는데 LC_ALL="  "는 truthy라 넘어가지
		// 않고 끝나 버려, 같은 뜻의 두 값이 다르게 동작한다.
		const raw = env[key]?.trim();
		if (!raw) continue;
		// 먼저 설정된 변수가 이긴다 — 값이 "C"처럼 쓸 수 없는 것이면 뒤 변수로
		// 넘어가지 않고 그대로 Intl 기본값으로 간다 (POSIX 우선순위 그대로).
		return toBcp47(raw);
	}
	return null;
};
