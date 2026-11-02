import { getFrontMatterInfo, parseYaml, type MarkdownPostProcessorContext } from 'obsidian';
import { cardInfoFromFrontmatter, toCardInfo, type CardInfo } from './card';
import type MtgCardPrimersPlugin from './main';
import { parseMoxfieldLine } from './moxfield';
import { appendManaText, appendOracleText, appendSetSymbol } from './mana';
import { setSymbolValue } from './insert';
import { findPrimerByName } from './primers';

/**
 * ```mtg-card```            → card from this note's frontmatter
 * ```mtg-card
 * 1 Sol Ring (C21) 263
 * ```                       → that card
 * If Scryfall fails, renders from a primer's frontmatter and shows a warning.
 */
export async function renderCardBlock(
	plugin: MtgCardPrimersPlugin,
	source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
): Promise<void> {
	const root = el.createDiv({ cls: 'mtg-card' });
	const loading = root.createDiv({ cls: 'mtg-card-loading', text: 'Loading card…' });
	const input = source.trim();

	try {
		const { online, fallback, error } = input
			? await loadByLine(plugin, input)
			: await loadFromNote(plugin, ctx);
		loading.remove();

		if (online) {
			renderCard(root, online);
		} else if (fallback) {
			renderCard(root, fallback);
			warn(root, `Scryfall unavailable (${error}). Showing the data saved in the note.`);
		} else {
			warn(root, error ?? 'Card not found.');
		}
	} catch (e) {
		loading.remove();
		warn(root, e instanceof Error ? e.message : String(e));
	}
}

interface LoadResult {
	online?: CardInfo;
	fallback?: CardInfo;
	error?: string;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * The note's frontmatter. Right after a primer is created, the metadata cache may not have indexed it yet,
 * so fall back to the render context and then to reading the file itself.
 */
async function noteFrontmatter(
	plugin: MtgCardPrimersPlugin,
	ctx: MarkdownPostProcessorContext,
): Promise<Record<string, unknown> | null> {
	const file = plugin.app.vault.getFileByPath(ctx.sourcePath);
	const cached = file ? plugin.app.metadataCache.getFileCache(file)?.frontmatter : undefined;
	if (cached?.['mtg_oracle_id']) return cached;
	const fromContext = ctx.frontmatter as Record<string, unknown> | null | undefined;
	if (fromContext?.['mtg_oracle_id']) return fromContext;
	if (!file) return null;
	try {
		const info = getFrontMatterInfo(await plugin.app.vault.cachedRead(file));
		return info.exists ? ((parseYaml(info.frontmatter) as Record<string, unknown> | null) ?? null) : null;
	} catch {
		return null; // invalid YAML
	}
}

async function loadFromNote(plugin: MtgCardPrimersPlugin, ctx: MarkdownPostProcessorContext): Promise<LoadResult> {
	const fm = await noteFrontmatter(plugin, ctx);
	const saved = fm ? cardInfoFromFrontmatter(fm) : null;
	if (!saved) {
		return { error: 'This note has no mtg_oracle_id/mtg_name frontmatter. Put a card name inside the block.' };
	}
	try {
		const card = saved.scryfallId
			? await plugin.scryfall.cardById(saved.scryfallId)
			: await plugin.scryfall.cardNamed(saved.name);
		return { online: toCardInfo(card) };
	} catch (e) {
		return { fallback: saved, error: message(e) };
	}
}

async function loadByLine(plugin: MtgCardPrimersPlugin, input: string): Promise<LoadResult> {
	const query = parseMoxfieldLine(input.split('\n')[0] ?? '');
	if (!query) return { error: 'Invalid card line.' };
	try {
		return { online: toCardInfo(await plugin.scryfall.resolve(query)) };
	} catch (e) {
		const primer = findPrimerByName(plugin.app, query.name);
		const fm = primer ? plugin.app.metadataCache.getFileCache(primer)?.frontmatter : undefined;
		const saved = fm ? cardInfoFromFrontmatter(fm) : null;
		if (saved) return { fallback: saved, error: message(e) };
		return { error: `Could not load "${query.name}": ${message(e)}` };
	}
}

export function renderCard(root: HTMLElement, card: CardInfo, opts: { image?: boolean } = {}): void {
	if (card.imageUrl && opts.image !== false) {
		const img = root.createEl('img', {
			cls: 'mtg-card-image',
			attr: { src: card.imageUrl, alt: card.name, loading: 'lazy' },
		});
		img.addEventListener('error', () => img.remove());
	}

	const info = root.createDiv({ cls: 'mtg-card-info' });
	const header = info.createDiv({ cls: 'mtg-card-header' });
	header.createSpan({ cls: 'mtg-card-name', text: card.name });
	if (card.manaCost) appendManaText(header.createSpan({ cls: 'mtg-card-cost' }), card.manaCost);

	if (card.typeLine) info.createDiv({ cls: 'mtg-card-type', text: card.typeLine });
	if (card.oracleText) appendOracleText(info.createDiv({ cls: 'mtg-card-text' }), card.oracleText);

	const footer = info.createDiv({ cls: 'mtg-card-footer' });
	if (card.set) {
		const print = footer.createSpan({ cls: 'mtg-card-print' });
		appendSetSymbol(print, setSymbolValue(card));
		print.appendText(`${card.set.toUpperCase()}${card.collectorNumber ? ` #${card.collectorNumber}` : ''}`);
	}
	if (card.scryfallUri) {
		footer.createEl('a', { text: 'Scryfall', href: card.scryfallUri, cls: 'external-link' });
	}
}

function warn(root: HTMLElement, text: string): void {
	root.createDiv({ cls: 'mtg-card-warning', text });
}
