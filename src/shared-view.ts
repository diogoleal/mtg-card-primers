import { MarkdownRenderChild, MarkdownRenderer, setIcon, TFile, type App, type MarkdownPostProcessorContext } from 'obsidian';
import type { ScryfallCard } from './card';
import { editBlock } from './deck';
import type MtgCardPrimersPlugin from './main';
import { replaceManaInElement } from './mana';
import type { CardQuery } from './moxfield';
import { moveSharedCard, parseShared, type SharedCard, type SharedDeck } from './shared';
import { openCard } from './swap-view';

interface Context {
	plugin: MtgCardPrimersPlugin;
	ctx: MarkdownPostProcessorContext;
	found: Map<object, ScryfallCard | null>;
	/** Writes the move into the block; Obsidian then draws it again. */
	move: (cardIndex: number, deckIndex: number) => void;
	markdown: (parent: HTMLElement, cls: string, text: string) => Promise<void>;
}

/**
 * ```mtg-shared
 * 1 Blackblade Reforged
 * - [x] Arahbo, Roar of the World
 * - [ ] Whiplash, Vengeful Engineer
 * ```
 * A card you own fewer copies of than the decks that play it, and where it is now.
 */
export async function renderSharedBlock(
	plugin: MtgCardPrimersPlugin,
	source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
): Promise<void> {
	const shared = parseShared(source);
	const root = el.createDiv({ cls: 'mtg-shared' });
	const header = root.createDiv({ cls: 'mtg-shared-header' });
	const titleEl = header.createDiv({ cls: 'mtg-shared-title' });
	setIcon(titleEl.createSpan({ cls: 'mtg-shared-title-icon' }), 'share-2');
	titleEl.createSpan({ text: shared.title ?? 'Shared cards' });

	if (!shared.cards.length) {
		root.createDiv({
			cls: 'mtg-shared-empty-hint',
			text: 'Write the card, then the decks that share it, one per line: - [x] the deck that has it now, - [ ] the others.',
		});
		return;
	}
	if (shared.cards.length > 1) header.createSpan({ cls: 'mtg-shared-stats', text: `${shared.cards.length} cards` });

	// The card and each deck's commander, looked up together.
	const decks = shared.cards.flatMap((c) => c.decks.map((d) => ({ deck: d, ...deckTarget(plugin.app, d, ctx.sourcePath) })));
	const lookups: { key: object; query: CardQuery }[] = [
		...shared.cards.map((c) => ({ key: c, query: c.card.query })),
		...decks.map((d) => ({ key: d.deck, query: { name: d.commander } })),
	];
	const loading = root.createDiv({ cls: 'mtg-card-loading', text: 'Loading cards…' });
	let cards: (ScryfallCard | null)[];
	try {
		cards = await plugin.scryfall.cards(lookups.map((l) => l.query));
	} catch (e) {
		root.createDiv({ cls: 'mtg-card-warning', text: `Scryfall unavailable (${e instanceof Error ? e.message : String(e)}).` });
		cards = lookups.map(() => null);
	}
	loading.remove();

	const child = new MarkdownRenderChild(root);
	ctx.addChild(child);
	const notes = new Map(decks.map((d) => [d.deck, d.note]));
	const context: Context = {
		plugin,
		ctx,
		found: new Map(lookups.map((l, i) => [l.key, cards[i] ?? null])),
		move: (cardIndex, deckIndex) => {
			void editBlock(plugin, source, el, ctx, (src) => moveSharedCard(src, cardIndex, deckIndex), ['mtg-shared']).then((done) => {
				if (!done) root.createDiv({ cls: 'mtg-card-warning', text: 'Could not update the block: edit the [x] by hand.' });
			});
		},
		markdown: async (parent, cls, text) => {
			const box = parent.createDiv({ cls });
			await MarkdownRenderer.render(plugin.app, text, box, ctx.sourcePath, child);
			if (plugin.settings.manaSymbols) replaceManaInElement(box);
		},
	};

	const body = root.createDiv({ cls: 'mtg-shared-body' });
	for (const [i, card] of shared.cards.entries()) await renderCard(body, card, i, context, notes);

	const missing = shared.cards.filter((c) => !context.found.get(c));
	if (missing.length) {
		root.createDiv({ cls: 'mtg-card-warning', text: `Not found on Scryfall: ${missing.map((c) => c.card.query.name).join(' · ')}` });
	}
}

async function renderCard(
	body: HTMLElement,
	shared: SharedCard,
	index: number,
	context: Context,
	notes: Map<SharedDeck, TFile | null>,
): Promise<void> {
	const card = context.found.get(shared) ?? null;
	const name = card?.name ?? shared.card.query.name;
	const row = body.createDiv({ cls: 'mtg-shared-card' });

	const tile = row.createDiv({ cls: 'mtg-shared-image', attr: { title: `${name}\nClick: open primer in the side panel` } });
	appendImage(tile, card, 'normal', name);
	tile.addEventListener('click', (e) => openCard(e, context.plugin, shared.card.query, card, context.ctx.sourcePath));

	const info = row.createDiv({ cls: 'mtg-shared-info' });
	info.createDiv({ cls: 'mtg-shared-name', text: name });

	const facts = info.createDiv({ cls: 'mtg-shared-facts' });
	const copies = shared.copies;
	const decks = shared.decks.length;
	facts.createSpan({ cls: 'mtg-shared-chip', text: `${copies} ${copies === 1 ? 'copy' : 'copies'} · ${decks} ${decks === 1 ? 'deck' : 'decks'}` });
	const holding = shared.decks.filter((d) => d.here);
	if (holding.length > copies) {
		const warn = facts.createSpan({ cls: 'mtg-shared-chip is-warning', text: `In ${holding.length} decks at once` });
		warn.setAttr('title', `You own ${copies} ${copies === 1 ? 'copy' : 'copies'}: take it out of ${holding.length - copies} of them.`);
	} else if (holding.length) {
		facts.createSpan({ cls: 'mtg-shared-chip is-here', text: `Now in ${holding.map((d) => d.name).join(', ')}` });
	} else if (decks) {
		facts.createSpan({ cls: 'mtg-shared-chip is-free', text: 'Not in a deck' });
	}
	if (shared.note) await context.markdown(info, 'mtg-shared-note', shared.note);

	const grid = info.createDiv({ cls: 'mtg-shared-decks' });
	shared.decks.forEach((deck, deckIndex) => renderDeck(grid, shared, index, deck, deckIndex, context, notes.get(deck) ?? null));
}

function renderDeck(
	grid: HTMLElement,
	shared: SharedCard,
	cardIndex: number,
	deck: SharedDeck,
	deckIndex: number,
	context: Context,
	note: TFile | null,
): void {
	const commander = context.found.get(deck) ?? null;
	const tile = grid.createDiv({ cls: deck.here ? 'mtg-shared-deck is-here' : 'mtg-shared-deck' });
	const art = tile.createDiv({
		cls: 'mtg-shared-art',
		attr: { title: note ? `Open ${note.basename}` : commander ? `${commander.name}\nClick: open primer in the side panel` : deck.name },
	});
	appendImage(art, commander, 'art_crop', deck.name);
	if (deck.here) setIcon(art.createSpan({ cls: 'mtg-shared-here-badge', attr: { 'aria-label': 'The card is here' } }), 'check');
	art.addEventListener('click', (e) => {
		if (note) {
			e.preventDefault();
			e.stopPropagation();
			void context.plugin.app.workspace.getLeaf(e.ctrlKey || e.metaKey ? 'tab' : false).openFile(note);
		} else if (commander) {
			openCard(e, context.plugin, { name: commander.name }, commander, context.ctx.sourcePath);
		}
	});

	tile.createDiv({ cls: 'mtg-shared-deck-name', text: deck.name, attr: { title: deck.name } });

	// One copy moves from deck to deck; with more copies each deck is switched on its own.
	const single = shared.copies <= 1;
	const label = deck.here ? (single ? 'Here' : 'Here · remove') : single ? 'Move here' : 'Add here';
	const button = tile.createEl('button', { cls: 'mtg-shared-move', text: label });
	if (deck.here && single) button.disabled = true;
	button.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation(); // Live Preview: don't move the cursor into the block
		button.disabled = true;
		context.move(cardIndex, deckIndex);
	});
}

function appendImage(parent: HTMLElement, card: ScryfallCard | null, size: 'normal' | 'art_crop', name: string): void {
	const images = card?.image_uris ?? card?.card_faces?.[0]?.image_uris;
	const url = images?.[size];
	const placeholder = () => parent.createDiv({ cls: 'mtg-deck-placeholder', text: name });
	if (!url) {
		placeholder();
		return;
	}
	const img = parent.createEl('img', { attr: { src: url, alt: name, loading: 'lazy' } });
	img.addEventListener('error', () => {
		img.remove();
		placeholder();
	});
}

/**
 * The note of a deck and the commander whose art stands for it:
 * a [[link]] to a deck primer, a note whose mtg_commander is the deck's name, or just the name.
 */
function deckTarget(app: App, deck: SharedDeck, sourcePath: string): { note: TFile | null; commander: string } {
	let note: TFile | null = null;
	if (deck.link) note = app.metadataCache.getFirstLinkpathDest(deck.link, sourcePath);
	if (!note) {
		const wanted = fold(deck.name);
		note =
			app.vault.getMarkdownFiles().find((f) => {
				const commander: unknown = app.metadataCache.getFileCache(f)?.frontmatter?.['mtg_commander'];
				return typeof commander === 'string' && fold(commander) === wanted;
			}) ?? null;
	}
	const commander: unknown = note ? app.metadataCache.getFileCache(note)?.frontmatter?.['mtg_commander'] : undefined;
	return { note: note instanceof TFile ? note : null, commander: typeof commander === 'string' ? commander : deck.name };
}

function fold(text: string): string {
	return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

