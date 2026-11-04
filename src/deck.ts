import { Notice, setIcon, type MarkdownPostProcessorContext } from 'obsidian';
import type { ScryfallCard } from './card';
import {
	manaCurve,
	parseDecklist,
	setViewOption,
	withPrinting,
	TYPE_GROUP_LABELS,
	TYPE_GROUPS,
	typeGroup,
	type DeckEntry,
	type DeckView,
	type TypeGroup,
} from './decklist';
import { appendManaSymbol, appendManaText } from './mana';
import type MtgCardPrimersPlugin from './main';
import { PrintSuggestModal } from './modal';
import { frontFaceName } from './moxfield';

/** A decklist line with its Scryfall card (null when Scryfall has no such card). */
interface DeckCard {
	entry: DeckEntry;
	card: ScryfallCard | null;
	name: string;
	manaCost: string;
	manaValue: number;
	group: TypeGroup;
	imageUrl?: string;
}

interface Group {
	label: string;
	cards: DeckCard[];
	/** Commander/companion section. */
	featured?: boolean;
}

/** Rewrites the block's source in the note; false when the block couldn't be located safely. */
type EditBlock = (change: (source: string) => string) => Promise<boolean>;

const CURVE_LABELS = ['0', '1', '2', '3', '4', '5', '6', '7+'];
const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'];

/**
 * ```mtg-deck
 * title: Hunger Tide Aristocrats
 * view: images
 * Commander
 * 1 Grist, the Hunger Tide (DSC) 220
 * Deck
 * 1 Sol Ring
 * ```
 * A pasted Moxfield/Arena/MTGO list, shown as a text list grouped by type, as stacks of card images
 * (only the name bars show) or as a grid of whole cards.
 */
export async function renderDeckBlock(
	plugin: MtgCardPrimersPlugin,
	source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
): Promise<void> {
	const deck = parseDecklist(source);
	const root = el.createDiv({ cls: 'mtg-deck' });
	const entries = deck.sections.flatMap((s) => s.entries);
	if (entries.length === 0) {
		root.createDiv({ cls: 'mtg-card-warning', text: 'Paste a decklist inside the block: one "1 Card Name" per line.' });
		return;
	}

	const loading = root.createDiv({ cls: 'mtg-card-loading', text: `Loading ${count(entries)} cards…` });
	let cards: (ScryfallCard | null)[];
	try {
		cards = await plugin.scryfall.cards(entries.map((e) => e.query));
	} catch (e) {
		loading.remove();
		root.createDiv({ cls: 'mtg-card-warning', text: `Scryfall unavailable (${e instanceof Error ? e.message : String(e)}).` });
		cards = entries.map(() => null);
	}
	loading.remove();

	const byEntry = new Map(entries.map((entry, i) => [entry, deckCard(entry, cards[i] ?? null)]));
	const groups: Group[] = [];
	for (const section of deck.sections) {
		const sectionCards = mergeSameCard(section.entries.map((e) => byEntry.get(e)!));
		if (section.name === 'Commander' || section.name === 'Companion') {
			groups.push({ label: section.name, cards: sectionCards, featured: true });
		} else if (section.name === 'Deck') {
			for (const group of TYPE_GROUPS) {
				const inGroup = sectionCards.filter((c) => c.group === group);
				if (inGroup.length) groups.push({ label: TYPE_GROUP_LABELS[group], cards: sortCards(inGroup) });
			}
		} else {
			groups.push({ label: section.name, cards: sortCards(sectionCards) });
		}
	}

	const main = groups
		.filter((g) => !['Sideboard', 'Maybeboard', 'Tokens', 'Attractions', 'Stickers'].includes(g.label))
		.flatMap((g) => g.cards);

	const edit: EditBlock = (change) => editBlock(plugin, source, el, ctx, change);
	let view: DeckView = deck.view ?? 'text';
	const header = root.createDiv({ cls: 'mtg-deck-header' });
	const titleEl = header.createDiv({ cls: 'mtg-deck-title' });
	titleEl.createSpan({ text: deck.title ?? (groups[0]?.featured ? groups[0].cards[0]?.name : undefined) ?? 'Decklist' });
	const meta = header.createDiv({ cls: 'mtg-deck-meta' });
	const colors = deckColors(main);
	if (colors.length) {
		const pips = meta.createSpan({ cls: 'mtg-deck-colors' });
		for (const c of colors) appendManaSymbol(pips, `{${c}}`);
	}
	meta.createSpan({ text: `${count(main.map((c) => c.entry))} cards` });

	const toggle = header.createDiv({ cls: 'mtg-deck-toggle', attr: { role: 'group', 'aria-label': 'Decklist view' } });
	const buttons: Record<DeckView, HTMLButtonElement> = {
		text: toggle.createEl('button', { text: 'Text' }),
		images: toggle.createEl('button', { text: 'Images' }),
		grid: toggle.createEl('button', { text: 'Grid' }),
	};

	const body = root.createDiv({ cls: 'mtg-deck-body' });
	const show = (next: DeckView) => {
		view = next;
		for (const [key, button] of Object.entries(buttons)) {
			button.toggleClass('is-active', key === view);
			button.setAttr('aria-pressed', String(key === view));
		}
		root.toggleClass('mtg-deck-view-images', view !== 'text');
		body.empty();
		if (view === 'text') renderText(plugin, body, groups, ctx.sourcePath);
		else renderImages(plugin, body, groups, ctx.sourcePath, edit, view === 'grid' ? 'grid' : 'stacks');
	};
	const choose = (next: DeckView, e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation(); // Live Preview: don't move the cursor into the block
		if (next === view) return;
		show(next);
		void edit((src) => setViewOption(src, next));
	};
	buttons.text.addEventListener('click', (e) => choose('text', e));
	buttons.images.addEventListener('click', (e) => choose('images', e));
	buttons.grid.addEventListener('click', (e) => choose('grid', e));
	show(view);

	renderCurve(root, main);

	const missing = [...byEntry.values()].filter((c) => !c.card);
	if (missing.length) {
		root.createDiv({
			cls: 'mtg-card-warning',
			text: `Not found on Scryfall: ${missing.map((c) => c.entry.line).join(' · ')}`,
		});
	}
}

/**
 * Applies change to this block's source in the note: the view ("view: images") or a card's edition.
 * Obsidian then re-renders the block. Skipped when the block can't be located safely
 * (e.g. inside a callout, or the note was edited after the block was drawn).
 */
async function editBlock(
	plugin: MtgCardPrimersPlugin,
	source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
	change: (source: string) => string,
): Promise<boolean> {
	const info = ctx.getSectionInfo(el);
	const file = plugin.app.vault.getFileByPath(ctx.sourcePath);
	if (!info || !file) return false;
	const normalize = (t: string) => t.replace(/\r/g, '').trim();
	let done = false;
	try {
		await plugin.app.vault.process(file, (data) => {
			const lines = data.split('\n');
			const fence = lines[info.lineStart] ?? '';
			const inner = lines.slice(info.lineStart + 1, info.lineEnd);
			if (!/^\s*(```|~~~)\s*mtg-deck\b/.test(fence) || normalize(inner.join('\n')) !== normalize(source)) {
				return data;
			}
			const updated = change(inner.join('\n')).split('\n');
			lines.splice(info.lineStart + 1, inner.length, ...updated);
			done = true;
			return lines.join('\n');
		});
	} catch (e) {
		console.warn('[mtg-card-primers] could not update the decklist block', e);
		return false;
	}
	return done;
}

/** Edition picker for one card; the chosen printing is written into its line as "(SET) 123". */
async function chooseEdition(plugin: MtgCardPrimersPlugin, c: DeckCard, edit: EditBlock): Promise<void> {
	const oracleId = c.card?.oracle_id ?? c.card?.card_faces?.[0]?.oracle_id;
	if (!c.card || !oracleId) return;
	const current = c.card;
	const notice = new Notice('Fetching editions…', 0);
	let prints: ScryfallCard[];
	try {
		prints = await plugin.scryfall.prints(oracleId);
	} catch (e) {
		new Notice(`MTG Card Primers: ${e instanceof Error ? e.message : String(e)}`);
		return;
	} finally {
		notice.hide();
	}
	const list = [current, ...prints.filter((p) => p.id !== current.id)];
	new PrintSuggestModal(plugin.app, list, (print) => {
		const line = withPrinting(c.entry.line, print.set, print.collector_number);
		void edit((src) => replaceLine(src, c.entry.line, line)).then((ok) => {
			if (!ok) new Notice(`Couldn't update the decklist. Change the line by hand to: ${line}`);
		});
	}).open();
}

/** Replaces the first line that reads `from` (ignoring indentation), keeping its indentation. */
function replaceLine(source: string, from: string, to: string): string {
	const lines = source.split('\n');
	const i = lines.findIndex((l) => l.trim() === from.trim());
	if (i >= 0) lines[i] = lines[i]!.replace(/^(\s*)[^\r]*/, `$1${to}`);
	return lines.join('\n');
}

function deckCard(entry: DeckEntry, card: ScryfallCard | null): DeckCard {
	if (!card) {
		return { entry, card, name: entry.query.name, manaCost: '', manaValue: 0, group: 'Other' };
	}
	const front = card.card_faces?.[0];
	const typeLine = card.type_line ?? front?.type_line ?? '';
	const images = card.image_uris ?? front?.image_uris;
	return {
		entry,
		card,
		name: card.name,
		// Double-faced cards: the cost of the front face (the one you cast).
		manaCost: card.mana_cost ?? front?.mana_cost ?? '',
		manaValue: card.cmc ?? 0,
		group: typeGroup(typeLine),
		imageUrl: images?.normal ?? images?.large ?? images?.small,
	};
}

/** "Anel Solar" and "Sol Ring (C21) 263" are the same card: one row, quantities added. */
function mergeSameCard(cards: DeckCard[]): DeckCard[] {
	const out: DeckCard[] = [];
	for (const c of cards) {
		const same = c.card
			? out.find((o) => o.card?.oracle_id === c.card?.oracle_id && o.entry.finish === c.entry.finish)
			: undefined;
		if (same) same.entry = { ...same.entry, quantity: same.entry.quantity + c.entry.quantity };
		else out.push({ ...c });
	}
	return out;
}

function sortCards(cards: DeckCard[]): DeckCard[] {
	return [...cards].sort((a, b) => a.manaValue - b.manaValue || a.name.localeCompare(b.name));
}

function count(entries: DeckEntry[]): number {
	return entries.reduce((n, e) => n + e.quantity, 0);
}

function deckColors(cards: DeckCard[]): string[] {
	const set = new Set(cards.flatMap((c) => c.card?.color_identity ?? []));
	return COLOR_ORDER.filter((c) => set.has(c));
}

function renderText(plugin: MtgCardPrimersPlugin, body: HTMLElement, groups: Group[], sourcePath: string): void {
	const columns = body.createDiv({ cls: 'mtg-deck-columns' });
	for (const group of groups) {
		const groupEl = columns.createDiv({ cls: 'mtg-deck-group' });
		groupHeading(groupEl, group);
		const list = groupEl.createEl('ul', { cls: 'mtg-deck-list' });
		for (const c of group.cards) {
			const row = list.createEl('li', { cls: c.card ? 'mtg-deck-row' : 'mtg-deck-row is-missing' });
			row.createSpan({ cls: 'mtg-deck-qty', text: String(c.entry.quantity) });
			const nameEl = row.createSpan({ cls: 'mtg-deck-name' });
			cardLink(plugin, nameEl, c, sourcePath).setText(c.name);
			if (c.entry.finish) nameEl.createSpan({ cls: `mtg-deck-finish is-${c.entry.finish}`, text: c.entry.finish });
			if (c.manaCost) appendManaText(row.createSpan({ cls: 'mtg-deck-cost' }), c.manaCost.split(' // ')[0] ?? '');
		}
	}
}

/**
 * 'stacks': one column per group, cards overlap so only their name bar shows (hovering one shows it whole).
 * 'grid': whole cards, one grid per group.
 */
function renderImages(
	plugin: MtgCardPrimersPlugin,
	body: HTMLElement,
	groups: Group[],
	sourcePath: string,
	edit: EditBlock,
	layout: 'stacks' | 'grid',
): void {
	const columns = body.createDiv({ cls: layout === 'grid' ? 'mtg-deck-grids' : 'mtg-deck-stacks' });
	for (const group of groups) {
		const groupEl = columns.createDiv({ cls: 'mtg-deck-group' });
		groupHeading(groupEl, group);
		const stack = groupEl.createDiv({ cls: layout === 'grid' ? 'mtg-deck-grid' : 'mtg-deck-stack' });
		for (const c of group.cards) {
			const finish = c.entry.finish ? ` (${c.entry.finish})` : '';
			const tile = stack.createDiv({
				cls: c.entry.finish ? `mtg-deck-tile is-${c.entry.finish}` : 'mtg-deck-tile',
				attr: { title: `${c.entry.quantity} ${c.name}${finish}` },
			});
			if (c.entry.quantity > 1) tile.createSpan({ cls: 'mtg-deck-badge', text: `×${c.entry.quantity}` });
			if (c.imageUrl) {
				const img = tile.createEl('img', { attr: { src: c.imageUrl, alt: c.name, loading: 'lazy' } });
				img.addEventListener('error', () => {
					img.remove();
					tile.createDiv({ cls: 'mtg-deck-placeholder', text: c.name });
				});
			} else {
				tile.createDiv({ cls: 'mtg-deck-placeholder', text: c.name });
			}
			tile.addEventListener('click', (e) => openCard(plugin, c, sourcePath, e));
			if (c.card) {
				const pick = (e: MouseEvent) => {
					e.preventDefault();
					e.stopPropagation();
					void chooseEdition(plugin, c, edit);
				};
				const button = tile.createEl('button', {
					cls: 'mtg-deck-edition clickable-icon',
					attr: { 'aria-label': 'Choose edition', title: 'Choose edition' },
				});
				setIcon(button, 'images');
				button.addEventListener('click', pick);
				tile.addEventListener('contextmenu', pick); // right-click, or long-press on mobile
			}
		}
	}
}

function groupHeading(parent: HTMLElement, group: Group): void {
	const heading = parent.createDiv({ cls: 'mtg-deck-group-title' });
	heading.createSpan({ text: group.label });
	heading.createSpan({ cls: 'mtg-deck-group-count', text: String(count(group.cards.map((c) => c.entry))) });
}

/** Behaves like a [[wikilink]]: hover shows the card, click opens (or creates) the note. */
function cardLink(plugin: MtgCardPrimersPlugin, parent: HTMLElement, c: DeckCard, sourcePath: string): HTMLElement {
	const target = frontFaceName(c.name);
	const resolved = plugin.app.metadataCache.getFirstLinkpathDest(target, sourcePath);
	const link = parent.createEl('a', {
		cls: resolved ? 'internal-link' : 'internal-link is-unresolved',
		href: target,
		attr: { 'data-href': target, target: '_blank', rel: 'noopener' },
	});
	link.addEventListener('click', (e) => openCard(plugin, c, sourcePath, e));
	return link;
}

function openCard(plugin: MtgCardPrimersPlugin, c: DeckCard, sourcePath: string, e: MouseEvent): void {
	e.preventDefault();
	void plugin.app.workspace.openLinkText(frontFaceName(c.name), sourcePath, e.ctrlKey || e.metaKey);
}

function renderCurve(root: HTMLElement, cards: DeckCard[]): void {
	const curve = manaCurve(cards.map((c) => ({ quantity: c.entry.quantity, manaValue: c.manaValue, group: c.group })));
	const max = Math.max(...curve);
	if (max === 0) return;
	const footer = root.createDiv({ cls: 'mtg-deck-footer' });
	const chart = footer.createDiv({ cls: 'mtg-deck-curve', attr: { 'aria-label': 'Mana curve' } });
	curve.forEach((n, i) => {
		const col = chart.createDiv({ cls: 'mtg-deck-curve-col', attr: { title: `${n} card${n === 1 ? '' : 's'} with mana value ${CURVE_LABELS[i]}` } });
		col.createSpan({ cls: 'mtg-deck-curve-count', text: n ? String(n) : '' });
		col.createDiv({ cls: 'mtg-deck-curve-bar' }).setCssProps({ '--mtg-curve': String(n / max) });
		col.createSpan({ cls: 'mtg-deck-curve-label', text: CURVE_LABELS[i] });
	});
}
