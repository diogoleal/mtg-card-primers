import { MarkdownRenderChild, MarkdownRenderer, setIcon, type MarkdownPostProcessorContext } from 'obsidian';
import type { ScryfallCard } from './card';
import { editBlock } from './deck';
import type MtgCardPrimersPlugin from './main';
import { appendManaText, replaceManaInElement } from './mana';
import { frontFaceName, type CardQuery } from './moxfield';
import { count, parseSwaps, setSwapView, type Swap, type SwapCard, type SwapGroup, type SwapView } from './swap';

/** Block languages and the title each one shows when the block has none. */
export const SWAP_BLOCKS: Record<string, string> = {
	'mtg-sideboard': 'Sideboard',
	'mtg-changes': 'Deck changes',
};

type Side = 'out' | 'in';
const SIDE_LABELS: Record<Side, string> = { out: 'Out', in: 'In' };
const SIDE_ICONS: Record<Side, string> = { out: 'minus-circle', in: 'plus-circle' };
const SIDE_SIGNS: Record<Side, string> = { out: '−', in: '+' };

interface Context {
	plugin: MtgCardPrimersPlugin;
	found: Map<CardQuery, ScryfallCard | null>;
	sourcePath: string;
	/** Renders Markdown (links with hover previews, mana symbols) into parent. */
	markdown: (parent: HTMLElement, cls: string, text: string) => Promise<void>;
}

/**
 * ```mtg-sideboard
 * vs. Aggro:
 * 2 Fabled Passage -> 2 Verdant Catacombs — faster
 * ```
 * What leaves the deck and what takes its place, with an arrow between them.
 */
export async function renderSwapBlock(
	plugin: MtgCardPrimersPlugin,
	language: string,
	source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
): Promise<void> {
	const swaps = parseSwaps(source);
	const root = el.createDiv({ cls: 'mtg-swap' });
	const all = swaps.groups.flatMap((g) => g.swaps.flatMap((s) => [...s.out, ...s.in]));

	const header = root.createDiv({ cls: 'mtg-swap-header' });
	const titleEl = header.createDiv({ cls: 'mtg-swap-title' });
	setIcon(titleEl.createSpan({ cls: 'mtg-swap-title-icon' }), 'arrow-left-right');
	titleEl.createSpan({ text: swaps.title ?? SWAP_BLOCKS[language] ?? 'Changes' });

	if (!all.length && !swaps.groups.some((g) => g.notes.length)) {
		root.createDiv({
			cls: 'mtg-swap-empty-hint',
			text: 'Write what comes out and what goes in, one change per line: Fabled Passage -> Verdant Catacombs',
		});
		return;
	}

	const out = all.length ? count(swaps.groups.flatMap((g) => g.swaps.flatMap((s) => s.out))) : 0;
	const added = all.length ? count(swaps.groups.flatMap((g) => g.swaps.flatMap((s) => s.in))) : 0;
	if (all.length) renderTotals(header, out, added);

	let view: SwapView = swaps.view ?? 'images';
	const toggle = header.createDiv({ cls: 'mtg-deck-toggle', attr: { role: 'group', 'aria-label': 'View' } });
	const buttons: Record<SwapView, HTMLButtonElement> = {
		images: toggle.createEl('button', { text: 'Images' }),
		text: toggle.createEl('button', { text: 'Text' }),
	};

	const queries = all.map((c) => c.query);
	const loading = root.createDiv({ cls: 'mtg-card-loading', text: 'Loading cards…' });
	let cards: (ScryfallCard | null)[];
	try {
		cards = await plugin.scryfall.cards(queries);
	} catch (e) {
		root.createDiv({ cls: 'mtg-card-warning', text: `Scryfall unavailable (${e instanceof Error ? e.message : String(e)}).` });
		cards = queries.map(() => null);
	}
	loading.remove();

	const child = new MarkdownRenderChild(root);
	ctx.addChild(child);
	const context: Context = {
		plugin,
		found: new Map(queries.map((q, i) => [q, cards[i] ?? null])),
		sourcePath: ctx.sourcePath,
		markdown: async (parent, cls, text) => {
			const box = parent.createDiv({ cls });
			await MarkdownRenderer.render(plugin.app, text, box, ctx.sourcePath, child);
			if (plugin.settings.manaSymbols) replaceManaInElement(box);
		},
	};

	const body = root.createDiv({ cls: 'mtg-swap-body' });
	const show = async (next: SwapView) => {
		view = next;
		for (const [key, button] of Object.entries(buttons)) {
			button.toggleClass('is-active', key === view);
			button.setAttr('aria-pressed', String(key === view));
		}
		root.toggleClass('is-text', view === 'text');
		body.empty();
		for (const group of swaps.groups) await renderGroup(body, group, view, context, swaps.groups.length > 1);
	};
	for (const key of Object.keys(buttons) as SwapView[]) {
		buttons[key].addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation(); // Live Preview: don't move the cursor into the block
			if (key === view) return;
			void show(key);
			void editBlock(plugin, source, el, ctx, (src) => setSwapView(src, key), Object.keys(SWAP_BLOCKS));
		});
	}
	await show(view);

	const missing = all.filter((c) => !context.found.get(c.query));
	if (missing.length) {
		root.createDiv({ cls: 'mtg-card-warning', text: `Not found on Scryfall: ${missing.map((c) => c.query.name).join(' · ')}` });
	}
}

/** "−3 +3", and how the deck size changes when the two sides don't match. */
function renderTotals(parent: HTMLElement, out: number, added: number): void {
	const totals = parent.createDiv({ cls: 'mtg-swap-totals' });
	// A list of cuts (or of additions) only shows its own side: "−0" and "deck −5" would repeat it.
	if (out) totals.createSpan({ cls: 'mtg-swap-total is-out', text: `${SIDE_SIGNS.out}${out}`, attr: { title: `${out} card${out === 1 ? '' : 's'} out` } });
	if (added) totals.createSpan({ cls: 'mtg-swap-total is-in', text: `${SIDE_SIGNS.in}${added}`, attr: { title: `${added} card${added === 1 ? '' : 's'} in` } });
	const diff = added - out;
	if (diff !== 0 && out && added) {
		totals.createSpan({
			cls: 'mtg-swap-balance',
			text: `deck ${diff > 0 ? '+' : '−'}${Math.abs(diff)}`,
			attr: { title: `The deck ends ${Math.abs(diff)} card${Math.abs(diff) === 1 ? '' : 's'} ${diff > 0 ? 'bigger' : 'smaller'}` },
		});
	}
}

async function renderGroup(body: HTMLElement, group: SwapGroup, view: SwapView, context: Context, showTotals: boolean): Promise<void> {
	const groupEl = body.createDiv({ cls: 'mtg-swap-group' });
	if (group.title) {
		const heading = groupEl.createDiv({ cls: 'mtg-swap-group-title' });
		heading.createSpan({ text: group.title });
		if (showTotals && group.swaps.length) {
			renderTotals(heading, count(group.swaps.flatMap((s) => s.out)), count(group.swaps.flatMap((s) => s.in)));
		}
	}

	if (group.swaps.length) {
		const grid = groupEl.createDiv({ cls: 'mtg-swap-grid' });
		for (const side of ['out', 'in'] as const) {
			if (side === 'in') grid.createDiv(); // over the arrows
			const label = grid.createDiv({ cls: `mtg-swap-side-title is-${side}` });
			setIcon(label.createSpan({ cls: 'mtg-swap-side-icon' }), SIDE_ICONS[side]);
			label.createSpan({ text: SIDE_LABELS[side] });
		}
		for (const swap of group.swaps) await renderSwap(grid, swap, view, context);
	}

	if (group.notes.length) await context.markdown(groupEl, 'mtg-swap-notes', group.notes.join('\n'));
}

async function renderSwap(grid: HTMLElement, swap: Swap, view: SwapView, context: Context): Promise<void> {
	const row = (side: Side) => {
		const cell = grid.createDiv({ cls: `mtg-swap-side is-${side}` });
		const cards = swap[side];
		if (!cards.length) {
			cell.createSpan({ cls: 'mtg-swap-nothing', text: '—', attr: { title: side === 'out' ? 'Nothing comes out' : 'Nothing goes in' } });
			return;
		}
		for (const c of cards) {
			if (view === 'text') renderTextCard(cell, c, side, context);
			else renderImageCard(cell, c, side, context);
		}
	};
	row('out');
	const arrow = grid.createDiv({ cls: 'mtg-swap-arrow', attr: { 'aria-label': 'replaced by' } });
	setIcon(arrow, 'arrow-right');
	row('in');
	if (swap.note) await context.markdown(grid, 'mtg-swap-note', swap.note);
}

function renderImageCard(parent: HTMLElement, c: SwapCard, side: Side, context: Context): void {
	const card = context.found.get(c.query) ?? null;
	const name = card?.name ?? c.query.name;
	const tile = parent.createDiv({
		cls: `mtg-swap-card is-${side}`,
		attr: { title: `${SIDE_SIGNS[side]}${c.quantity} ${name}\nClick: open primer in the side panel` },
	});
	if (c.quantity > 1) tile.addClass('has-copies');
	const face = tile.createDiv({ cls: 'mtg-swap-face' });
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
	tile.createSpan({ cls: `mtg-swap-qty is-${side}`, text: `${SIDE_SIGNS[side]}${c.quantity}` });
	tile.addEventListener('click', (e) => open(e, c, card, context));
}

function renderTextCard(parent: HTMLElement, c: SwapCard, side: Side, context: Context): void {
	const card = context.found.get(c.query) ?? null;
	const name = card?.name ?? c.query.name;
	const line = parent.createDiv({ cls: card ? 'mtg-swap-line' : 'mtg-swap-line is-missing' });
	line.createSpan({ cls: `mtg-swap-qty is-${side}`, text: `${SIDE_SIGNS[side]}${c.quantity}` });
	// Behaves like a [[wikilink]]: hovering shows the card.
	const target = frontFaceName(name);
	const resolved = context.plugin.app.metadataCache.getFirstLinkpathDest(target, context.sourcePath);
	const link = line.createEl('a', {
		cls: resolved ? 'internal-link mtg-swap-name' : 'internal-link is-unresolved mtg-swap-name',
		text: name,
		href: target,
		attr: { 'data-href': target, target: '_blank', rel: 'noopener', title: 'Open primer in the side panel' },
	});
	link.addEventListener('click', (e) => open(e, c, card, context));
	const cost = card?.mana_cost ?? card?.card_faces?.[0]?.mana_cost;
	if (cost) appendManaText(line.createSpan({ cls: 'mtg-swap-cost' }), cost.split(' // ')[0] ?? '');
}

/** Click: the card's primer in the side panel. Ctrl/Cmd-click: in a new tab. */
function open(e: MouseEvent, c: SwapCard, card: ScryfallCard | null, context: Context): void {
	e.preventDefault();
	e.stopPropagation(); // Live Preview: don't move the cursor into the block
	const newTab = e.ctrlKey || e.metaKey;
	if (card) void context.plugin.openPrimer(card, newTab ? 'tab' : 'panel');
	else void context.plugin.app.workspace.openLinkText(frontFaceName(c.query.name), context.sourcePath, newTab);
}
