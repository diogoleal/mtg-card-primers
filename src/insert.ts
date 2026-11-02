/**
 * Markdown the "Insert …" commands put in the note.
 * Pure module (no Obsidian imports) so it can be unit-tested with node:test.
 */
import type { ScryfallCard, ScryfallCardFace } from './card.ts';
import { splitOracleLine } from './mana-scan.ts';

type Face = ScryfallCardFace | ScryfallCard;

/** Faces with their own text: transform, MDFC, split, adventure, flip… or the card itself. */
function faces(card: ScryfallCard): Face[] {
	return card.card_faces?.length ? card.card_faces : [card];
}

/**
 * Oracle text as a blockquote per face, e.g.
 *   > **Grist, the Hunger Tide** {1}{B}{G}
 *   > Legendary Planeswalker — Grist
 *   >
 *   > [+1]: Create a 1/1 …
 * Loyalty abilities and level bands are written as [+1] / [LEVEL 1-4] so they render as symbols.
 */
export function cardTextMarkdown(card: ScryfallCard): string {
	return faces(card)
		.map((face) => {
			const lines: string[] = [];
			lines.push(`**${face.name}**${face.mana_cost ? ` ${face.mana_cost}` : ''}`);
			if (face.type_line) lines.push(face.type_line);
			const stats = statsLine(face);
			let statsDone = !stats;
			for (const paragraph of (face.oracle_text ?? '').split('\n')) {
				if (paragraph.trim() === '') continue;
				// Levelers: base power/toughness goes before the first level band, as printed.
				if (!statsDone && splitOracleLine(paragraph).kind === 'level') {
					lines.push('', stats);
					statsDone = true;
				}
				lines.push('', oracleLineMarkdown(paragraph));
			}
			if (!statsDone) lines.push('', stats);
			return lines.map((l) => (l ? `> ${l}` : '>')).join('\n');
		})
		.join('\n\n');
}

function oracleLineMarkdown(line: string): string {
	const parsed = splitOracleLine(line);
	if (parsed.kind === 'loyalty') return `[${parsed.value}]${parsed.rest}`;
	if (parsed.kind === 'level') return `[LEVEL ${parsed.value}]`;
	return line;
}

function statsLine(face: Face): string {
	if (face.power !== undefined && face.toughness !== undefined) return `**${face.power}/${face.toughness}**`;
	if (face.loyalty !== undefined) return `Loyalty: **${face.loyalty}**`;
	if (face.defense !== undefined) return `Defense: **${face.defense}**`;
	return '';
}

export type ImageKind = 'card' | 'art';

/**
 * Linked (not downloaded) Scryfall images, one per face for double-faced cards.
 * 'card' = whole card at 250 px; 'art' = only the illustration (art_crop), full width.
 */
export function cardImageMarkdown(card: ScryfallCard, kind: ImageKind): string {
	const withImages = card.image_uris ? [card] : (card.card_faces ?? []).filter((f) => f.image_uris);
	const label = `${card.set.toUpperCase()} #${card.collector_number}`;
	return withImages
		.map((face) => {
			const uris = face.image_uris ?? {};
			const url = kind === 'art' ? uris.art_crop : (uris.normal ?? uris.large);
			if (!url) return '';
			const alt = altText(`${face.name} · ${label}`);
			return kind === 'art' ? `![${alt}](${url})` : `![${alt}|250](${url})`;
		})
		.filter((md) => md !== '')
		.join(kind === 'art' ? '\n\n' : ' ');
}

/** "[", "]" and "|" would break the image syntax. */
function altText(text: string): string {
	return text.replace(/[[\]|]/g, '');
}

const RARITY_LETTER: Record<string, string> = {
	common: 'c',
	uncommon: 'u',
	rare: 'r',
	mythic: 'm',
	special: 's',
	bonus: 'b',
};

/** "dsc:r": set code plus rarity letter (just "dsc" when the rarity is unknown). */
export function setSymbolValue(print: { set: string; rarity?: string }): string {
	const letter = print.rarity ? RARITY_LETTER[print.rarity] : undefined;
	return `${print.set.toLowerCase()}${letter ? `:${letter}` : ''}`;
}

/** Set symbol token for this printing, coloured by its rarity: "{set:dsc:r}". */
export function setSymbolToken(print: { set: string; rarity?: string }): string {
	return `{set:${setSymbolValue(print)}}`;
}

export const RARITY_NAMES: Record<string, string> = {
	c: 'common',
	u: 'uncommon',
	r: 'rare',
	m: 'mythic',
	s: 'special',
	b: 'bonus',
};
