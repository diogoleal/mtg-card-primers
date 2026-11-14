/**
 * Parser for the mtg-shared block: cards you own fewer copies of than the decks that play them.
 * Pure module (no Obsidian imports) so it can be unit-tested with node:test.
 *
 * ```mtg-shared
 * 1 Blackblade Reforged
 * - [x] Arahbo, Roar of the World
 * - [ ] Whiplash, Vengeful Engineer
 * - [ ] Nine-Fingers Keene
 * ```
 */
import { parseSwapCard, type SwapCard } from './swap.ts';

export interface SharedDeck {
	/** The deck as written: a commander's name, a [[note]] or any name. */
	name: string;
	/** Target of a [[link]] ("Arahbo Primer" in "[[Arahbo Primer|Arahbo]]"). */
	link?: string;
	/** The card is in this deck right now ("- [x] Deck"). */
	here: boolean;
	/** Index of its line in the block's source, to move the card. */
	line: number;
	/** The deck was written with a checkbox ("[ ]" or "[x]"). */
	checkbox: boolean;
}

export interface SharedCard {
	card: SwapCard;
	/** Copies you own: the quantity before the name, 1 when not given. */
	copies: number;
	decks: SharedDeck[];
	/** Remarks, as Markdown ("Card — why"). */
	note?: string;
}

export interface Shared {
	title?: string;
	cards: SharedCard[];
}

const TITLE = /^(title|t[ií]tulo)\s*:\s*(.*)$/i;
// "- Deck", "* Deck", "+ Deck", "1. Deck", with an optional "[ ]" / "[x]".
const DECK = /^(?:[-*+•]|\d+[.)])\s+(?:\[([ xX✓])\]\s*)?(.*)$/;
// "Blackblade Reforged -> Arahbo; Whiplash; Nine-Fingers Keene"
const ARROW = /\s*(?:->|=>|→)\s*/;
const NOTE = /\s+(?:—|–|--)\s+/;
const LINK = /^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]$/;

export function parseShared(source: string): Shared {
	const result: Shared = { cards: [] };
	let current: SharedCard | null = null;

	source.split('\n').forEach((raw, index) => {
		const line = raw.trim();
		if (!line || line.startsWith('//')) return;

		const title = TITLE.exec(line);
		if (title) {
			result.title = title[2]!.trim() || undefined;
			return;
		}

		const deck = DECK.exec(line);
		if (deck) {
			// A deck before any card has nothing to belong to.
			const parsed = current && parseDeck(deck[2]!, index, deck[1]);
			if (parsed) current!.decks.push(parsed);
			return;
		}

		const [body, note] = splitNote(line);
		const arrow = ARROW.exec(body);
		const card = parseSwapCard(arrow ? body.slice(0, arrow.index) : body);
		if (!card) return;
		current = { card, copies: card.quantity, decks: [] };
		if (note) current.note = note;
		result.cards.push(current);
		if (arrow) {
			// Inline decks are split on ";" because commanders have commas in their names.
			for (const name of body.slice(arrow.index + arrow[0].length).split(/\s*;\s*/)) {
				const parsed = parseDeck(name, index);
				if (parsed) current.decks.push({ ...parsed, line: -1 });
			}
		}
	});
	return result;
}

function parseDeck(text: string, line: number, mark?: string): SharedDeck | null {
	let name = text.trim();
	let here = mark !== undefined && mark !== ' ';
	// "Arahbo (here)", "Arahbo ← here", "Arahbo (aqui)"
	const marker = /\s*(?:\((?:here|now|aqui|agora)\)|←\s*(?:here|aqui)?)\s*$/i.exec(name);
	if (marker) {
		here = true;
		name = name.slice(0, marker.index).trim();
	}
	name = name.replace(/\s*:$/, '');
	if (!name) return null;
	const deck: SharedDeck = { name, here, line, checkbox: mark !== undefined };
	const link = LINK.exec(name);
	if (link) {
		deck.link = link[1]!.trim();
		deck.name = (link[2] ?? link[1]!).trim();
	}
	return deck;
}

function splitNote(text: string): [string, string | undefined] {
	const m = NOTE.exec(text);
	if (!m) return [text, undefined];
	return [text.slice(0, m.index), text.slice(m.index + m[0].length).trim() || undefined];
}

/** How many decks have the card right now. */
export function decksHolding(card: SharedCard): number {
	return card.decks.filter((d) => d.here).length;
}

/**
 * The block's source with the card moved to one deck: that deck gets "[x]".
 * With a single copy every other deck of that card gets "[ ]"; with more copies the deck is toggled.
 * Inline decks ("Card -> A; B") are rewritten as a list so they can carry the checkbox.
 */
export function moveSharedCard(source: string, cardIndex: number, deckIndex: number): string {
	const shared = parseShared(source);
	const card = shared.cards[cardIndex];
	const target = card?.decks[deckIndex];
	if (!card || !target) return source;

	const lines = source.split('\n');
	const eol = lines[0]?.endsWith('\r') ? '\r' : '';
	const single = card.copies <= 1;
	const state = card.decks.map((d, i) => (i === deckIndex ? (single ? true : !d.here) : single ? false : d.here));

	if (card.decks.some((d) => d.line < 0)) {
		// Inline form: replace the card's line with the card and one line per deck.
		const at = lines.findIndex((l) => ARROW.test(l) && parseSwapCard(l.split(ARROW)[0]!)?.query.name === card.card.query.name);
		if (at < 0) return source;
		const head = lines[at]!.split(ARROW)[0]!.trimEnd();
		const note = card.note ? ` — ${card.note}` : '';
		const decks = card.decks.map((d, i) => `- [${state[i] ? 'x' : ' '}] ${deckText(d)}${eol}`);
		lines.splice(at, 1, `${head}${note}${eol}`, ...decks);
		return lines.join('\n');
	}

	card.decks.forEach((d, i) => {
		const old = lines[d.line]!;
		const indent = /^\s*/.exec(old)![0];
		lines[d.line] = `${indent}- [${state[i] ? 'x' : ' '}] ${deckText(d)}${old.endsWith('\r') ? '\r' : ''}`;
	});
	return lines.join('\n');
}

function deckText(deck: SharedDeck): string {
	if (!deck.link) return deck.name;
	return deck.link === deck.name ? `[[${deck.link}]]` : `[[${deck.link}|${deck.name}]]`;
}
