import { EditorView } from '@codemirror/view';
import { cardInfoFromFrontmatter, toCardInfo, type CardInfo } from './card';
import { renderCard } from './codeblock';
import type MtgCardPrimersPlugin from './main';
import { cleanLinkpath } from './linkpath';
import { findPrimerByName } from './primers';
import { ScryfallError } from './scryfall';

const SHOW_DELAY_MS = 300;
// While set on <body>, Obsidian's own hover preview ("… is not created yet. Click to create.") is hidden.
const HIDE_NATIVE_CLASS = 'mtg-card-hide-native-preview';
// Set on a preview popover that contains the hovered link, so hiding previews doesn't hide the link itself.
const KEEP_POPOVER_CLASS = 'mtg-card-keep-popover';
const POPUP_WIDTH = 250;
const MARGIN = 8;

// Reading view renders <a class="internal-link">; Live Preview/Source use .cm-hmd-internal-link spans.
const LINK_SELECTOR = 'a.internal-link, .cm-hmd-internal-link';

/**
 * Shows a card popup when hovering a wikilink such as [[Phyrexian Altar]].
 * - Link to a primer note → card from its frontmatter (works offline).
 * - Unresolved link → exact name lookup on Scryfall (no popup if it is not a card).
 * - Link to any other note → nothing.
 */
export class CardHoverPopup {
	private linkEl: HTMLElement | null = null;
	private popupEl: HTMLElement | null = null;
	private timer: number | null = null;
	private hiddenNativeIn: HTMLElement | null = null;
	private keptPopover: HTMLElement | null = null;
	/** Increases on every new hover, so a slow Scryfall answer for an older hover is ignored. */
	private hoverId = 0;

	constructor(private plugin: MtgCardPrimersPlugin) {}

	register(): void {
		// Popout windows have their own document: the ones already open, then each new one.
		for (const doc of this.plugin.windowDocuments()) this.attach(doc);
		this.plugin.registerEvent(this.plugin.app.workspace.on('window-open', (win) => this.attach(win.doc)));
		this.plugin.register(() => this.hide());
	}

	private attach(doc: Document): void {
		// Capture phase: runs even if another handler stops the event from bubbling.
		this.plugin.registerDomEvent(doc, 'mouseover', (e) => this.onMouseOver(e), { capture: true });
		this.plugin.registerDomEvent(doc, 'mouseout', (e) => this.onMouseOut(e), { capture: true });
		this.plugin.registerDomEvent(doc, 'keydown', () => this.hide(), { capture: true });
		this.plugin.registerDomEvent(doc, 'wheel', () => this.hide(), { capture: true, passive: true });
	}

	private onMouseOver(e: MouseEvent): void {
		if (!this.plugin.settings.hoverPopup) return;
		const target = e.target;
		if (!(target instanceof Node) || !target.instanceOf(HTMLElement)) return;
		const linkEl = target.closest<HTMLElement>(LINK_SELECTOR);
		if (!linkEl || linkEl === this.linkEl) return;

		this.hide();
		const linkpath = linkTarget(linkEl);
		if (!linkpath || !this.mayBeCard(linkpath)) return;

		this.linkEl = linkEl;
		const id = ++this.hoverId;
		// Hide the native preview right away so it doesn't flash before the card shows up.
		this.keptPopover = linkEl.closest<HTMLElement>('.popover');
		this.keptPopover?.addClass(KEEP_POPOVER_CLASS);
		this.hiddenNativeIn = linkEl.doc.body;
		this.hiddenNativeIn.addClass(HIDE_NATIVE_CLASS);
		this.timer = window.setTimeout(() => {
			this.timer = null;
			void this.show(linkEl, linkpath, id);
		}, SHOW_DELAY_MS);
	}

	private onMouseOut(e: MouseEvent): void {
		if (!this.linkEl) return;
		const to = e.relatedTarget;
		if (to instanceof Node) {
			if (this.linkEl.contains(to)) return;
			// Live Preview may split one link into sibling spans; moving between them is not leaving.
			const next = to.instanceOf(HTMLElement) ? to.closest<HTMLElement>(LINK_SELECTOR) : null;
			if (next && sameLink(this.linkEl, next)) return;
		}
		this.hide();
	}

	/** Links to ordinary notes keep Obsidian's normal behaviour; primers and unresolved links may be cards. */
	private mayBeCard(linkpath: string): boolean {
		const { app } = this.plugin;
		const dest = app.metadataCache.getFirstLinkpathDest(linkpath, app.workspace.getActiveFile()?.path ?? '');
		if (!dest) return true;
		return typeof app.metadataCache.getFileCache(dest)?.frontmatter?.['mtg_oracle_id'] === 'string';
	}

	private async show(linkEl: HTMLElement, linkpath: string, id: number): Promise<void> {
		let card: CardInfo | null;
		try {
			card = await this.resolve(linkpath);
		} catch (e) {
			console.warn(`[mtg-card-primers] popup: failed to fetch "${linkpath}"`, e);
			card = null;
		}
		// The mouse may have left (or left and come back) while we were waiting for Scryfall.
		if (id !== this.hoverId || this.linkEl !== linkEl || !linkEl.isConnected) return;
		if (!card) {
			// Not a card: let Obsidian's preview show again.
			this.restoreNativePreview();
			return;
		}

		const popup = linkEl.doc.body.createDiv({ cls: 'mtg-card-popup' });
		this.popupEl = popup;
		if (card.imageUrl) {
			const img = popup.createEl('img', { attr: { src: card.imageUrl, alt: card.name } });
			const fallback = card;
			img.addEventListener('error', () => {
				img.remove();
				renderCard(popup.createDiv({ cls: 'mtg-card' }), fallback, { image: false });
				this.position(popup, linkEl);
			});
		} else {
			renderCard(popup.createDiv({ cls: 'mtg-card' }), card, { image: false });
		}
		this.position(popup, linkEl);
	}

	private async resolve(linkpath: string): Promise<CardInfo | null> {
		const { app, scryfall } = this.plugin;
		const sourcePath = app.workspace.getActiveFile()?.path ?? '';
		const dest = app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);

		// Resolved link: only primers get a popup.
		// Unresolved link: a primer with that card name may still exist under another file name.
		const primer = dest ?? findPrimerByName(app, linkpath);
		if (primer) {
			const fm = app.metadataCache.getFileCache(primer)?.frontmatter;
			const saved = fm ? cardInfoFromFrontmatter(fm) : null;
			if (!saved) return null;
			try {
				const card = saved.scryfallId
					? await scryfall.cardById(saved.scryfallId)
					: await scryfall.cardExact(saved.name);
				return toCardInfo(card);
			} catch {
				return saved;
			}
		}

		if (linkpath.length < 2) return null;
		try {
			return toCardInfo(await scryfall.cardExact(linkpath));
		} catch (e) {
			if (!(e instanceof ScryfallError && e.status === 404)) throw e;
		}
		// Not an English name: maybe a name in another language ([[Anel Solar]], [[Sonnenring]]).
		try {
			return toCardInfo(await scryfall.cardByPrintedName(linkpath));
		} catch (e) {
			if (e instanceof ScryfallError && e.status === 404) return null;
			throw e;
		}
	}

	private position(popup: HTMLElement, linkEl: HTMLElement): void {
		const rect = linkEl.getBoundingClientRect();
		const height = popup.offsetHeight || (POPUP_WIDTH * 680) / 488;
		const { innerWidth, innerHeight } = linkEl.win;
		const left = Math.max(MARGIN, Math.min(rect.left, innerWidth - POPUP_WIDTH - MARGIN));
		let top = rect.bottom + MARGIN;
		if (top + height > innerHeight - MARGIN) top = Math.max(MARGIN, rect.top - height - MARGIN);
		popup.setCssStyles({ left: `${left}px`, top: `${top}px` });
	}

	private hide(): void {
		this.hoverId++;
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = null;
		this.popupEl?.remove();
		this.popupEl = null;
		this.linkEl = null;
		this.restoreNativePreview();
	}

	private restoreNativePreview(): void {
		this.hiddenNativeIn?.removeClass(HIDE_NATIVE_CLASS);
		this.hiddenNativeIn = null;
		this.keptPopover?.removeClass(KEEP_POPOVER_CLASS);
		this.keptPopover = null;
	}
}

function linkTarget(linkEl: HTMLElement): string {
	if (linkEl.instanceOf(HTMLAnchorElement)) {
		return cleanLinkpath(linkEl.getAttribute('data-href') ?? linkEl.textContent ?? '');
	}
	// In the editor, read the [[...]] under the element from the document (handles aliases).
	const raw = wikilinkAtDom(linkEl);
	return cleanLinkpath(raw ?? linkEl.textContent ?? '');
}

function wikilinkAtDom(el: HTMLElement): string | null {
	const editorEl = el.closest<HTMLElement>('.cm-editor');
	const view = editorEl ? EditorView.findFromDOM(editorEl) : null;
	if (!view) return null;
	let pos: number;
	try {
		pos = view.posAtDOM(el);
	} catch {
		return null;
	}
	const line = view.state.doc.lineAt(pos);
	const offset = pos - line.from;
	for (const m of line.text.matchAll(/\[\[([^\]]+)\]\]/g)) {
		const start = m.index ?? 0;
		if (offset >= start && offset <= start + m[0].length) return m[1] ?? null;
	}
	return null;
}

function sameLink(a: HTMLElement, b: HTMLElement): boolean {
	return a === b || (a.parentElement !== null && a.parentElement === b.parentElement && !a.instanceOf(HTMLAnchorElement));
}
