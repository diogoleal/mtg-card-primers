import { MANA_SYMBOLS, SYMBOL_BASE_URL } from './mana-symbols';
import { findInlineSymbols, splitOracleLine, type SymbolMatch } from './mana-scan';
import { RARITY_NAMES } from './insert';
import type { SetInfo } from './scryfall';

/** Set by the plugin on load: finds a set's name and icon (Scryfall /sets, cached). */
let lookupSet: ((code: string) => Promise<SetInfo | null>) | null = null;

export function configureSetLookup(fn: typeof lookupSet): void {
	lookupSet = fn;
}

// Scryfall draws these as black glyphs with no circle; they get inverted in dark themes (see styles.css).
const DARK_GLYPHS = new Set(['{Q}', '{E}', '{P}', '{PW}', '{CHAOS}', '{TK}', '{H}']);

export function isManaSymbol(text: string): boolean {
	return Object.prototype.hasOwnProperty.call(MANA_SYMBOLS, text);
}

/**
 * Appends one Scryfall symbol to parent as an <img> linked from Scryfall.
 * If the image can't load (offline), it is replaced by the text "{B}".
 */
export function appendManaSymbol(parent: HTMLElement, symbol: string): void {
	const entry = MANA_SYMBOLS[symbol];
	if (!entry) {
		parent.appendText(symbol);
		return;
	}
	const img = parent.createEl('img', {
		cls: DARK_GLYPHS.has(symbol) ? 'mtg-mana mtg-mana-glyph' : 'mtg-mana',
		attr: { src: SYMBOL_BASE_URL + entry[0], alt: symbol, title: `${symbol} ${entry[1]}`, draggable: 'false' },
	});
	img.addEventListener('error', () => img.replaceWith(symbol));
}

/** Loyalty cost shield: "+1" points up, "−2" points down, "0" is flat. Drawn with CSS, works offline. */
export function appendLoyalty(parent: HTMLElement, value: string): void {
	const dir = value.startsWith('+') ? 'up' : value.startsWith('−') ? 'down' : 'zero';
	parent.createSpan({ cls: `mtg-loyalty mtg-loyalty-${dir}`, text: value, attr: { title: `Loyalty ${value}` } });
}

/** Level band badge, as printed on leveler cards ("LEVEL 1-4"). Drawn with CSS, works offline. */
export function appendLevel(parent: HTMLElement, value: string): void {
	parent.createSpan({ cls: 'mtg-level', text: `LEVEL ${value}` });
}

/**
 * Set symbol ("dsc" or "dsc:r"), drawn as a CSS mask over the rarity colour so it follows the theme.
 * The icon URL comes from Scryfall's set list; until it arrives the span is an empty placeholder,
 * and if it can't be found (unknown set, offline) the set code is shown as text.
 */
export function appendSetSymbol(parent: HTMLElement, value: string): void {
	const [code = '', rarity = 'c'] = value.split(':');
	const span = parent.createSpan({ cls: `mtg-set mtg-set-${rarity} mtg-set-pending` });
	const fail = () => {
		span.removeClass('mtg-set-pending');
		span.addClass('mtg-set-missing');
		span.setText(code.toUpperCase());
	};
	if (!lookupSet) return fail();
	lookupSet(code)
		.then((info) => {
			if (!info) return fail();
			span.setCssProps({ '--mtg-set-icon': `url("${info.iconUrl}")` });
			span.removeClass('mtg-set-pending');
			const rarityName = RARITY_NAMES[rarity];
			span.setAttr('title', `${info.name} (${code.toUpperCase()})${rarityName ? ` · ${rarityName}` : ''}`);
		})
		.catch(fail);
}

/** Official Commander bracket names (Wizards of the Coast, 2025). */
const BRACKET_NAMES: Record<string, string> = {
	'1': 'Exhibition',
	'2': 'Core',
	'3': 'Upgraded',
	'4': 'Optimized',
	'5': 'cEDH',
};

/** Commander bracket badge: "3" → "3 · Upgraded", "2-3" → "2–3". Drawn with CSS, works offline. */
export function appendBracket(parent: HTMLElement, value: string): void {
	const [lo = '', hi] = value.split('-');
	const names = [lo, hi].filter((n): n is string => !!n).map((n) => `${n} ${BRACKET_NAMES[n] ?? ''}`.trim());
	const badge = parent.createSpan({
		cls: `mtg-bracket mtg-bracket-${lo}${hi ? ` mtg-bracket-to-${hi}` : ''}`,
		attr: { title: `Commander bracket ${names.join(' to ')}` },
	});
	badge.createSpan({ cls: 'mtg-bracket-label', text: 'BRACKET' });
	badge.createSpan({ cls: 'mtg-bracket-value', text: hi ? `${lo}–${hi}` : `${lo} · ${BRACKET_NAMES[lo] ?? ''}` });
}

export function appendSymbol(parent: HTMLElement, m: Pick<SymbolMatch, 'kind' | 'value'>): void {
	if (m.kind === 'mana') appendManaSymbol(parent, m.value);
	else if (m.kind === 'loyalty') appendLoyalty(parent, m.value);
	else if (m.kind === 'set') appendSetSymbol(parent, m.value);
	else if (m.kind === 'bracket') appendBracket(parent, m.value);
	else appendLevel(parent, m.value);
}

/** Appends text to parent, turning symbols ({B}, [+1], [LEVEL 1-4], [BRACKET 3]…) into icons. */
export function appendManaText(parent: HTMLElement, text: string): void {
	let last = 0;
	for (const m of findInlineSymbols(text, isManaSymbol)) {
		if (m.from > last) parent.appendText(text.slice(last, m.from));
		appendSymbol(parent, m);
		last = m.to;
	}
	if (last < text.length) parent.appendText(text.slice(last));
}

/**
 * Card oracle text: like appendManaText, plus planeswalker abilities ("+1: …") and
 * level bands ("LEVEL 1-4") at the start of a line, the way Scryfall writes them.
 */
export function appendOracleText(parent: HTMLElement, text: string): void {
	text.split('\n').forEach((line, i) => {
		if (i > 0) parent.appendText('\n');
		const parsed = splitOracleLine(line);
		if (parsed.kind !== 'text') appendSymbol(parent, parsed);
		appendManaText(parent, parsed.rest);
	});
}

const SKIP_SELECTOR =
	'code, pre, .math, mjx-container, .frontmatter, .metadata-container, .mtg-mana, .mtg-loyalty, .mtg-level, .mtg-set, .mtg-bracket, script, style, textarea, input';

/** Reading view: replaces symbols in the rendered text nodes of el. */
export function replaceManaInElement(el: HTMLElement): void {
	const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	const nodes: Text[] = [];
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		const text = n as Text;
		if (!text.data.includes('{') && !text.data.includes('[')) continue;
		if (text.parentElement?.closest(SKIP_SELECTOR)) continue;
		if (findInlineSymbols(text.data, isManaSymbol).length === 0) continue;
		nodes.push(text);
	}
	for (const node of nodes) {
		const holder = createSpan();
		appendManaText(holder, node.data);
		node.replaceWith(...Array.from(holder.childNodes));
	}
}
