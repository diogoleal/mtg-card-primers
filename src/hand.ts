/**
 * Parser for the mtg-hand block: an opening hand and whether to keep it or mulligan.
 * Pure module (no Obsidian imports) so it can be unit-tested with node:test.
 *
 * ```mtg-hand
 * keep
 * on the play
 * Grist, the Hunger Tide
 * Sol Ring — turn 1
 * 2 Swamp
 * why:
 * Two lands and [[Sol Ring]] cast Grist on turn 2.
 * ```
 */
import { parseSwapCard, type SwapCard } from './swap.ts';

export type HandView = 'images' | 'text';
export type Verdict = 'keep' | 'mulligan';
export type Play = 'play' | 'draw';

export interface HandCard extends SwapCard {
	/** Why this card matters, as Markdown ("Sol Ring — turn 1"). */
	note?: string;
}

export interface Hand {
	title?: string;
	view?: HandView;
	verdict?: Verdict;
	/** On the play or on the draw. */
	play?: Play;
	cards: HandCard[];
	/** The explanation after "why:", as Markdown. */
	why: string[];
}

const OPTION = /^([\p{L} ]+?)\s*:\s*(.*)$/u;
const KEEP = /^(keep|keeper|keepable|manter|mantem|mantenho|mantenha)$/;
const MULLIGAN = /^(mulligan|mull|mulliganar|mulligar|ship it|ship)$/;
const ON_THE = /^(?:on the|no|na|jogando|comprando)\s+(.+)$/;
const PLAY = /^(play|first|primeiro|primeira)$/;
const DRAW = /^(draw|second|segundo|segunda)$/;
const WHY = /^(why|because|reason|reasons|notes?|plan|explanation|por que|porque|motivo|motivos|plano|explicacao|notas?)$/;
// " — note", " – note", " -- note"
const NOTE = /\s+(?:—|–|--)\s+/;
// A Markdown list marker before a card: "- Sol Ring", "* Sol Ring", "1. Sol Ring".
const BULLET = /^(?:[-*•]|\d+[.)])\s+/;

export function parseHand(source: string): Hand {
	const hand: Hand = { cards: [], why: [] };
	let inWhy = false;

	for (const raw of source.split('\n')) {
		const line = raw.trim();
		if (inWhy) {
			hand.why.push(raw.replace(/\s+$/, ''));
			continue;
		}
		if (!line || line.startsWith('//')) continue;

		const plain = fold(line.replace(/[!.]+$/, ''));
		const verdict = toVerdict(plain);
		if (verdict) {
			hand.verdict = verdict;
			continue;
		}
		const onThe = ON_THE.exec(plain);
		if (onThe && toPlay(onThe[1]!)) {
			hand.play = toPlay(onThe[1]!);
			continue;
		}

		const option = OPTION.exec(line);
		if (option) {
			const key = fold(option[1]!);
			const value = option[2]!.trim();
			if (key === 'title' || key === 'titulo') {
				hand.title = value || undefined;
				continue;
			}
			if (key === 'view') {
				if (/^images?$/i.test(value)) hand.view = 'images';
				else if (/^(text|list)$/i.test(value)) hand.view = 'text';
				continue;
			}
			if (/^(verdict|decision|veredito|decisao)$/.test(key)) {
				hand.verdict = toVerdict(fold(value)) ?? hand.verdict;
				continue;
			}
			if (/^(play|on the|turn|jogando|turno)$/.test(key)) {
				hand.play = toPlay(fold(value).replace(/^(?:on the|no|na)\s+/, '')) ?? hand.play;
				continue;
			}
			if (WHY.test(key)) {
				inWhy = true;
				if (value) hand.why.push(value);
				continue;
			}
		}

		const card = parseHandCard(line);
		if (card) hand.cards.push(card);
	}

	// Trailing blank lines of the explanation.
	while (hand.why.length && !hand.why[hand.why.length - 1]!.trim()) hand.why.pop();
	while (hand.why.length && !hand.why[0]!.trim()) hand.why.shift();
	return hand;
}

/** "2 Swamp — both untapped" → 2 × Swamp with its note. */
export function parseHandCard(line: string): HandCard | null {
	const text = line.trim().replace(BULLET, '');
	const m = NOTE.exec(text);
	const card = parseSwapCard(m ? text.slice(0, m.index) : text);
	if (!card) return null;
	const note = m ? text.slice(m.index + m[0].length).trim() : '';
	return note ? { ...card, note } : card;
}

/** Number of cards in the hand, counting copies. */
export function handSize(hand: Hand): number {
	return hand.cards.reduce((n, c) => n + c.quantity, 0);
}

/** The block's source with "view: …" set: replaces the line, or adds it at the top (after a leading title). */
export { setSwapView as setHandView } from './swap.ts';

function toVerdict(text: string): Verdict | undefined {
	if (KEEP.test(text)) return 'keep';
	if (MULLIGAN.test(text)) return 'mulligan';
	return undefined;
}

function toPlay(text: string): Play | undefined {
	if (PLAY.test(text)) return 'play';
	if (DRAW.test(text)) return 'draw';
	return undefined;
}

/** Lowercase, no accents, single spaces: "Por quê" → "por que". */
function fold(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}
