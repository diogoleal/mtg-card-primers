/**
 * Parser for the mtg-combo block.
 * Pure module (no Obsidian imports) so it can be unit-tested with node:test.
 *
 * ```mtg-combo
 * title: Grave Titan loop
 * battlefield:
 * Ashnod's Altar or Phyrexian Altar + Gravecrawler + Grave Titan
 * graveyard:
 * Reassembling Skeleton
 * result: infinite mana, infinite death triggers
 * ```
 */
import { parseMoxfieldLine, type CardQuery } from './moxfield.ts';

export type Zone = 'pieces' | 'battlefield' | 'hand' | 'stack' | 'graveyard' | 'exile' | 'library' | 'command';

export const ZONE_LABELS: Record<Zone, string> = {
	pieces: 'Pieces',
	battlefield: 'Battlefield',
	hand: 'Hand',
	stack: 'Stack',
	graveyard: 'Graveyard',
	exile: 'Exile',
	library: 'Library',
	command: 'Command zone',
};

const ZONE_ALIASES: Record<string, Zone> = {
	battlefield: 'battlefield',
	field: 'battlefield',
	bf: 'battlefield',
	board: 'battlefield',
	campo: 'battlefield',
	hand: 'hand',
	mao: 'hand',
	stack: 'stack',
	pilha: 'stack',
	graveyard: 'graveyard',
	gy: 'graveyard',
	yard: 'graveyard',
	cemiterio: 'graveyard',
	exile: 'exile',
	exilio: 'exile',
	library: 'library',
	grimorio: 'library',
	command: 'command',
	'command zone': 'command',
	commander: 'command',
	'zona de comando': 'command',
	comando: 'command',
};

/** How a card is joined to the one before it in the same line. */
export type Link = '+' | '-' | '*';

export type PlayerTarget = 'you' | 'opponent' | 'each-opponent' | 'player' | 'each-player' | 'any';

export const PLAYER_TARGET_LABELS: Record<PlayerTarget, string> = {
	you: 'You',
	opponent: 'Target opponent',
	'each-opponent': 'Each opponent',
	player: 'Target player',
	'each-player': 'Each player',
	any: 'Any target',
};

/**
 * What a card points at with `>`:
 * - a player ("me", "target opponent", "each opponent"…);
 * - a kind of object ("target creature", "a land", "artifact"), shown as a label;
 * - a specific card, shown as its image.
 */
export type Target =
	| { kind: 'player'; who: PlayerTarget }
	| { kind: 'object'; label: string }
	| { kind: 'card'; card: ComboCard };

/**
 * - `+` depends on / works with the card before it
 * - `-` removed or sacrificed
 * - `*` on the stack
 * - `~` tapped
 * - `>` targets (the player, object or card after it)
 */
/** "[2 Zombie 2/2 black]": a token, looked up on Scryfall by name, power/toughness and colours. */
export interface TokenSpec {
	name: string;
	power?: string;
	toughness?: string;
	/** Colour letters (W U B R G), or ['C'] for colourless; empty when not given. */
	colors: string[];
	quantity: number;
}

export interface ComboCard {
	/** Alternatives ("Ashnod's Altar or Phyrexian Altar"): any one of them works. Empty for a token. */
	options: CardQuery[];
	/** Set when the piece is a token ("[Zombie 2/2]") instead of a card. */
	token?: TokenSpec;
	/** Operator written before the card, shown between it and the previous card. */
	link?: Link;
	removed: boolean;
	onStack: boolean;
	tapped: boolean;
	targets: Target[];
	/** The piece as written, for error messages. */
	text: string;
}

export interface ComboZone {
	zone: Zone;
	/** One row per line, cards in order. */
	rows: ComboCard[][];
}

export interface Combo {
	title?: string;
	/** "keyword:" field: what the combo is about ("infinite mana", "win"), highlighted at the top. */
	keywords: string[];
	results: string[];
	zones: ComboZone[];
	/** Numbered steps, as Markdown (without the numbers). */
	steps: string[];
	/** Other text, as Markdown lines. */
	notes: string[];
	/** "how:" field: how the combo works, as Markdown lines (paragraphs, lists, links). */
	how: string[];
	/** "weak:" field: problems and weak points (hate cards, what breaks it), as Markdown lines. */
	weak: string[];
}

const OPTION = /^(title|t[ií]tulo|results?|resultados?|keywords?|tags?|destaques?|palavras?[ -]chave)\s*:\s*(.*)$/i;
// "how:", "how it works:", "explanation:", "como funciona:", "explicação:"
const HOW = /^(?:how(?: it works)?|explanation|explain|como funciona|explica[cç][aã]o)\s*:\s*(.*)$/i;
// "weak:", "weaknesses:", "problems:", "pontos fracos:", "problemas:", "fraquezas:"
const WEAK =
	/^(?:weak(?:ness|nesses| points?)?|problems?|issues?|downsides?|pontos? fracos?|problemas?|fraquezas?)\s*:\s*(.*)$/i;
const HEADING = /^#{1,6}\s+(.*)$/;
const STEP = /^\d{1,2}[.)]\s+(.*)$/;
// "Combo 1 — A + B": the title before an em/en dash or a colon, the pieces after it.
const TITLE_SEPARATOR = /\s+[—–]\s+|:\s+/;
const WIKILINK = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;
const BOLD = /\*\*(.+?)\*\*/g;
const ZONE_HEADER = /^([\p{L} ]+?)\s*:\s*(.*)$/u;
const ALTERNATIVES = /\s+(?:or|ou)\s+|\s*\|\s*/i;

export function zoneName(text: string): Zone | null {
	return ZONE_ALIASES[fold(text)] ?? null;
}

/**
 * Two ways to write a combo, which can be mixed:
 * - zones: "battlefield:" followed by lines of cards joined by operators;
 * - a note: "### Combo 1 — [[A]] + [[B]]", a numbered list of steps and free text.
 *   The heading gives the title and the pieces, bold text in the steps gives the results.
 */
export function parseCombo(source: string): Combo {
	const combo: Combo = { keywords: [], results: [], zones: [], steps: [], notes: [], how: [], weak: [] };
	let current: ComboZone | null = null;
	let inSteps = false;
	// Multi-line text field being read ("how:" or "weak:").
	let text: string[] | null = null;
	// "result:" or "keyword:" left empty: the values are on the lines below it.
	let list: string[] | null = null;
	const zoneFor = (zone: Zone): ComboZone => {
		let z = combo.zones.find((c) => c.zone === zone);
		if (!z) combo.zones.push((z = { zone, rows: [] }));
		return z;
	};
	const hasCards = () => combo.zones.some((z) => z.rows.length > 0);

	for (const raw of source.split('\n')) {
		const line = raw.trim();

		const field = HOW.exec(line) ?? WEAK.exec(line);
		if (field) {
			list = null;
			text = HOW.test(line) ? combo.how : combo.weak;
			current = null;
			if (field[1]!.trim()) text.push(field[1]!.trim());
			continue;
		}
		if (text) {
			// Everything up to a "result:"/"title:"/"keyword:" line or a zone header on its own line is the text.
			const header = ZONE_HEADER.exec(line);
			const ends = OPTION.test(line) || (header && !header[2]!.trim() && zoneName(header[1]!));
			if (!ends) {
				text.push(raw.trimEnd());
				continue;
			}
			text = null;
		}

		if (list) {
			const header = ZONE_HEADER.exec(line);
			const ends = !line || OPTION.test(line) || HEADING.test(line) || (header && zoneName(header[1]!));
			if (!ends) {
				list.push(...splitList(line.replace(/^[-*+]\s+/, '')));
				continue;
			}
			list = null;
		}

		if (!line) {
			// A blank line ends a zone's cards; text after it is a note.
			current = null;
			inSteps = false;
			continue;
		}
		if (line.startsWith('//')) continue;

		const heading = HEADING.exec(line);
		if (heading) {
			const text = heading[1]!.trim();
			const parts = text.split(TITLE_SEPARATOR);
			const pieces = parts.length > 1 ? parts.slice(1).join(' ') : text;
			const row = looksLikePieces(pieces) ? parseComboLine(pieces) : [];
			if (row.length) zoneFor('pieces').rows.push(row);
			if (parts.length > 1 || !row.length) combo.title ??= parts[0]!.trim() || undefined;
			current = null;
			continue;
		}

		const option = OPTION.exec(line);
		if (option) {
			const value = option[2]!.trim();
			const key = option[1]!.toLowerCase();
			if (key === 'title' || fold(key) === 'titulo') {
				combo.title = value || undefined;
			} else {
				const target = key.startsWith('result') ? combo.results : combo.keywords;
				target.push(...splitList(value));
				if (!value) list = target;
			}
			current = null;
			continue;
		}

		const step = STEP.exec(line);
		if (step) {
			combo.steps.push(step[1]!.trim());
			inSteps = true;
			current = null;
			continue;
		}
		if (inSteps && /^\s/.test(raw)) {
			// Indented line: continues the step above.
			combo.steps[combo.steps.length - 1] += ` ${line}`;
			continue;
		}

		let rest = line;
		const header = ZONE_HEADER.exec(line);
		const zone = header ? zoneName(header[1]!) : null;
		if (zone) {
			current = zoneFor(zone);
			rest = header![2]!.trim();
			if (!rest) continue;
		} else if (!current) {
			// Only a block that starts with cards treats its first lines as the battlefield.
			if (hasCards() || combo.steps.length || combo.notes.length) {
				combo.notes.push(line);
				continue;
			}
			current = zoneFor('battlefield');
		}

		const row = parseComboLine(rest);
		if (row.length) current.rows.push(row);
	}

	for (const lines of [combo.how, combo.weak]) {
		while (lines.length && !lines[lines.length - 1]!.trim()) lines.pop();
	}
	const numbered = combo.how.map((l) => STEP.exec(l.trim())?.[1]).filter((l): l is string => !!l);
	if (!combo.results.length) {
		for (const step of [...combo.steps, ...numbered]) {
			for (const m of step.matchAll(BOLD)) combo.results.push(m[1]!.replace(/[.!]+$/, '').trim());
		}
	}
	return combo;
}

/** Heading text that names cards: "[[A]] + [[B]]" or "A + B" (not just "Combo 1"). */
function looksLikePieces(text: string): boolean {
	return /\[\[/.test(text) || /\s\+\s/.test(text);
}

function splitList(text: string): string[] {
	return text
		.split(/\s*[,;]\s*/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/**
 * "Ashnod's Altar or Phyrexian Altar + Gravecrawler - Grave Titan" → three cards.
 * `+` always separates; `-`, `*` and `~` are operators at the start of a piece or after a space,
 * so hyphenated names (Lim-Dûl, Mind-Bomb) stay whole. Quoted names are taken as written.
 */
export function parseComboLine(input: string): ComboCard[] {
	// [[Card]] and [[Card|alias]] are the card's name; quoted so operators inside it are kept.
	const line = input.replace(WIKILINK, (_, name: string) => `"${name.trim()}"`);
	const cards: ComboCard[] = [];
	let ops: string[] = [];
	let name = '';
	let quoted = false;

	const flush = () => {
		const text = name.trim();
		name = '';
		if (!text) return;
		const previous = cards[cards.length - 1];
		if (ops.includes('>')) {
			// "A > each opponent": a target of A, not a new card in the line (dropped when nothing comes before).
			const target = previous ? parseTarget(text, ops) : null;
			if (target) previous!.targets.push(target);
			ops = [];
			return;
		}
		const token = parseToken(text);
		const options = token
			? []
			: splitAlternatives(text)
					.map((alt) => parseMoxfieldLine(alt))
					.filter((q): q is CardQuery => q !== null);
		if (!token && !options.length) {
			ops = [];
			return;
		}
		const link = ops.find((o): o is Link => o === '+' || o === '-' || o === '*');
		cards.push({
			options,
			token: token ?? undefined,
			link: cards.length ? (link ?? '+') : link === '+' ? undefined : link,
			removed: ops.includes('-'),
			onStack: ops.includes('*'),
			tapped: ops.includes('~'),
			targets: [],
			text: `${ops.join('')}${text}`,
		});
		ops = [];
	};

	let bracket = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i]!;
		if (ch === '"' && !bracket) {
			quoted = !quoted;
			name += ch;
			continue;
		}
		// "[Zombie 2/2]": a token; operators inside it are part of it.
		if (!quoted && (ch === '[' || (bracket && ch === ']'))) bracket = ch === '[';
		if (quoted || bracket || ch === ']') {
			name += ch;
			continue;
		}
		// Target arrow: ">", "->" or "→".
		const arrow = ch === '>' || ch === '→' ? 1 : ch === '-' && line[i + 1] === '>' ? 2 : 0;
		if (arrow) {
			if (name.trim()) flush();
			ops.push('>');
			i += arrow - 1;
			continue;
		}
		const atStart = name.trim() === '' || /\s/.test(line[i - 1] ?? ' ');
		if (ch === '+' || (atStart && (ch === '-' || ch === '*' || ch === '~') && line[i + 1] !== ch)) {
			if (name.trim()) flush();
			ops.push(ch);
			continue;
		}
		name += ch;
	}
	flush();
	return cards;
}

const PLAYER_WORDS: Record<string, PlayerTarget> = {
	me: 'you',
	you: 'you',
	yourself: 'you',
	self: 'you',
	eu: 'you',
	mim: 'you',
	voce: 'you',
	opponent: 'opponent',
	'an opponent': 'opponent',
	'target opponent': 'opponent',
	oponente: 'opponent',
	'um oponente': 'opponent',
	'oponente alvo': 'opponent',
	opponents: 'each-opponent',
	'each opponent': 'each-opponent',
	'all opponents': 'each-opponent',
	'every opponent': 'each-opponent',
	oponentes: 'each-opponent',
	'cada oponente': 'each-opponent',
	'todos os oponentes': 'each-opponent',
	player: 'player',
	'a player': 'player',
	'target player': 'player',
	jogador: 'player',
	'jogador alvo': 'player',
	'um jogador': 'player',
	'each player': 'each-player',
	'all players': 'each-player',
	'every player': 'each-player',
	players: 'each-player',
	everyone: 'each-player',
	'cada jogador': 'each-player',
	'todos os jogadores': 'each-player',
	todos: 'each-player',
	'any target': 'any',
	'qualquer alvo': 'any',
};

// "target creature", "a land", "another artifact", "criatura alvo", "uma criatura"…
const OBJECT_NOUNS = new Set([
	'creature',
	'artifact',
	'enchantment',
	'land',
	'planeswalker',
	'permanent',
	'spell',
	'ability',
	'token',
	'battle',
	'card',
	'nonland permanent',
	'creature or planeswalker',
	'criatura',
	'artefato',
	'encantamento',
	'terreno',
	'permanente',
	'magica',
	'habilidade',
	'ficha',
	'batalha',
	'carta',
]);
const OBJECT_WORDS = /^(?:(?:target|a|an|any|another|each|all|every|up to (?:one|two|\d+)|one|two|\d+|uma?|outra|outro|cada|todas? as|todos os)\s+)?(.+?)(?:\s+(?:alvo|alvos))?$/;

function fold(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

/** Target after `>`: a player, a kind of object, or else a card (looked up on Scryfall). */
export function parseTarget(text: string, ops: string[] = []): Target | null {
	const token = parseToken(text);
	if (token) {
		const card = { options: [], token, removed: ops.includes('-'), onStack: ops.includes('*'), tapped: ops.includes('~'), targets: [], text };
		return { kind: 'card', card };
	}
	const plain = text.replace(/^"(.*)"$/, '$1').trim();
	if (!plain) return null;
	if (!text.startsWith('"')) {
		const key = fold(plain);
		const who = PLAYER_WORDS[key];
		if (who) return { kind: 'player', who };
		const noun = OBJECT_WORDS.exec(key)?.[1] ?? '';
		if (OBJECT_NOUNS.has(noun) || OBJECT_NOUNS.has(noun.replace(/s$/, ''))) {
			return { kind: 'object', label: plain.charAt(0).toUpperCase() + plain.slice(1) };
		}
	}
	const options = splitAlternatives(plain)
		.map((alt) => parseMoxfieldLine(alt))
		.filter((q): q is CardQuery => q !== null);
	if (!options.length) return null;
	return {
		kind: 'card',
		card: {
			options,
			removed: ops.includes('-'),
			onStack: ops.includes('*'),
			tapped: ops.includes('~'),
			targets: [],
			text: `${ops.join('')}${text}`,
		},
	};
}

const COLOR_WORDS: Record<string, string> = {
	white: 'W',
	blue: 'U',
	black: 'B',
	red: 'R',
	green: 'G',
	colorless: 'C',
	colourless: 'C',
	branco: 'W',
	branca: 'W',
	azul: 'U',
	preto: 'B',
	preta: 'B',
	vermelho: 'R',
	vermelha: 'R',
	verde: 'G',
	incolor: 'C',
};

/**
 * "[Zombie 2/2]", "[token Zombie 2/2 black]", "[3x Insect 1/1 BG]", "[Treasure]", "[ficha Eldrazi Spawn 0/1]".
 * null when the text isn't in square brackets.
 */
export function parseToken(text: string): TokenSpec | null {
	const inner = /^\[([^\]]*)\]$/.exec(text.trim())?.[1]?.trim();
	if (!inner) return null;
	let quantity = 1;
	const colors = new Set<string>();
	let power: string | undefined;
	let toughness: string | undefined;
	const words: string[] = [];
	for (const word of inner.split(/\s+/)) {
		const folded = fold(word);
		const count = /^(?:x?(\d{1,2})x?)$/i.exec(word);
		const pt = /^([*x]|\d{1,2})\/([*x]|\d{1,2})$/i.exec(word);
		if (count && !words.length && !power) quantity = Math.max(1, Number(count[1]));
		else if (/^(tokens?|fichas?)$/.test(folded)) continue;
		else if (pt) [power, toughness] = [pt[1]!.toUpperCase(), pt[2]!.toUpperCase()];
		else if (COLOR_WORDS[folded]) colors.add(COLOR_WORDS[folded]);
		else if (/^[WUBRGC]{1,5}$/.test(word)) for (const c of word) colors.add(c);
		else words.push(word);
	}
	// Trailing "x3" after the name.
	const last = words[words.length - 1];
	const trailing = last ? /^x(\d{1,2})$/i.exec(last) : null;
	if (trailing) {
		quantity = Math.max(1, Number(trailing[1]));
		words.pop();
	}
	const name = words.join(' ');
	if (!name) return null;
	return { name, power, toughness, colors: [...colors], quantity };
}

/** "A or B | C" → [A, B, C]; quoted names ("Fight or Flight") are not split and lose their quotes. */
function splitAlternatives(text: string): string[] {
	const out: string[] = [];
	let current = '';
	for (const part of text.match(/"[^"]*"?|[^"]+/g) ?? []) {
		if (part.startsWith('"')) {
			current += part.replace(/^"|"$/g, '');
			continue;
		}
		const pieces = part.split(ALTERNATIVES);
		current += pieces[0] ?? '';
		for (const piece of pieces.slice(1)) {
			out.push(current);
			current = piece;
		}
	}
	out.push(current);
	return out.map((s) => s.trim()).filter(Boolean);
}

/** Colour family of a keyword or result. */
export type Tone = 'win' | 'damage' | 'mana' | 'life' | 'death' | 'tokens' | 'cards' | 'other';

// First match wins: "drain each opponent" is damage, "ganho de vida" is life.
const STYLE_RULES: [RegExp, string, Tone][] = [
	[/\b(win|wins|victory|vit[oó]ria|vence|ganha o jogo)/, 'trophy', 'win'],
	[/\b(kill|kills|mata|damage|dano|drain|dreno|ping|lose life|perde vida|perdem vida|burn)/, 'swords', 'damage'],
	[/\bmana\b/, 'gem', 'mana'],
	[/\b(life|lifegain|vida|lifelink)/, 'heart', 'life'],
	[/\b(death|dies|die|morte|mortes|morre|sacrific)/, 'skull', 'death'],
	[/\b(token|tokens|ficha|fichas)/, 'copy', 'tokens'],
	[/\b(draw|compra|cards|cartas)/, 'book-open', 'cards'],
	[/\b(mill|moe|moer)/, 'arrow-down-to-line', 'cards'],
	[/\b(storm|cast|conjura)/, 'zap', 'other'],
	[/\b(etb|enters|entra)/, 'log-in', 'other'],
	[/\b(turn|turns|turno|turnos)/, 'refresh-cw', 'other'],
	[/\b(counter|counters|marcador|marcadores)/, 'plus-circle', 'other'],
	[/\b(tutor|search|busca)/, 'search', 'other'],
];

/** Icon (Lucide) and colour family: "infinite mana" → gem/mana, "vitória" → trophy/win. */
export function comboStyle(text: string): { icon: string; tone: Tone } {
	const t = text.toLowerCase();
	const rule = STYLE_RULES.find(([re]) => re.test(t));
	return rule ? { icon: rule[1], tone: rule[2] } : { icon: 'infinity', tone: 'other' };
}

/** Lucide icon for a result: "infinite mana" → gem, "win the game" → trophy. */
export function resultIcon(result: string): string {
	return comboStyle(result).icon;
}

/** Starting `mtg-combo` block for a new primer: the card on the battlefield, the other fields empty to fill in. */
export function starterCombo(card: { name: string; frontName: string }): string {
	return [
		'```mtg-combo',
		`title: ${card.frontName} combo`,
		'keyword:',
		'battlefield:',
		`[[${card.frontName}]]`,
		'how:',
		'weak:',
		'result:',
		'```',
	].join('\n');
}
