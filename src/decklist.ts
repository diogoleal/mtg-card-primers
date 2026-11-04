/**
 * Decklist parsing and grouping for the mtg-deck block.
 * Pure module (no Obsidian imports) so it can be unit-tested with node:test.
 */
import { parseMoxfieldLine, type CardQuery } from './moxfield.ts';

export type DeckView = 'text' | 'images' | 'grid';
export type DeckSort = 'type' | 'name' | 'cmc' | 'color';
export const DECK_SORTS: DeckSort[] = ['type', 'name', 'cmc', 'color'];

/** Moxfield markers: *F* foil, *E* etched foil. */
export type Finish = 'foil' | 'etched';

export interface DeckEntry {
	quantity: number;
	query: CardQuery;
	finish?: Finish;
	/** The line as written, for error messages. */
	line: string;
}

export interface DeckSection {
	/** "Commander", "Deck", "Sideboard"… ("Deck" when the list has no headers). */
	name: string;
	entries: DeckEntry[];
}

export interface Decklist {
	title?: string;
	view?: DeckView;
	sort?: DeckSort;
	sections: DeckSection[];
}

// Section names used by Moxfield, Archidekt, MTGA and MTGO exports.
const KNOWN_SECTIONS: Record<string, string> = {
	commander: 'Commander',
	commanders: 'Commander',
	companion: 'Companion',
	deck: 'Deck',
	main: 'Deck',
	mainboard: 'Deck',
	maindeck: 'Deck',
	sideboard: 'Sideboard',
	side: 'Sideboard',
	maybeboard: 'Maybeboard',
	maybe: 'Maybeboard',
	considering: 'Maybeboard',
	tokens: 'Tokens',
	attractions: 'Attractions',
	stickers: 'Stickers',
};

const QUANTITY = /^(\d{1,3})x?\s+/i;
const OPTION = /^(title|view|sort)\s*:\s*(.+)$/i;

/**
 * Reads a pasted decklist:
 *   title: Hunger Tide Aristocrats      (optional)
 *   view: images                        (optional: text | images | grid)
 *   Commander
 *   1 Grist, the Hunger Tide (DSC) 220
 *
 *   Deck
 *   1 Sol Ring (C21) 263
 * Section headers may also be written "// Sideboard", "SIDEBOARD:" or "Sideboard (15)".
 * Blank lines: in a header-less list, cards after the first blank line are the sideboard (MTGA);
 * after a Commander/Companion section, they are the deck (Moxfield and others omit the "Deck" header).
 */
export function parseDecklist(source: string): Decklist {
	const deck: Decklist = { sections: [] };
	let current: DeckSection | null = null;
	let sawCard = false;
	let blankAfterCards = false;
	let usedHeaders = false;

	const section = (name: string): DeckSection => {
		const existing = deck.sections.find((s) => s.name === name);
		if (existing) return existing;
		const created = { name, entries: [] };
		deck.sections.push(created);
		return created;
	};

	for (const raw of source.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line) {
			if (sawCard) blankAfterCards = true;
			continue;
		}

		const option = OPTION.exec(line);
		if (option && !sawCard) {
			const key = option[1]!.toLowerCase();
			const value = option[2]!.trim();
			if (key === 'title') deck.title = value;
			else if (key === 'sort') deck.sort = parseSort(value) ?? deck.sort;
			else if (/^images?$/i.test(value)) deck.view = 'images';
			else if (/^grid$/i.test(value)) deck.view = 'grid';
			else if (/^text$/i.test(value)) deck.view = 'text';
			continue;
		}

		const header = sectionName(line);
		if (header) {
			current = section(header);
			usedHeaders = true;
			blankAfterCards = false;
			continue;
		}
		if (line.startsWith('//') || line.startsWith('#')) continue; // comment

		const query = parseMoxfieldLine(line);
		if (!query) continue;
		const quantity = Number(QUANTITY.exec(line)?.[1] ?? 1);

		// MTGA/MTGO: a header-less list where a blank line separates the sideboard.
		if (!usedHeaders && blankAfterCards && current?.name === 'Deck') current = section('Sideboard');
		// "Commander / 1 Grist / (blank) / 1 Sol Ring…": cards after a blank line under the commander are the deck.
		if (blankAfterCards && (current?.name === 'Commander' || current?.name === 'Companion')) current = section('Deck');
		blankAfterCards = false;
		current ??= section('Deck');

		const finish = lineFinish(line);
		const existing = current.entries.find((e) => sameQuery(e.query, query) && e.finish === finish);
		if (existing) existing.quantity += quantity;
		else current.entries.push(finish ? { quantity, query, finish, line } : { quantity, query, line });
		sawCard = true;
	}

	deck.sections = deck.sections.filter((s) => s.entries.length > 0);
	return deck;
}

/** "1 Sol Ring (C21) 263 *F*" → 'foil'; "*E*" → 'etched'; undefined for a regular card. */
export function lineFinish(line: string): Finish | undefined {
	if (/\s\*E\*(?=\s|$)/i.test(line)) return 'etched';
	if (/\s\*F\*(?=\s|$)/i.test(line)) return 'foil';
	return undefined;
}

/** "Sideboard", "// Sideboard", "SIDEBOARD:", "Sideboard (15)" → "Sideboard"; null when not a header. */
export function sectionName(line: string): string | null {
	const cleaned = line
		.replace(/^\/\/\s*/, '')
		.replace(/\s*\(\d+\)\s*$/, '')
		.replace(/:\s*$/, '')
		.trim()
		.toLowerCase();
	return KNOWN_SECTIONS[cleaned] ?? null;
}

function sameQuery(a: CardQuery, b: CardQuery): boolean {
	return (
		a.name.toLowerCase() === b.name.toLowerCase() && a.set === b.set && a.collectorNumber === b.collectorNumber
	);
}

/** Card type groups, in the order decklists usually show them. */
export const TYPE_GROUPS = [
	'Creature',
	'Planeswalker',
	'Battle',
	'Instant',
	'Sorcery',
	'Artifact',
	'Enchantment',
	'Land',
	'Other',
] as const;
export type TypeGroup = (typeof TYPE_GROUPS)[number];

export const TYPE_GROUP_LABELS: Record<TypeGroup, string> = {
	Creature: 'Creatures',
	Planeswalker: 'Planeswalkers',
	Battle: 'Battles',
	Instant: 'Instants',
	Sorcery: 'Sorceries',
	Artifact: 'Artifacts',
	Enchantment: 'Enchantments',
	Land: 'Lands',
	Other: 'Other',
};

/**
 * Group for a type line, using the front face only ("Creature — Elf // Land" is a creature).
 * Creature wins over Artifact/Enchantment/Land, so artifact creatures and Dryad Arbor are creatures.
 */
export function typeGroup(typeLine: string): TypeGroup {
	const front = (typeLine.split('//')[0] ?? '').split('—')[0] ?? '';
	const types = front.toLowerCase();
	for (const group of TYPE_GROUPS) {
		if (group !== 'Other' && new RegExp(`\\b${group.toLowerCase()}\\b`).test(types)) return group;
	}
	return 'Other';
}

/** Mana curve buckets 0…6 and "7+", lands excluded. */
export function manaCurve(cards: { quantity: number; manaValue: number; group: TypeGroup }[]): number[] {
	const curve = [0, 0, 0, 0, 0, 0, 0, 0];
	for (const c of cards) {
		if (c.group === 'Land') continue;
		const bucket = Math.min(7, Math.max(0, Math.floor(c.manaValue)));
		curve[bucket]! += c.quantity;
	}
	return curve;
}

/** "Mana value", "MV", "CMC" → 'cmc'; "colour" → 'color'… undefined when unknown. */
function parseSort(value: string): DeckSort | undefined {
	const v = value.toLowerCase().replace(/[^a-z]/g, '');
	if (v === 'type' || v === 'types') return 'type';
	if (v === 'name' || v === 'names') return 'name';
	if (['cmc', 'mv', 'manavalue', 'cost', 'manacost'].includes(v)) return 'cmc';
	if (v === 'color' || v === 'colour' || v === 'colors' || v === 'colours') return 'color';
	return undefined;
}

/**
 * The block's source with an option ("view: images", "sort: name") set: replaces the existing line,
 * or adds one after the other options at the top. Leaves the cards untouched.
 */
export function setDeckOption(source: string, key: 'view' | 'sort', value: string): string {
	const lines = source.split('\n');
	let insertAt = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!.trim();
		if (!line) continue;
		const option = OPTION.exec(line);
		if (!option) break; // first card or section header: options are over
		if (option[1]!.toLowerCase() === key) {
			lines[i] = lines[i]!.replace(new RegExp(`^(\\s*${key}\\s*:\\s*)[^\\r]*`, 'i'), `$1${value}`);
			return lines.join('\n');
		}
		insertAt = i + 1;
	}
	const eol = lines[0]?.endsWith('\r') ? '\r' : '';
	lines.splice(insertAt, 0, `${key}: ${value}${eol}`);
	return lines.join('\n');
}

export function setViewOption(source: string, view: DeckView): string {
	return setDeckOption(source, 'view', view);
}

// Trailing parts of a card line that must survive an edition change: "*F*", "*CMDR*", "#Ramp", "#!Removal".
const TRAILING_MARKER = /\s+(?:\*[^*\s]+\*|#!?\S+)\s*$/;
const TRAILING_SET = /\s*\([A-Za-z0-9]{2,8}\)(?:\s+[^\s*#]+)?\s*$/;

/**
 * The card line with its printing set to "(SET) number", keeping quantity, name and markers:
 *   "1 Sol Ring *F*" → "1 Sol Ring (C21) 263 *F*"
 *   "1x Sol Ring (LCC) 1 #Ramp" → "1x Sol Ring (C21) 263 #Ramp"
 */
export function withPrinting(line: string, set: string, collectorNumber: string): string {
	let rest = line.trimEnd();
	let suffix = '';
	for (let m = TRAILING_MARKER.exec(rest); m; m = TRAILING_MARKER.exec(rest)) {
		suffix = m[0].trimEnd() + suffix;
		rest = rest.slice(0, m.index);
	}
	rest = rest.replace(TRAILING_SET, '');
	return `${rest} (${set.toUpperCase()}) ${collectorNumber}${suffix}`;
}

/** What sorting and grouping need to know about a card. */
export interface SortableCard {
	name: string;
	manaValue: number;
	group: TypeGroup;
	/** Card colours (front face for double-faced cards): W U B R G; empty for colourless. */
	colors: string[];
}

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'];
const COLOR_GROUPS = ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolor', 'Colorless', 'Lands'] as const;

function colorGroup(card: SortableCard): (typeof COLOR_GROUPS)[number] {
	if (card.group === 'Land') return 'Lands';
	if (card.colors.length > 1) return 'Multicolor';
	if (card.colors.length === 0) return 'Colorless';
	return COLOR_GROUPS[COLOR_ORDER.indexOf(card.colors[0]!)] ?? 'Colorless';
}

function colorRank(card: SortableCard): number {
	return COLOR_GROUPS.indexOf(colorGroup(card));
}

const byName = (a: SortableCard, b: SortableCard) => a.name.localeCompare(b.name);
const byManaValue = (a: SortableCard, b: SortableCard) => a.manaValue - b.manaValue || byName(a, b);

/** Order inside a group (and for sections that aren't split into groups, like the sideboard). */
export function sortCardsBy<T extends SortableCard>(cards: T[], sort: DeckSort): T[] {
	const compare =
		sort === 'name'
			? byName
			: sort === 'color'
				? (a: SortableCard, b: SortableCard) => colorRank(a) - colorRank(b) || byManaValue(a, b)
				: sort === 'cmc'
					? (a: SortableCard, b: SortableCard) =>
							Number(a.group === 'Land') - Number(b.group === 'Land') || byManaValue(a, b)
					: byManaValue;
	return [...cards].sort(compare);
}

/**
 * The main deck split into labelled groups:
 *   type  → Creatures, Instants…, Lands (by mana value inside)
 *   name  → one A–Z group
 *   cmc   → "Mana value 0" … "Mana value 7+", then Lands (A–Z inside)
 *   color → White, Blue, Black, Red, Green, Multicolor, Colorless, Lands (by mana value inside)
 */
export function groupDeck<T extends SortableCard>(cards: T[], sort: DeckSort): { label: string; cards: T[] }[] {
	const groups: { label: string; cards: T[] }[] = [];
	const add = (label: string, inGroup: T[], order: DeckSort) => {
		if (inGroup.length) groups.push({ label, cards: sortCardsBy(inGroup, order) });
	};
	if (sort === 'name') {
		add('Cards (A–Z)', cards, 'name');
	} else if (sort === 'cmc') {
		const spells = cards.filter((c) => c.group !== 'Land');
		for (let mv = 0; mv <= 7; mv++) {
			const label = mv === 7 ? 'Mana value 7+' : `Mana value ${mv}`;
			add(label, spells.filter((c) => Math.min(7, Math.floor(c.manaValue)) === mv), 'name');
		}
		add('Lands', cards.filter((c) => c.group === 'Land'), 'name');
	} else if (sort === 'color') {
		for (const group of COLOR_GROUPS) add(group, cards.filter((c) => colorGroup(c) === group), 'type');
	} else {
		for (const group of TYPE_GROUPS) add(TYPE_GROUP_LABELS[group], cards.filter((c) => c.group === group), 'type');
	}
	return groups;
}
