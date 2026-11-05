import { MarkdownRenderChild, MarkdownRenderer, setIcon, type MarkdownPostProcessorContext } from 'obsidian';
import type { ScryfallCard } from './card';
import {
	comboStyle,
	parseCombo,
	PLAYER_TARGET_LABELS,
	ZONE_LABELS,
	type ComboCard,
	type Link,
	type PlayerTarget,
	type Target,
	type TokenSpec,
	type Zone,
} from './combo';
import { appendManaSymbol, replaceManaInElement } from './mana';
import type MtgCardPrimersPlugin from './main';
import type { CardQuery } from './moxfield';

/** Scryfall data for the block's cards and tokens. */
interface Found {
	cards: Map<CardQuery, ScryfallCard | null>;
	tokens: Map<TokenSpec, ScryfallCard | null>;
}

const ZONE_ICONS: Record<Zone, string> = {
	pieces: 'puzzle',
	battlefield: 'swords',
	hand: 'hand',
	stack: 'layers',
	graveyard: 'skull',
	exile: 'ban',
	library: 'library',
	command: 'crown',
};
// Shown in a narrower column at the side, like on a playmat.
const SIDE_ZONES: Zone[] = ['graveyard', 'exile', 'library'];
const LINK_LABELS: Record<Link, string> = { '+': 'together with', '-': 'removed / sacrificed', '*': 'on the stack' };
const LINK_GLYPHS: Record<Link, string> = { '+': '+', '-': '−', '*': '*' };
const PLAYER_ICONS: Record<PlayerTarget, string> = {
	you: 'user',
	opponent: 'user-x',
	'each-opponent': 'users',
	player: 'user',
	'each-player': 'globe',
	any: 'crosshair',
};

/** The card and the cards it targets. */
function withTargetCards(card: ComboCard): ComboCard[] {
	return [card, ...card.targets.flatMap((t) => (t.kind === 'card' ? withTargetCards(t.card) : []))];
}

/**
 * ```mtg-combo
 * battlefield:
 * Ashnod's Altar or Phyrexian Altar + Gravecrawler + Grave Titan
 * graveyard:
 * Reassembling Skeleton
 * result: infinite mana
 * ```
 * The combo's cards as images in the zones where they need to be.
 */
export async function renderComboBlock(
	plugin: MtgCardPrimersPlugin,
	source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
): Promise<void> {
	const combo = parseCombo(source);
	const root = el.createDiv({ cls: 'mtg-combo' });
	const pieces = combo.zones.flatMap((z) => z.rows.flat());
	if (pieces.length === 0) {
		root.createDiv({
			cls: 'mtg-card-warning',
			text: 'Write the combo inside the block: a zone ("battlefield:") and its cards joined by +.',
		});
		return;
	}

	const all = pieces.flatMap(withTargetCards);
	const queries = all.flatMap((p) => p.options);
	const tokens = all.flatMap((p) => (p.token ? [p.token] : []));
	const loading = root.createDiv({ cls: 'mtg-card-loading', text: 'Loading combo…' });
	let cards: (ScryfallCard | null)[];
	let tokenCards: (ScryfallCard | null)[];
	try {
		[cards, tokenCards] = await Promise.all([
			plugin.scryfall.cards(queries),
			// A token Scryfall doesn't know is drawn instead, so a failed lookup isn't an error.
			Promise.all(tokens.map((t) => plugin.scryfall.token(t).catch(() => null))),
		]);
	} catch (e) {
		root.createDiv({ cls: 'mtg-card-warning', text: `Scryfall unavailable (${e instanceof Error ? e.message : String(e)}).` });
		cards = queries.map(() => null);
		tokenCards = tokens.map(() => null);
	}
	loading.remove();
	const found: Found = {
		cards: new Map(queries.map((q, i) => [q, cards[i] ?? null])),
		tokens: new Map(tokens.map((t, i) => [t, tokenCards[i] ?? null])),
	};

	if (combo.title || combo.keywords.length) {
		const header = root.createDiv({ cls: 'mtg-combo-header' });
		if (combo.title) header.createDiv({ cls: 'mtg-combo-title', text: combo.title });
		if (combo.keywords.length) {
			// The first keyword also colours the block's top edge.
			root.addClass(`is-${comboStyle(combo.keywords[0]!).tone}`);
			const keywords = header.createDiv({ cls: 'mtg-combo-keywords' });
			for (const keyword of combo.keywords) {
				const style = comboStyle(keyword);
				const badge = keywords.createDiv({ cls: `mtg-combo-keyword is-${style.tone}` });
				setIcon(badge.createSpan({ cls: 'mtg-combo-keyword-icon' }), style.icon);
				badge.createSpan({ text: keyword });
			}
		}
	}

	const mat = root.createDiv({ cls: 'mtg-combo-mat' });
	const main = combo.zones.filter((z) => !SIDE_ZONES.includes(z.zone));
	const side = combo.zones.filter((z) => SIDE_ZONES.includes(z.zone));
	for (const [zones, cls] of [
		[main, 'mtg-combo-main'],
		[side, 'mtg-combo-side'],
	] as const) {
		if (!zones.length) continue;
		const column = mat.createDiv({ cls });
		for (const zone of zones) {
			const zoneEl = column.createDiv({ cls: `mtg-combo-zone is-${zone.zone}` });
			const heading = zoneEl.createDiv({ cls: 'mtg-combo-zone-title' });
			setIcon(heading.createSpan({ cls: 'mtg-combo-zone-icon' }), ZONE_ICONS[zone.zone]);
			heading.createSpan({ text: ZONE_LABELS[zone.zone] });
			for (const row of zone.rows) {
				const rowEl = zoneEl.createDiv({ cls: 'mtg-combo-row' });
				for (const piece of row) renderPiece(plugin, rowEl, piece, found, ctx.sourcePath);
			}
		}
	}

	if (combo.results.length) {
		const results = root.createDiv({ cls: 'mtg-combo-results' });
		for (const result of combo.results) {
			const style = comboStyle(result);
			const chip = results.createDiv({ cls: `mtg-combo-result is-${style.tone}` });
			setIcon(chip.createSpan({ cls: 'mtg-combo-result-icon' }), style.icon);
			chip.createSpan({ text: result });
		}
	}

	if (combo.steps.length || combo.how.length || combo.weak.length || combo.notes.length) {
		// Rendered as Markdown: [[links]] with hover previews, bold, lists, mana symbols.
		const child = new MarkdownRenderChild(root);
		ctx.addChild(child);
		const markdown = async (parent: HTMLElement, cls: string, text: string) => {
			const box = parent.createDiv({ cls });
			await MarkdownRenderer.render(plugin.app, text, box, ctx.sourcePath, child);
			if (plugin.settings.manaSymbols) replaceManaInElement(box);
		};
		/** A collapsible box, open by default. */
		const section = (cls: string, icon: string, label: string) => {
			const box = root.createEl('details', { cls: `mtg-combo-section ${cls}`, attr: { open: '' } });
			const summary = box.createEl('summary');
			setIcon(summary.createSpan({ cls: 'mtg-combo-section-icon' }), icon);
			summary.createSpan({ text: label });
			// Live Preview: open/close without moving the cursor into the block.
			summary.addEventListener('click', (e) => e.stopPropagation());
			return box;
		};
		if (combo.steps.length || combo.how.length) {
			const how = section('mtg-combo-how', 'lightbulb', 'How it works');
			if (combo.steps.length) await markdown(how, 'mtg-combo-steps', combo.steps.map((t, i) => `${i + 1}. ${t}`).join('\n'));
			if (combo.how.length) await markdown(how, 'mtg-combo-explanation', combo.how.join('\n'));
		}
		if (combo.weak.length) {
			await markdown(section('mtg-combo-weak', 'alert-triangle', 'Weak points'), 'mtg-combo-explanation', combo.weak.join('\n'));
		}
		if (combo.notes.length) await markdown(root, 'mtg-combo-notes', combo.notes.join('\n'));
	}

	const missing = queries.filter((q) => !found.cards.get(q));
	if (missing.length) {
		root.createDiv({ cls: 'mtg-card-warning', text: `Not found on Scryfall: ${missing.map((q) => q.name).join(' · ')}` });
	}
}

function renderPiece(
	plugin: MtgCardPrimersPlugin,
	row: HTMLElement,
	piece: ComboCard,
	found: Found,
	sourcePath: string,
): void {
	// The operator and its card wrap to the next line together.
	const step = row.createDiv({ cls: 'mtg-combo-step' });
	if (piece.link && row.childElementCount > 1) {
		step.createSpan({
			cls: `mtg-combo-link is-${piece.link === '+' ? 'plus' : piece.link === '-' ? 'minus' : 'stack'}`,
			text: LINK_GLYPHS[piece.link],
			attr: { 'aria-label': LINK_LABELS[piece.link], title: LINK_LABELS[piece.link] },
		});
	}
	renderOptions(plugin, step, piece, found, sourcePath);

	for (const target of piece.targets) {
		const targetStep = row.createDiv({ cls: 'mtg-combo-step' });
		targetStep.createSpan({ cls: 'mtg-combo-link is-target', text: '→', attr: { 'aria-label': 'targets', title: 'Targets' } });
		renderTarget(plugin, targetStep, target, found, sourcePath);
	}
}

function renderOptions(
	plugin: MtgCardPrimersPlugin,
	parent: HTMLElement,
	piece: ComboCard,
	found: Found,
	sourcePath: string,
): void {
	if (piece.token) {
		renderToken(parent, piece.token, found.tokens.get(piece.token) ?? null, piece);
		return;
	}
	const slot = piece.options.length > 1 ? parent.createDiv({ cls: 'mtg-combo-choice', attr: { title: 'Any one of these' } }) : parent;
	piece.options.forEach((query, i) => {
		if (i > 0) slot.createSpan({ cls: 'mtg-combo-or', text: 'or' });
		renderCard(plugin, slot, query, found.cards.get(query) ?? null, piece, sourcePath);
	});
}

/** A player or kind of object as a labelled chip; a specific card as its image. */
function renderTarget(
	plugin: MtgCardPrimersPlugin,
	parent: HTMLElement,
	target: Target,
	found: Found,
	sourcePath: string,
): void {
	if (target.kind === 'card') {
		const holder = parent.createDiv({ cls: 'mtg-combo-target-card' });
		renderOptions(plugin, holder, target.card, found, sourcePath);
		setIcon(holder.createSpan({ cls: 'mtg-combo-target-mark', attr: { 'aria-label': 'Target' } }), 'crosshair');
		return;
	}
	const label = target.kind === 'player' ? PLAYER_TARGET_LABELS[target.who] : target.label;
	const chip = parent.createDiv({ cls: `mtg-combo-target is-${target.kind === 'player' ? target.who : 'object'}` });
	setIcon(chip.createSpan({ cls: 'mtg-combo-target-icon' }), target.kind === 'player' ? PLAYER_ICONS[target.who] : 'crosshair');
	chip.createSpan({ text: label });
}

function renderCard(
	plugin: MtgCardPrimersPlugin,
	parent: HTMLElement,
	query: CardQuery,
	card: ScryfallCard | null,
	piece: ComboCard,
	sourcePath: string,
): void {
	const name = card?.name ?? query.name;
	const { tile, face } = cardTile(parent, piece, name, 'Click: open primer in the side panel');
	cardImage(face, card, name);

	tile.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation(); // Live Preview: don't move the cursor into the block
		const newTab = e.ctrlKey || e.metaKey;
		if (card) void plugin.openPrimer(card, newTab ? 'tab' : 'panel');
		else void plugin.app.workspace.openLinkText(query.name, sourcePath, newTab);
	});
}

/** The card's frame with its state (tapped, on the stack, removed) and badges; the image goes in face. */
function cardTile(parent: HTMLElement, piece: ComboCard, name: string, hint: string): { tile: HTMLElement; face: HTMLElement } {
	const states: string[] = [];
	const tile = parent.createDiv({ cls: 'mtg-combo-card' });
	if (piece.tapped) {
		tile.addClass('is-tapped');
		states.push('tapped');
	}
	if (piece.onStack) {
		tile.addClass('is-on-stack');
		states.push('on the stack');
	}
	if (piece.removed) {
		tile.addClass('is-removed');
		states.push('removed / sacrificed');
	}
	tile.setAttr('title', `${name}${states.length ? ` (${states.join(', ')})` : ''}${hint ? `\n${hint}` : ''}`);
	const face = tile.createDiv({ cls: 'mtg-combo-face' });

	if (states.length) {
		const badges = tile.createDiv({ cls: 'mtg-combo-badges' });
		if (piece.tapped) {
			const b = badges.createSpan({ cls: 'mtg-combo-badge is-tapped', attr: { 'aria-label': 'Tapped' } });
			appendManaSymbol(b, '{T}');
		}
		if (piece.onStack) setIcon(badges.createSpan({ cls: 'mtg-combo-badge is-on-stack', attr: { 'aria-label': 'On the stack' } }), 'layers');
		if (piece.removed) setIcon(badges.createSpan({ cls: 'mtg-combo-badge is-removed', attr: { 'aria-label': 'Removed / sacrificed' } }), 'x');
	}
	return { tile, face };
}

/** The Scryfall image, or a placeholder with the name when there's none (or it fails to load). */
function cardImage(face: HTMLElement, card: ScryfallCard | null, name: string, fallback?: () => void): void {
	const images = card?.image_uris ?? card?.card_faces?.[0]?.image_uris;
	const url = images?.normal ?? images?.large ?? images?.small;
	const placeholder = fallback ?? (() => face.createDiv({ cls: 'mtg-deck-placeholder', text: name }));
	if (!url) {
		placeholder();
		return;
	}
	const img = face.createEl('img', { attr: { src: url, alt: name, loading: 'lazy' } });
	img.addEventListener('error', () => {
		img.remove();
		placeholder();
	});
}

const COLOR_NAMES: Record<string, string> = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green', C: 'colorless' };

/** A token: Scryfall's token image, or a simple drawn token (name, colours, power/toughness). */
function renderToken(parent: HTMLElement, token: TokenSpec, card: ScryfallCard | null, piece: ComboCard): void {
	const pt = token.power !== undefined ? ` ${token.power}/${token.toughness}` : '';
	const colors = token.colors.map((c) => COLOR_NAMES[c]).join(' and ');
	const label = `${token.quantity > 1 ? `${token.quantity} × ` : ''}${colors ? `${colors} ` : ''}${token.name}${pt} token`;
	const { tile, face } = cardTile(parent, piece, label, '');
	tile.addClass('is-token');
	if (token.quantity > 1) {
		tile.addClass('has-copies');
		tile.createSpan({ cls: 'mtg-deck-badge', text: `×${token.quantity}` });
	}
	cardImage(face, card, label, () => {
		const drawn = face.createDiv({ cls: 'mtg-combo-token-drawn' });
		const tone = token.colors.length === 1 ? token.colors[0]! : token.colors.length > 1 ? 'M' : 'C';
		drawn.addClass(`is-${tone.toLowerCase()}`);
		drawn.createDiv({ cls: 'mtg-combo-token-kind', text: 'Token' });
		drawn.createDiv({ cls: 'mtg-combo-token-name', text: token.name });
		if (pt) drawn.createDiv({ cls: 'mtg-combo-token-pt', text: pt.trim() });
	});
	tile.addEventListener('click', (e) => e.stopPropagation()); // Live Preview: keep the cursor out
}
