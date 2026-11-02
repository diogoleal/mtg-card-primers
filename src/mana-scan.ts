/**
 * Finds card symbols in Markdown source:
 * - mana and other Scryfall symbols: {1}{B}, {G/P}, {T}, {Q}, {PW}
 * - loyalty costs: [+1], [−2] / [-2], [0], [+X]
 * - level bands: [LEVEL 1-4], [LEVEL 5+]
 * - set symbols: {set:dsc}, {set:dsc:r} (rarity c, u, r, m, s or b)
 * - Commander brackets: [BRACKET 3], [BRACKET 2-3], short [B3] / [B2-3]
 * skipping places where these characters mean something else: frontmatter, fenced code,
 * inline code and math.
 * Pure module (no Obsidian imports) so it can be unit-tested with node:test.
 */

export type SymbolKind = 'mana' | 'loyalty' | 'level' | 'set' | 'bracket';

export interface SymbolMatch {
	from: number;
	to: number;
	kind: SymbolKind;
	/** Matched source text, e.g. "{B}", "[-2]", "[LEVEL 5+]". */
	symbol: string;
	/** Normalized value: "{B}", "−2", "5+", "dsc:r" (set code, then rarity letter or nothing), "3" or "2-3" (bracket). */
	value: string;
}

/**
 * One regex for all kinds. Brackets are ignored right after "[" or a letter/digit ("[[+1]]", "array[0]";
 * checked in code, because regex lookbehind needs iOS 16.4+) and right before "]", "(" or "[" (wikilinks
 * and Markdown links).
 */
const TOKEN =
	/\{set:(?<set>[a-z0-9]{2,6})(?::(?<rarity>[curmsb]))?\}|\{[^{}\s]{1,6}\}|\[(?:(?<loyalty>[+\-−](?:\d{1,2}|X)|0)|LEVEL (?<level>\d{1,2}(?:-\d{1,2}|\+))|BRACKET (?<bracket>[1-5](?:-[1-5])?)|B(?<bshort>[1-5](?:-[1-5])?))\](?![\]([])/gi;

/** "+1" → "+1", "-2" → "−2" (true minus sign), "+x" → "+X". */
export function normalizeLoyalty(raw: string): string {
	return raw.replace('-', '−').toUpperCase();
}

/** All symbols in a piece of plain text (no Markdown awareness). */
export function findInlineSymbols(text: string, isManaSymbol: (s: string) => boolean): SymbolMatch[] {
	const out: SymbolMatch[] = [];
	for (const m of text.matchAll(TOKEN)) {
		const from = m.index ?? 0;
		const to = from + m[0].length;
		const g = m.groups ?? {};
		if (m[0].startsWith('[') && from > 0 && /[[\w]/.test(text[from - 1]!)) continue;
		if (g.set) {
			const value = g.rarity ? `${g.set}:${g.rarity}` : g.set;
			out.push({ from, to, kind: 'set', symbol: m[0], value: value.toLowerCase() });
		} else if (g.bracket || g.bshort) {
			// The short form must be an uppercase "B", so ordinary text like "[b2]" stays as is.
			const value = (g.bracket ?? g.bshort)!;
			const [lo, hi] = value.split('-');
			if ((g.bshort && m[0][1] !== 'B') || (hi && hi <= lo!)) continue;
			out.push({ from, to, kind: 'bracket', symbol: m[0], value });
		} else if (g.level) {
			out.push({ from, to, kind: 'level', symbol: m[0], value: g.level });
		} else if (g.loyalty) {
			out.push({ from, to, kind: 'loyalty', symbol: m[0], value: normalizeLoyalty(g.loyalty) });
		} else if (isManaSymbol(m[0])) {
			out.push({ from, to, kind: 'mana', symbol: m[0], value: m[0] });
		}
	}
	return out;
}

/** Symbols in a Markdown document, skipping frontmatter, code and math. */
export function scanSymbols(text: string, isManaSymbol: (s: string) => boolean): SymbolMatch[] {
	const skips = skippedRanges(text);
	const out: SymbolMatch[] = [];
	let s = 0;
	for (const m of findInlineSymbols(text, isManaSymbol)) {
		while (s < skips.length && skips[s]![1] <= m.from) s++;
		const skip = skips[s];
		if (skip && skip[0] < m.to && m.from < skip[1]) continue;
		out.push(m);
	}
	return out;
}

export type OracleLine =
	| { kind: 'loyalty'; value: string; rest: string }
	| { kind: 'level'; value: string; rest: string }
	| { kind: 'text'; rest: string };

/** Oracle text lines that start a planeswalker ability ("+1: …") or a level band ("LEVEL 1-4"). */
export function splitOracleLine(line: string): OracleLine {
	const loyalty = /^([+\-−](?:\d{1,2}|X)|0):/.exec(line);
	if (loyalty) return { kind: 'loyalty', value: normalizeLoyalty(loyalty[1]!), rest: line.slice(loyalty[1]!.length) };
	const level = /^LEVEL (\d{1,2}(?:-\d{1,2}|\+))\s*$/.exec(line);
	if (level) return { kind: 'level', value: level[1]!, rest: '' };
	return { kind: 'text', rest: line };
}

/** Sorted, non-overlapping [from, to) ranges to ignore. */
function skippedRanges(text: string): Array<[number, number]> {
	const ranges: Array<[number, number]> = [];
	const lines = text.split('\n');
	let offset = 0;
	let i = 0;

	// Frontmatter: "---" on the first line up to the next "---".
	if (lines[0]?.trimEnd() === '---') {
		for (let j = 1; j < lines.length; j++) {
			if (lines[j]!.trimEnd() === '---') {
				for (let k = 0; k <= j; k++) offset += lines[k]!.length + 1;
				ranges.push([0, offset]);
				i = j + 1;
				break;
			}
		}
	}

	let fence: string | null = null; // "```" / "~~~~" while inside a fenced block
	let inMathBlock = false;
	for (; i < lines.length; i++) {
		const line = lines[i]!;
		const start = offset;
		const end = start + line.length;
		offset = end + 1;
		const trimmed = line.trim();

		if (fence) {
			ranges.push([start, end]);
			if (trimmed.startsWith(fence[0]!) && /^(`{3,}|~{3,})\s*$/.test(trimmed) && trimmed.length >= fence.length) {
				fence = null;
			}
			continue;
		}
		if (inMathBlock) {
			ranges.push([start, end]);
			if (trimmed.endsWith('$$')) inMathBlock = false;
			continue;
		}
		const open = /^(`{3,}|~{3,})/.exec(trimmed);
		if (open) {
			fence = open[1]!;
			ranges.push([start, end]);
			continue;
		}
		if (trimmed.startsWith('$$') && !(trimmed.length > 2 && trimmed.endsWith('$$'))) {
			inMathBlock = true;
			ranges.push([start, end]);
			continue;
		}

		// Inline code (`...`, ``...``) and inline math on this line. Like Obsidian, "$x$" needs no space
		// right inside the dollars, so prices such as "$5 and $6" are not math.
		for (const m of line.matchAll(/(`+)[\s\S]*?\1|\$\$[^$]*\$\$|\$[^$\s](?:[^$]*?[^$\s])?\$(?!\d)/g)) {
			const from = start + (m.index ?? 0);
			ranges.push([from, from + m[0].length]);
		}
	}
	return ranges.sort((a, b) => a[0] - b[0]);
}
