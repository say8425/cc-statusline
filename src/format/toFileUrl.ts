// 절대경로를 file:// URI로 변환 (OSC 8 하이퍼링크용).
export const toFileUrl = (absolutePath: string): string => {
	const normalized = absolutePath.replace(/\\/g, "/");
	const withLeadingSlash = normalized.startsWith("/")
		? normalized
		: `/${normalized}`;
	try {
		return `file://${encodeURI(withLeadingSlash)}`;
	} catch {
		// encodeURI throws on an unpaired UTF-16 surrogate. Encode
		// character-by-character so control chars still get escaped and a
		// lone surrogate can't smuggle a raw byte into the OSC 8 sequence
		// this URL gets embedded in.
		const safe = Array.from(withLeadingSlash)
			.map((ch) => {
				try {
					return encodeURI(ch);
				} catch {
					return "%EF%BF%BD"; // U+FFFD replacement character
				}
			})
			.join("");
		return `file://${safe}`;
	}
};
