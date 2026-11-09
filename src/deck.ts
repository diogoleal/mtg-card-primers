import { Notice, setIcon, type MarkdownPostProcessorContext } from 'obsidian';
import type { ScryfallCard } from './card';
import {
	DECK_SORTS,
	groupDeck,
	manaCurve,
	parseDecklist,
	setDeckOption,
	sortCardsBy,
	typeGroup,
	withPrinting,
	type DeckEntry,
	type DeckSort,
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
	colors: string[];
	imageUrl?: string;
}

interface Group {
	label: string;
	cards: DeckCard[];
	/** Commander/companion section. */
	featured?: boolean;
}

const SORT_LABELS: Record<DeckSort, string> = { type: 'Type', name: 'Name', cmc: 'Mana value', color: 'Color' };
// Sections that count as the deck (card count, colours, curve); the rest are listed but not counted.
const MAIN_SECTIONS = ['Commander', 'Companion', 'Deck'];

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
	const sections = deck.sections.map((section) => ({
		name: section.name,
		cards: mergeSameCard(section.entries.map((e) => byEntry.get(e)!)),
	}));
	const main = sections.filter((s) => MAIN_SECTIONS.includes(s.name)).flatMap((s) => s.cards);

	/** Commander/companion first as they are; the deck split by the chosen order; other sections sorted. */
	const buildGroups = (by: DeckSort): Group[] =>
		sections.flatMap((section): Group[] => {
			if (section.name === 'Commander' || section.name === 'Companion') {
				return [{ label: section.name, cards: section.cards, featured: true }];
			}
			if (section.name === 'Deck') return groupDeck(section.cards, by);
			return [{ label: section.name, cards: sortCardsBy(section.cards, by) }];
		});
	let sort: DeckSort = deck.sort ?? 'type';
	let groups = buildGroups(sort);

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

	const sortSelect = header.createEl('select', { cls: 'dropdown mtg-deck-sort', attr: { 'aria-label': 'Sort by' } });
	for (const key of DECK_SORTS) {
		const option = sortSelect.createEl('option', { text: `Sort: ${SORT_LABELS[key]}`, attr: { value: key } });
		option.selected = key === sort;
	}

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
		void edit((src) => setDeckOption(src, 'view', next));
	};
	sortSelect.addEventListener('click', (e) => e.stopPropagation()); // Live Preview: keep the cursor out
	sortSelect.addEventListener('change', () => {
		sort = sortSelect.value as DeckSort;
		groups = buildGroups(sort);
		show(view);
		void edit((src) => setDeckOption(src, 'sort', sort));
	});
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
export async function editBlock(
	plugin: MtgCardPrimersPlugin,
	source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
	change: (source: string) => string,
	languages: string[] = ['mtg-deck'],
): Promise<boolean> {
	const opening = new RegExp(`^\\s*(\`\`\`|~~~)\\s*(?:${languages.join('|')})\\b`);
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
			if (!opening.test(fence) || normalize(inner.join('\n')) !== normalize(source)) {
				return data;
			}
			const updated = change(inner.join('\n')).split('\n');
			lines.splice(info.lineStart + 1, inner.length, ...updated);
			done = true;
			return lines.join('\n');
		});
	} catch (e) {
		console.warn('[mtg-card-primers] could not update the block', e);
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
		return { entry, card, name: entry.query.name, manaCost: '', manaValue: 0, group: 'Other', colors: [] };
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
		colors: card.colors ?? front?.colors ?? [],
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

function count(entries: DeckEntry[]): number {
	return entries.reduce((n, e) => n + e.quantity, 0);
}

function deckColors(cards: DeckCard[]): string[] {
	const set = new Set(cards.flatMap((c) => c.card?.color_identity ?? []));
	return COLOR_ORDER.filter((c) => set.has(c));
}

function renderText(plugin: MtgCardPrimersPlugin, body: HTMLElement, groups: Group[], sourcePath: string): void {
	const columns = body.createDiv({ cls: 'mtg-deck-columns' });
	const groupEls: HTMLElement[] = [];
	for (const group of groups) {
		const groupEl = columns.createDiv({ cls: 'mtg-deck-group' });
		groupEls.push(groupEl);
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
	layoutColumns(columns, groupEls, groups.map((g) => g.cards.length + 2));
}

/**
 * 'stacks': one column per group, cards overlap so only their name bar shows (hovering one shows it whole).
 * 'grid': whole cards, one grid per group.
 */
const COLUMN_MIN_WIDTH = 240;
const COLUMN_GAP = 32;
const observers = new WeakMap<HTMLElement, ResizeObserver>();

/**
 * Text view: groups in as many columns as fit, filled in order and balanced by height (rows),
 * like a newspaper. Re-laid out when the note's width changes.
 */
function layoutColumns(container: HTMLElement, items: HTMLElement[], rows: number[]): void {
	let count = 0;
	const layout = () => {
		const width = container.clientWidth;
		const fit = Math.floor((width + COLUMN_GAP) / (COLUMN_MIN_WIDTH + COLUMN_GAP));
		const next = Math.max(1, Math.min(items.length, width > 0 ? fit : 1));
		if (next === count) return;
		count = next;
		container.empty();
		const cols = Array.from({ length: count }, () => container.createDiv({ cls: 'mtg-deck-column' }));
		const total = rows.reduce((a, b) => a + b, 0);
		let col = 0;
		let filled = 0;
		items.forEach((item, i) => {
			const size = rows[i] ?? 1;
			// Next column once this group's middle would pass this column's share.
			if (col < count - 1 && filled > 0 && filled + size / 2 > (total * (col + 1)) / count) col++;
			cols[col]!.appendChild(item);
			filled += size;
		});
	};
	layout();
	observers.get(container)?.disconnect();
	const win = container.ownerDocument.defaultView ?? window;
	const observer = new win.ResizeObserver(() => {
		if (!container.isConnected) observer.disconnect();
		else layout();
	});
	observer.observe(container);
	observers.set(container, observer);
}

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
				attr: { title: `${c.entry.quantity} ${c.name}${finish}\nClick: open primer in the side panel` },
			});
			if (c.entry.quantity > 1) {
				tile.addClass('has-copies');
				tile.createSpan({ cls: 'mtg-deck-badge', text: `×${c.entry.quantity}` });
			}
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
		title: 'Open primer in the side panel',
		href: target,
		attr: { 'data-href': target, target: '_blank', rel: 'noopener' },
	});
	link.addEventListener('click', (e) => openCard(plugin, c, sourcePath, e));
	return link;
}

/** Click: the card's primer in the side panel, next to the deck. Ctrl/Cmd-click: in a new tab. */
function openCard(plugin: MtgCardPrimersPlugin, c: DeckCard, sourcePath: string, e: MouseEvent): void {
	e.preventDefault();
	const newTab = e.ctrlKey || e.metaKey;
	if (!c.card) {
		// Not on Scryfall: behave like a plain [[link]].
		void plugin.app.workspace.openLinkText(frontFaceName(c.name), sourcePath, newTab);
		return;
	}
	void plugin.openPrimer(c.card, newTab ? 'tab' : 'panel');
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
