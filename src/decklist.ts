/**
 * Decklist parsing and grouping for the mtg-deck block.
 * Pure module (no Obsidian imports) so it can be unit-tested with node:test.
 */
import { parseMoxfieldLine, type CardQuery } from './moxfield.ts';

export type DeckView = 'text' | 'images' | 'grid';

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
const OPTION = /^(title|view)\s*:\s*(.+)$/i;

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
 * A lone "Sideboard" line is also MTGA's blank-line convention: cards after the first blank line
 * of a header-less list are the sideboard.
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

/**
 * The block's source with its "view:" option set: replaces the existing line, or adds one at the top
 * (after "title:", if any). Leaves the cards untouched.
 */
export function setViewOption(source: string, view: DeckView): string {
	const lines = source.split('\n');
	let insertAt = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!.trim();
		if (!line) continue;
		const option = OPTION.exec(line);
		if (!option) break; // first card or section header: options are over
		if (option[1]!.toLowerCase() === 'view') {
			lines[i] = lines[i]!.replace(/^(\s*view\s*:\s*)[^\r]*/i, `$1${view}`);
			return lines.join('\n');
		}
		insertAt = i + 1;
	}
	const eol = lines[0]?.endsWith('\r') ? '\r' : '';
	lines.splice(insertAt, 0, `view: ${view}${eol}`);
	return lines.join('\n');
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
