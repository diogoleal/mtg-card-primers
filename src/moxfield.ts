/**
 * Parser for a single line of Moxfield text export.
 * Pure module (no Obsidian imports) so it can be unit-tested with node:test.
 */

export interface CardQuery {
	/** Card name to search (front face only for multi-face cards). */
	name: string;
	/** Set code, lowercase, when given as `(SET)`. */
	set?: string;
	/** Collector number, when given after the set code. */
	collectorNumber?: string;
}

// Up to 3 digits so names like "1996 World Champion" are not eaten as a quantity.
const QUANTITY = /^(\d{1,3})x?\s+/i;
// Trailing markers: *F*, *E*, *A*, *CMDR*, etc.
const STAR_MARKER = /\s*\*[^*\s]+\*\s*$/;
// Trailing Moxfield tags like "#Ramp" or "#!Removal".
const TAG = /\s+#!?\S+\s*$/;
// "(SET) NUMBER" or "(SET)" at the end.
const SET_AND_NUMBER = /\s*\(([A-Za-z0-9]{2,8})\)(?:\s+(\S+))?\s*$/;

export function parseMoxfieldLine(input: string): CardQuery | null {
	let line = input.replace(/\s+/g, ' ').trim();
	if (!line) return null;

	line = line.replace(QUANTITY, '');

	// Strip markers and tags from the end, in any order.
	let previous: string;
	do {
		previous = line;
		line = line.replace(STAR_MARKER, '').replace(TAG, '').trim();
	} while (line !== previous);

	let set: string | undefined;
	let collectorNumber: string | undefined;
	const setMatch = SET_AND_NUMBER.exec(line);
	if (setMatch && setMatch.index > 0) {
		set = setMatch[1]?.toLowerCase();
		collectorNumber = setMatch[2];
		line = line.slice(0, setMatch.index).trim();
	}

	const name = frontFaceName(line);
	// A lone quantity ("1") is not a card name.
	if (!name || /^\d+x?$/i.test(name)) return null;

	const query: CardQuery = { name };
	if (set) query.set = set;
	if (set && collectorNumber) query.collectorNumber = collectorNumber;
	return query;
}

/** "Delver of Secrets // Insectile Aberration" -> "Delver of Secrets". */
export function frontFaceName(name: string): string {
	return (name.split('//')[0] ?? '').trim();
}

/** True when the text looks like more than a bare name (quantity, set, markers). */
export function looksLikeMoxfieldLine(input: string): boolean {
	const q = parseMoxfieldLine(input);
	if (!q) return false;
	return q.set !== undefined || q.name !== input.trim();
}
