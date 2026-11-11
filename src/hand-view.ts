import { MarkdownRenderChild, MarkdownRenderer, setIcon, type MarkdownPostProcessorContext } from 'obsidian';
import type { ScryfallCard } from './card';
import { editBlock } from './deck';
import { handSize, parseHand, setHandView, type Hand, type HandCard, type HandView, type Verdict } from './hand';
import type MtgCardPrimersPlugin from './main';
import { appendManaText, replaceManaInElement } from './mana';
import { frontFaceName } from './moxfield';
import { openCard } from './swap-view';

const VERDICTS: Record<Verdict, { label: string; icon: string; why: string }> = {
	keep: { label: 'Keep', icon: 'check-circle-2', why: 'Why keep' },
	mulligan: { label: 'Mulligan', icon: 'rotate-ccw', why: 'Why mulligan' },
};

interface Context {
	plugin: MtgCardPrimersPlugin;
	found: Map<HandCard, ScryfallCard | null>;
	sourcePath: string;
	markdown: (parent: HTMLElement, cls: string, text: string) => Promise<void>;
}

/**
 * ```mtg-hand
 * keep
 * Sol Ring — turn 1
 * 2 Swamp
 * why: ...
 * ```
 * An opening hand, fanned out, with the decision to keep it or mulligan.
 */
export async function renderHandBlock(
	plugin: MtgCardPrimersPlugin,
	source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
): Promise<void> {
	const hand = parseHand(source);
	const root = el.createDiv({ cls: 'mtg-hand' });
	if (hand.verdict) root.addClass(`is-${hand.verdict}`);

	const header = root.createDiv({ cls: 'mtg-hand-header' });
	const titleEl = header.createDiv({ cls: 'mtg-hand-title' });
	setIcon(titleEl.createSpan({ cls: 'mtg-hand-title-icon' }), 'hand');
	titleEl.createSpan({ text: hand.title ?? 'Opening hand' });
	if (hand.verdict) {
		const v = VERDICTS[hand.verdict];
		const badge = header.createDiv({ cls: `mtg-hand-verdict is-${hand.verdict}` });
		setIcon(badge.createSpan({ cls: 'mtg-hand-verdict-icon' }), v.icon);
		badge.createSpan({ text: v.label });
	}
	if (hand.play) header.createSpan({ cls: 'mtg-hand-chip', text: hand.play === 'play' ? 'On the play' : 'On the draw' });

	if (!hand.cards.length) {
		root.createDiv({
			cls: 'mtg-hand-empty-hint',
			text: 'Write the cards of the hand one per line, then keep or mulligan, and why: below them.',
		});
		if (hand.why.length) await renderWhy(root, hand, plugin, ctx, null);
		return;
	}

	const stats = header.createSpan({ cls: 'mtg-hand-stats' });
	let view: HandView = hand.view ?? 'images';
	const toggle = header.createDiv({ cls: 'mtg-deck-toggle', attr: { role: 'group', 'aria-label': 'View' } });
	const buttons: Record<HandView, HTMLButtonElement> = {
		images: toggle.createEl('button', { text: 'Images' }),
		text: toggle.createEl('button', { text: 'Text' }),
	};

	const loading = root.createDiv({ cls: 'mtg-card-loading', text: 'Loading cards…' });
	let cards: (ScryfallCard | null)[];
	try {
		cards = await plugin.scryfall.cards(hand.cards.map((c) => c.query));
	} catch (e) {
		root.createDiv({ cls: 'mtg-card-warning', text: `Scryfall unavailable (${e instanceof Error ? e.message : String(e)}).` });
		cards = hand.cards.map(() => null);
	}
	loading.remove();

	const child = new MarkdownRenderChild(root);
	ctx.addChild(child);
	const context: Context = {
		plugin,
		found: new Map(hand.cards.map((c, i) => [c, cards[i] ?? null])),
		sourcePath: ctx.sourcePath,
		markdown: async (parent, cls, text) => {
			const box = parent.createDiv({ cls });
			await MarkdownRenderer.render(plugin.app, text, box, ctx.sourcePath, child);
			if (plugin.settings.manaSymbols) replaceManaInElement(box);
		},
	};

	// "7 cards · 3 lands · 4 spells": the first thing to count before keeping a hand.
	const lands = hand.cards.filter((c) => isLand(context.found.get(c) ?? null)).reduce((n, c) => n + c.quantity, 0);
	const size = handSize(hand);
	const known = hand.cards.every((c) => context.found.get(c));
	stats.setText(known ? `${size} cards · ${plural(lands, 'land')} · ${plural(size - lands, 'spell')}` : `${size} cards`);

	const body = root.createDiv({ cls: 'mtg-hand-body' });
	const show = async (next: HandView) => {
		view = next;
		for (const [key, button] of Object.entries(buttons)) {
			button.toggleClass('is-active', key === view);
			button.setAttr('aria-pressed', String(key === view));
		}
		root.toggleClass('is-text', view === 'text');
		body.empty();
		if (view === 'text') renderText(body, hand, context);
		else renderFan(body, hand, context);
		const notes = hand.cards.filter((c) => c.note);
		if (view === 'images' && notes.length) {
			await context.markdown(body, 'mtg-hand-card-notes', notes.map((c) => `- [[${frontFaceName(cardName(c, context))}]]: ${c.note}`).join('\n'));
		}
	};
	for (const key of Object.keys(buttons) as HandView[]) {
		buttons[key].addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation(); // Live Preview: don't move the cursor into the block
			if (key === view) return;
			void show(key);
			void editBlock(plugin, source, el, ctx, (src) => setHandView(src, key), ['mtg-hand']);
		});
	}
	await show(view);
	if (hand.why.length) await renderWhy(root, hand, plugin, ctx, context);

	const missing = hand.cards.filter((c) => !context.found.get(c));
	if (missing.length) {
		root.createDiv({ cls: 'mtg-card-warning', text: `Not found on Scryfall: ${missing.map((c) => c.query.name).join(' · ')}` });
	}
}

/** The cards spread like a hand held in front of you, one image per copy. */
function renderFan(body: HTMLElement, hand: Hand, context: Context): void {
	const copies = hand.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c));
	const fan = body.createDiv({ cls: 'mtg-hand-fan' });
	fan.setCssProps({ '--mtg-hand-n': String(copies.length) });
	const middle = (copies.length - 1) / 2;
	const step = Math.min(5, 28 / Math.max(copies.length, 1));
	copies.forEach((c, i) => {
		const card = context.found.get(c) ?? null;
		const name = cardName(c, context);
		const offset = i - middle;
		const tile = fan.createDiv({ cls: 'mtg-hand-card', attr: { title: `${name}\nClick: open primer in the side panel` } });
		tile.setCssProps({
			'--mtg-hand-angle': `${(offset * step).toFixed(2)}deg`,
			'--mtg-hand-drop': `${(offset * offset * step * 0.6).toFixed(2)}px`,
		});
		const face = tile.createDiv({ cls: 'mtg-hand-face' });
		const images = card?.image_uris ?? card?.card_faces?.[0]?.image_uris;
		const url = images?.normal ?? images?.large ?? images?.small;
		const placeholder = () => face.createDiv({ cls: 'mtg-deck-placeholder', text: name });
		if (url) {
			const img = face.createEl('img', { attr: { src: url, alt: name, loading: 'lazy' } });
			img.addEventListener('error', () => {
				img.remove();
				placeholder();
			});
		} else {
			placeholder();
		}
		tile.addEventListener('click', (e) => openCard(e, context.plugin, c.query, card, context.sourcePath));
	});
}

/** Spells and lands in two lists, with mana costs and the notes. */
function renderText(body: HTMLElement, hand: Hand, context: Context): void {
	const columns = body.createDiv({ cls: 'mtg-hand-columns' });
	const groups: [string, HandCard[]][] = [
		['Spells', hand.cards.filter((c) => !isLand(context.found.get(c) ?? null))],
		['Lands', hand.cards.filter((c) => isLand(context.found.get(c) ?? null))],
	];
	for (const [label, list] of groups) {
		if (!list.length) continue;
		const column = columns.createDiv({ cls: 'mtg-hand-column' });
		const heading = column.createDiv({ cls: 'mtg-deck-group-title' });
		heading.createSpan({ text: label });
		heading.createSpan({ cls: 'mtg-deck-group-count', text: String(list.reduce((n, c) => n + c.quantity, 0)) });
		for (const c of list) {
			const card = context.found.get(c) ?? null;
			const name = cardName(c, context);
			const line = column.createDiv({ cls: card ? 'mtg-hand-line' : 'mtg-hand-line is-missing' });
			line.createSpan({ cls: 'mtg-hand-qty', text: String(c.quantity) });
			// Behaves like a [[wikilink]]: hovering shows the card.
			const target = frontFaceName(name);
			const resolved = context.plugin.app.metadataCache.getFirstLinkpathDest(target, context.sourcePath);
			const link = line.createEl('a', {
				cls: resolved ? 'internal-link mtg-hand-name' : 'internal-link is-unresolved mtg-hand-name',
				text: name,
				href: target,
				attr: { 'data-href': target, target: '_blank', rel: 'noopener', title: 'Open primer in the side panel' },
			});
			link.addEventListener('click', (e) => openCard(e, context.plugin, c.query, card, context.sourcePath));
			const cost = card?.mana_cost ?? card?.card_faces?.[0]?.mana_cost;
			if (cost) appendManaText(line.createSpan({ cls: 'mtg-hand-cost' }), cost.split(' // ')[0] ?? '');
			if (c.note) void context.markdown(column, 'mtg-hand-line-note', c.note);
		}
	}
}

async function renderWhy(
	root: HTMLElement,
	hand: Hand,
	plugin: MtgCardPrimersPlugin,
	ctx: MarkdownPostProcessorContext,
	context: Context | null,
): Promise<void> {
	const box = root.createDiv({ cls: 'mtg-hand-why' });
	box.createDiv({ cls: 'mtg-hand-why-title', text: hand.verdict ? VERDICTS[hand.verdict].why : 'Why' });
	const text = hand.why.join('\n');
	if (context) {
		await context.markdown(box, 'mtg-hand-why-text', text);
		return;
	}
	const child = new MarkdownRenderChild(root);
	ctx.addChild(child);
	const target = box.createDiv({ cls: 'mtg-hand-why-text' });
	await MarkdownRenderer.render(plugin.app, text, target, ctx.sourcePath, child);
	if (plugin.settings.manaSymbols) replaceManaInElement(target);
}

function cardName(c: HandCard, context: Context): string {
	return context.found.get(c)?.name ?? c.query.name;
}

/** The front face is a land (a modal double-faced spell // land counts as a spell). */
function isLand(card: ScryfallCard | null): boolean {
	const type = card?.card_faces?.[0]?.type_line ?? card?.type_line ?? '';
	return /\bLand\b/.test(type.split(' // ')[0] ?? '');
}

function plural(n: number, word: string): string {
	return `${n} ${word}${n === 1 ? '' : 's'}`;
}
