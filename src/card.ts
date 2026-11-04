import { frontFaceName } from './moxfield';

/** The subset of the Scryfall Card object this plugin uses. */
export interface ScryfallCardFace {
	name: string;
	printed_name?: string;
	oracle_id?: string;
	mana_cost?: string;
	type_line?: string;
	oracle_text?: string;
	colors?: string[];
	power?: string;
	toughness?: string;
	loyalty?: string;
	defense?: string;
	image_uris?: Record<string, string>;
}

export interface ScryfallCard {
	object: 'card';
	id: string;
	oracle_id?: string;
	name: string;
	printed_name?: string;
	lang?: string;
	set: string;
	set_name?: string;
	collector_number: string;
	released_at?: string;
	rarity?: string;
	/** "nonfoil", "foil", "etched". */
	finishes?: string[];
	layout: string;
	/** Mana value. */
	cmc?: number;
	mana_cost?: string;
	type_line?: string;
	oracle_text?: string;
	colors?: string[];
	power?: string;
	toughness?: string;
	loyalty?: string;
	defense?: string;
	color_identity: string[];
	image_uris?: Record<string, string>;
	card_faces?: ScryfallCardFace[];
	scryfall_uri: string;
}

/** Name as printed in the card's language: "Anel Solar", or face names joined with " // ". */
export function printedName(card: ScryfallCard): string | undefined {
	if (card.printed_name) return card.printed_name;
	const faces = card.card_faces?.map((f) => f.printed_name).filter((n): n is string => !!n) ?? [];
	return faces.length > 0 ? faces.join(' // ') : undefined;
}

/** Flat card data used by notes and the renderer. */
export interface CardInfo {
	oracleId: string;
	name: string;
	frontName: string;
	scryfallId: string;
	set: string;
	collectorNumber: string;
	rarity?: string;
	typeLine: string;
	manaCost: string;
	colorIdentity: string[];
	oracleText: string;
	imageUrl?: string;
	scryfallUri?: string;
}

export function toCardInfo(card: ScryfallCard): CardInfo {
	const faces = card.card_faces ?? [];
	const front = faces[0];

	// reversible_card has no top-level oracle_id; it lives on each face.
	const oracleId = card.oracle_id ?? front?.oracle_id;
	if (!oracleId) throw new Error(`Scryfall returned no oracle_id for "${card.name}".`);

	const manaCost =
		card.mana_cost ??
		faces
			.map((f) => f.mana_cost ?? '')
			.filter((c) => c !== '')
			.join(' // ');

	const typeLine = card.type_line ?? faces.map((f) => f.type_line ?? '').join(' // ');

	const oracleText =
		card.oracle_text ??
		faces.map((f) => `${f.name}\n${f.oracle_text ?? ''}`.trim()).join('\n\n// ');

	// Transform/MDFC cards keep images on the faces.
	const images = card.image_uris ?? front?.image_uris;

	return {
		oracleId,
		name: card.name,
		frontName: frontFaceName(card.name),
		scryfallId: card.id,
		set: card.set,
		collectorNumber: card.collector_number,
		rarity: card.rarity,
		typeLine,
		manaCost,
		colorIdentity: card.color_identity ?? [],
		oracleText,
		imageUrl: images?.normal ?? images?.large ?? images?.small,
		scryfallUri: card.scryfall_uri,
	};
}

/** Rebuilds what we can from a primer's frontmatter (offline fallback). */
export function cardInfoFromFrontmatter(fm: Record<string, unknown>): CardInfo | null {
	const str = (k: string): string => {
		const v = fm[k];
		if (typeof v === 'string') return v;
		if (typeof v === 'number' || typeof v === 'boolean') return String(v);
		return '';
	};
	const oracleId = str('mtg_oracle_id');
	const name = str('mtg_name');
	if (!oracleId || !name) return null;
	const colors = fm['mtg_color_identity'];
	return {
		oracleId,
		name,
		frontName: frontFaceName(name),
		scryfallId: str('mtg_scryfall_id'),
		set: str('mtg_set'),
		collectorNumber: str('mtg_collector_number'),
		typeLine: str('mtg_type_line'),
		manaCost: str('mtg_mana_cost'),
		colorIdentity: Array.isArray(colors) ? colors.map(String) : [],
		oracleText: str('mtg_oracle_text'),
	};
}
