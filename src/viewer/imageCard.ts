import type { ImageEntry } from "./imageDiff.ts";

export type BlobUrlFor = (
	path: string,
	side: "old" | "new",
	version?: string,
) => string;

// 이미지 카드는 Pierre <diffs-container>의 shadow DOM 안(헤더 뒤)에 주입되므로
// 페이지 CSS가 닿지 않는다 — CodeView의 unsafeCSS 옵션으로 함께 주입한다.
export const IMAGE_CARD_CSS =
	"[data-image-card]{display:flex;gap:1px;background:#1f1f21;border-top:1px solid #1f1f21}" +
	".img-pane{flex:1;margin:0;background:#141415;min-width:0}" +
	".img-pane figcaption{padding:4px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.06em}" +
	".img-pane--old figcaption{color:#e5534b}" +
	".img-pane--new figcaption{color:#57ab5a}" +
	".img-checker{display:flex;justify-content:center;align-items:center;padding:10px;" +
	"background:repeating-conic-gradient(#232324 0% 25%,#1a1a1b 0% 50%) 0 0/16px 16px}" +
	".img-checker img{max-width:100%;max-height:320px;object-fit:contain;display:block}";

const buildPane = (
	side: "old" | "new",
	src: string,
	alt: string,
): HTMLElement => {
	const pane = document.createElement("figure");
	pane.className = `img-pane img-pane--${side}`;
	const caption = document.createElement("figcaption");
	caption.textContent = side === "old" ? "Old" : "New";
	const checker = document.createElement("div");
	checker.className = "img-checker";
	const img = document.createElement("img");
	img.src = src;
	img.alt = alt;
	img.loading = "lazy";
	checker.append(img);
	pane.append(caption, checker);
	return pane;
};

const buildCard = (entry: ImageEntry, urlFor: BlobUrlFor): HTMLElement => {
	const card = document.createElement("div");
	card.setAttribute("data-image-card", entry.version ?? "");
	if (entry.showOld) {
		card.append(
			buildPane(
				"old",
				urlFor(entry.oldPath, "old", entry.version),
				`${entry.name} (old)`,
			),
		);
	}
	if (entry.showNew) {
		card.append(
			buildPane(
				"new",
				urlFor(entry.name, "new", entry.version),
				`${entry.name} (new)`,
			),
		);
	}
	return card;
};

// 빈 diff의 헤더 아이콘은 항상 "modified"로 파싱되므로, 스프라이트에 해당
// 심볼이 있을 때만 실제 상태(A/D)의 아이콘으로 바꿔준다.
const ICON_SYMBOL: Partial<Record<ImageEntry["status"], string>> = {
	added: "added",
	untracked: "added",
	deleted: "deleted",
	renamed: "renamed",
};

const swapStatusIcon = (
	root: ShadowRoot | HTMLElement,
	status: ImageEntry["status"],
): void => {
	const symbol = ICON_SYMBOL[status];
	if (!symbol) return;
	if (!root.querySelector(`#diffs-icon-symbol-${symbol}`)) return;
	const use = root.querySelector<SVGUseElement>(
		"[data-diffs-header] [data-change-icon] use",
	);
	use?.setAttribute("href", `#diffs-icon-symbol-${symbol}`);
};

/**
 * onPostRender에서 호출. 컨테이너가 이미지 아이템이면 헤더 바로 뒤에
 * Old/New 카드를 주입한다. 멱등: 같은 version이면 no-op, version이 바뀌면
 * 교체(watch 갱신), 접힌 상태면 제거.
 */
export const ensureImageCard = (
	container: HTMLElement,
	entry: ImageEntry | undefined,
	collapsed: boolean,
	urlFor: BlobUrlFor,
): void => {
	const root = container.shadowRoot ?? container;
	const existing = root.querySelector<HTMLElement>("[data-image-card]");
	if (!entry || collapsed) {
		existing?.remove();
		return;
	}
	// 이미지 아이템의 "-0 +0" 스탯은 무의미하므로 숨긴다.
	for (const el of root.querySelectorAll<HTMLElement>(
		"[data-deletions-count],[data-additions-count]",
	)) {
		el.style.display = "none";
	}
	swapStatusIcon(root, entry.status);
	const version = entry.version ?? "";
	if (existing) {
		if (existing.getAttribute("data-image-card") === version) return;
		existing.remove();
	}
	const header = root.querySelector("[data-diffs-header]");
	const card = buildCard(entry, urlFor);
	if (header) header.after(card);
	else root.append(card);
};
