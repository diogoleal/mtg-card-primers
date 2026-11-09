/**
 * Parser for the mtg-sideboard / mtg-changes block: what comes out of the deck and what goes in.
 * Pure module (no Obsidian imports) so it can be unit-tested with node:test.
 *
 * ```mtg-sideboard
 * vs. Aggro:
 * 2 Fabled Passage -> 2 Verdant Catacombs — faster
 * Thoughtseize + Duress -> Kozilek's Return
 *
 * vs. Control:
 * out: 2 Swords to Plowshares
 * in: 2 Mana Drain
 * ```
 */
import { parseMoxfieldLine, type CardQuery } from './moxfield.ts';

export type SwapView = 'images' | 'text';

export interface SwapCard {
	query: CardQuery;
	quantity: number;
	/** The card as written, for messages. */
	text: string;
}

/** One change: the cards that leave the deck and the ones that take their place. Either side can be empty. */
export interface Swap {
	out: SwapCard[];
	in: SwapCard[];
	/** Why, as Markdown ("Fabled Passage -> Verdant Catacombs — faster"). */
	note?: string;
}

/** Changes under one heading ("vs. Aggro", "Post-board vs. Control", "November update"). */
export interface SwapGroup {
	title?: string;
	swaps: Swap[];
	/** Other lines, as Markdown. */
	notes: string[];
}

export interface Swaps {
	title?: string;
	view?: SwapView;
	groups: SwapGroup[];
}

const OPTION = /^(title|t[ií]tulo|view)\s*:\s*(.*)$/i;
// "out:" / "in:" lists, also in Portuguese ("sai:", "entra:").
const OUT_LIST = /^(?:out|cut|cuts|remove|removed|sai|saem|sair|saindo|tira|tirar)\s*:\s*(.*)$/i;
const IN_LIST = /^(?:in|add|adds|added|entra|entram|entrar|entrando|coloca|colocar)\s*:\s*(.*)$/i;
// "-1 Card", "- Card", "+2 Card", "+ Card"
const OUT_LINE = /^[-−]\s*(.*)$/;
const IN_LINE = /^\+\s*(.*)$/;
const ARROW = /\s*(?:->|=>|→|⟶|➜|\s>\s)\s*/;
const HEADING = /^#{1,6}\s+(.*)$/;
const GROUP = /^(.+?)\s*:$/;
// " — reason", " – reason", " -- reason"
const NOTE = /\s+(?:—|–|--)\s+/;
// Cards on one side: "Thoughtseize + Duress", "Thoughtseize; Duress". Commas stay (Kiki-Jiki, Mirror Breaker).
const SEPARATOR = /\s+\+\s+|\s*;\s*/;

export function parseSwaps(source: string): Swaps {
	const result: Swaps = { groups: [] };
	let group: SwapGroup | null = null;
	// Swap being filled by "out:"/"in:" lists or "-1 X"/"+1 Y" lines.
	let open: Swap | null = null;
	// Which list the lines below an "out:" or "in:" header go to.
	let list: 'out' | 'in' | null = null;

	const currentGroup = (): SwapGroup => {
		if (!group) result.groups.push((group = { swaps: [], notes: [] }));
		return group;
	};
	/** Adds cards to the open swap, starting a new one when that side is done (an "out" after the "in"). */
	const add = (side: 'out' | 'in', cards: SwapCard[], note?: string) => {
		if (!cards.length) return;
		if (!open || (side === 'out' && open.in.length)) {
			open = { out: [], in: [] };
			currentGroup().swaps.push(open);
		}
		open[side].push(...cards);
		if (note) open.note = open.note ? `${open.note} ${note}` : note;
	};

	for (const raw of source.split('\n')) {
		const line = raw.trim();
		if (!line) {
			open = null;
			list = null;
			continue;
		}
		if (line.startsWith('//')) continue;

		const option = OPTION.exec(line);
		if (option) {
			const value = option[2]!.trim();
			if (/^view$/i.test(option[1]!)) {
				if (/^images?$/i.test(value)) result.view = 'images';
				else if (/^(text|list)$/i.test(value)) result.view = 'text';
			} else {
				result.title = value || undefined;
			}
			continue;
		}

		const outList = OUT_LIST.exec(line);
		const inList = outList ? null : IN_LIST.exec(line);
		if (outList || inList) {
			list = outList ? 'out' : 'in';
			const [cards, note] = withNote((outList ?? inList)![1]!);
			add(list, parseSide(cards), note);
			continue;
		}

		const [body, note] = withNote(line);
		const arrow = ARROW.exec(body);
		if (arrow) {
			list = null;
			open = null;
			const out = parseSide(body.slice(0, arrow.index));
			const added = parseSide(body.slice(arrow.index + arrow[0].length));
			if (out.length || added.length) {
				const swap: Swap = { out, in: added };
				if (note) swap.note = note;
				currentGroup().swaps.push(swap);
			}
			continue;
		}

		const removed = OUT_LINE.exec(line);
		const included = removed ? null : IN_LINE.exec(line);
		if (removed || included) {
			list = null;
			add(removed ? 'out' : 'in', parseSide(withNote(removed?.[1] ?? included![1]!)[0]), note);
			continue;
		}

		const heading = HEADING.exec(line) ?? GROUP.exec(line);
		if (heading) {
			open = null;
			list = null;
			const title = heading[1]!.trim();
			// The first heading names the group that was started before it (if still empty).
			if (group && !group.title && !group.swaps.length && !group.notes.length) group.title = title;
			else result.groups.push((group = { title, swaps: [], notes: [] }));
			continue;
		}

		if (list) {
			add(list, parseSide(body), note);
			continue;
		}

		currentGroup().notes.push(line);
	}
	result.groups = result.groups.filter((g) => g.swaps.length || g.notes.length || g.title);
	return result;
}

/** "2 Shock -> 2 Duress — vs. combo" → ["2 Shock -> 2 Duress", "vs. combo"]. */
function withNote(text: string): [string, string | undefined] {
	const m = NOTE.exec(text);
	if (!m) return [text, undefined];
	const note = text.slice(m.index + m[0].length).trim();
	return [text.slice(0, m.index), note || undefined];
}

/** "2 Thoughtseize + Duress x2" → two cards with their quantities. */
export function parseSide(text: string): SwapCard[] {
	return text
		.split(SEPARATOR)
		.map((part) => parseSwapCard(part))
		.filter((c): c is SwapCard => c !== null);
}

/** "2 Fabled Passage", "2x Fabled Passage", "Fabled Passage x2", "Fabled Passage:" (a trailing colon is ignored). */
export function parseSwapCard(input: string): SwapCard | null {
	let text = input
		.trim()
		.replace(/\s*:$/, '')
		.replace(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g, '$1');
	let quantity = 1;
	const leading = /^(\d{1,3})x?\s+/i.exec(text);
	const trailing = /\s+x(\d{1,3})$/i.exec(text);
	if (leading) quantity = Number(leading[1]);
	else if (trailing) {
		quantity = Number(trailing[1]);
		text = text.slice(0, trailing.index);
	}
	const query = parseMoxfieldLine(text);
	if (!query) return null;
	return { query, quantity: Math.max(1, quantity), text: input.trim() };
}

export function count(cards: SwapCard[]): number {
	return cards.reduce((n, c) => n + c.quantity, 0);
}

/** The block's source with "view: …" set: replaces the line, or adds it at the top. */
export function setSwapView(source: string, view: SwapView): string {
	const lines = source.split('\n');
	const i = lines.findIndex((l) => /^\s*view\s*:/i.test(l));
	if (i >= 0) {
		lines[i] = lines[i]!.replace(/^(\s*view\s*:\s*)[^\r]*/i, `$1${view}`);
		return lines.join('\n');
	}
	// After a leading "title:" line, so the title stays first.
	const at = lines.findIndex((l) => l.trim() !== '');
	const insertAt = at >= 0 && /^\s*(?:title|t[ií]tulo)\s*:/i.test(lines[at]!) ? at + 1 : Math.max(at, 0);
	const eol = lines[0]?.endsWith('\r') ? '\r' : '';
	lines.splice(insertAt, 0, `view: ${view}${eol}`);
	return lines.join('\n');
}
