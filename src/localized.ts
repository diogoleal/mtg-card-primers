/**
 * Helpers for finding cards by their printed name in any language
 * ("Anel Solar", "Anello Solare", "Sonnenring" → Sol Ring).
 * Pure module (no Obsidian imports) so it can be unit-tested with node:test.
 */

/** Lowercase, without accents: "Laboratório" → "laboratorio". */
export function foldText(text: string): string {
	return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Words worth searching for: at least 2 characters, without characters that break Scryfall's query syntax. */
export function searchWords(input: string): string[] {
	return input
		.replace(/["()]/g, ' ')
		.split(/\s+/)
		.filter((w) => w.length >= 2);
}

/** Scryfall query for printings in any language whose name contains every word: lang:any "anel" "sol". */
export function printedNameQuery(input: string): string | null {
	const words = searchWords(input);
	if (words.length === 0) return null;
	return `lang:any ${words.map((w) => `"${w}"`).join(' ')}`;
}

/** True when the printed name contains every typed word, ignoring case and accents. */
export function printedNameMatches(printedName: string, input: string): boolean {
	const folded = foldText(printedName);
	return searchWords(input).every((w) => folded.includes(foldText(w)));
}

/** Scryfall language codes → names shown in suggestions. */
const LANGUAGES: Record<string, string> = {
	en: 'English',
	es: 'Spanish',
	fr: 'French',
	de: 'German',
	it: 'Italian',
	pt: 'Portuguese',
	ja: 'Japanese',
	ko: 'Korean',
	ru: 'Russian',
	zhs: 'Simplified Chinese',
	zht: 'Traditional Chinese',
	he: 'Hebrew',
	la: 'Latin',
	grc: 'Ancient Greek',
	ar: 'Arabic',
	sa: 'Sanskrit',
	ph: 'Phyrexian',
	qya: 'Quenya',
};

export function languageName(code: string): string {
	return LANGUAGES[code] ?? code.toUpperCase();
}

export interface NamedPrint {
	/** English card name. */
	name: string;
	printedName: string;
	lang: string;
}

/**
 * One suggestion per card from many printings in many languages: the printed name that best matches
 * the input (same name > starts with it as a whole word > starts with it > contains every word). Keeps the order of first appearance.
 */
export function bestPrintedMatches(prints: NamedPrint[], input: string): NamedPrint[] {
	const wanted = foldText(input.trim());
	const score = (p: NamedPrint): number => {
		const folded = foldText(p.printedName);
		if (folded === wanted) return 4;
		if (folded.startsWith(`${wanted} `)) return 3; // whole word: "anel" → "Anel Solar" beats "Anello Solare"
		if (folded.startsWith(wanted)) return 2;
		return 1;
	};
	const best = new Map<string, { print: NamedPrint; score: number }>();
	for (const p of prints) {
		if (p.printedName === p.name || !printedNameMatches(p.printedName, input)) continue;
		const s = score(p);
		const current = best.get(p.name);
		if (!current || s > current.score) best.set(p.name, { print: p, score: s });
	}
	return [...best.values()].map((b) => b.print);
}
