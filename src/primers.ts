import { App, normalizePath, stringifyYaml, TFile } from 'obsidian';
import type { CardInfo } from './card';
import { starterCombo } from './combo';
import { primerDecklist } from './decklist';
import { frontFaceName } from './moxfield';
import { sanitizeFileName } from './sanitize';
import type { MtgCardPrimersSettings } from './settings';

export const DEFAULT_TEMPLATE = `\`\`\`mtg-card
\`\`\`

## Summary

## How to play

## Synergies

## Combos

{{combo}}

## Pitfalls / interactions

## Decks I use it in
`;

/** Body of a new deck primer ("New deck primer"), unless the settings name a deck template. */
export const DEFAULT_DECK_TEMPLATE = `> How the deck wins, in a few lines. Key pieces: …

## Decklist

{{decklist}}

## How the deck wins

## Combos

{{combo}}

## Tutors

## Mulligan and opening hand

\`\`\`mtg-hand
keep
// The seven cards, one per line, then why: and the reason
\`\`\`

## What shuts the deck down

| Card | Effect |
| --- | --- |
|  |  |

## Deck changes

\`\`\`mtg-changes
// Out -> In — why
\`\`\`
`;

/** Added to the default template when "Decklist in new primers" is on. */
const DECKLIST_SECTION = `
## Decklist

{{decklist}}
`;

type Frontmatter = Record<string, unknown> | undefined;

function frontmatterOf(app: App, file: TFile): Frontmatter {
	return app.metadataCache.getFileCache(file)?.frontmatter;
}

/** Finds the primer with this oracle_id using only the metadata cache. */
export function findPrimerByOracleId(app: App, oracleId: string): TFile | null {
	const wanted = oracleId.toLowerCase();
	for (const file of app.vault.getMarkdownFiles()) {
		const id = frontmatterOf(app, file)?.['mtg_oracle_id'];
		if (typeof id === 'string' && id.toLowerCase() === wanted) return file;
	}
	return null;
}

/** Offline helper: finds a primer by card name (full or front face), case-insensitive. */
export function findPrimerByName(app: App, name: string): TFile | null {
	const wanted = frontFaceName(name).toLowerCase();
	for (const file of app.vault.getMarkdownFiles()) {
		const n = frontmatterOf(app, file)?.['mtg_name'];
		if (typeof n === 'string' && frontFaceName(n).toLowerCase() === wanted) return file;
	}
	return null;
}

export function buildFrontmatter(card: CardInfo): string {
	const data = {
		mtg_oracle_id: card.oracleId,
		mtg_name: card.name,
		mtg_scryfall_id: card.scryfallId,
		mtg_set: card.set,
		mtg_collector_number: card.collectorNumber,
		mtg_type_line: card.typeLine,
		mtg_mana_cost: card.manaCost,
		mtg_color_identity: card.colorIdentity,
		mtg_oracle_text: card.oracleText,
		tags: ['mtg/primer'],
	};
	return `---\n${stringifyYaml(data)}---\n`;
}

async function loadTemplate(app: App, settings: MtgCardPrimersSettings): Promise<string> {
	if (!settings.templatePath) return settings.primerDecklist ? DEFAULT_TEMPLATE + DECKLIST_SECTION : DEFAULT_TEMPLATE;
	return readTemplate(app, settings.templatePath);
}

/** A template note's text, without its own frontmatter (the plugin writes its own). */
async function readTemplate(app: App, templatePath: string): Promise<string> {
	let path = normalizePath(templatePath);
	if (!path.endsWith('.md')) path += '.md';
	const file = app.vault.getFileByPath(path);
	if (!file) throw new Error(`Template not found: ${path}`);
	const text = await app.vault.cachedRead(file);
	// The template's own frontmatter (if any) is dropped; the plugin writes its own.
	return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

function fillTemplate(template: string, card: CardInfo): string {
	return template
		.replace(/\{\{\s*name\s*\}\}/g, () => card.name)
		.replace(/\{\{\s*front_name\s*\}\}/g, () => card.frontName)
		.replace(/\{\{\s*oracle_id\s*\}\}/g, () => card.oracleId)
		.replace(/\{\{\s*decklist\s*\}\}/g, () => primerDecklist(card))
		.replace(/\{\{\s*combo\s*\}\}/g, () => starterCombo(card));
}

async function ensureFolder(app: App, folder: string): Promise<void> {
	if (!folder || folder === '/') return;
	let current = '';
	for (const part of folder.split('/')) {
		current = current ? `${current}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
	}
}

/** First free path: "Name.md", then "Name (SET).md", then "Name (SET) 2.md"... */
function freePath(app: App, folder: string, card: CardInfo, suffix = ''): string {
	const base = sanitizeFileName(card.frontName) + suffix;
	const prefix = folder && folder !== '/' ? `${folder}/` : '';
	const candidates = [base, `${base} (${card.set.toUpperCase()})`];
	for (const c of candidates) {
		const p = normalizePath(`${prefix}${c}.md`);
		if (!app.vault.getAbstractFileByPath(p)) return p;
	}
	for (let i = 2; ; i++) {
		const p = normalizePath(`${prefix}${candidates[1]} ${i}.md`);
		if (!app.vault.getAbstractFileByPath(p)) return p;
	}
}

export async function createPrimer(app: App, settings: MtgCardPrimersSettings, card: CardInfo): Promise<TFile> {
	const folder = normalizePath(settings.folder || '/');
	const body = fillTemplate(await loadTemplate(app, settings), card);
	await ensureFolder(app, folder);
	const path = freePath(app, folder, card);
	return app.vault.create(path, buildFrontmatter(card) + '\n' + body);
}

/**
 * A deck primer for a commander: "Grist Primer.md" in the decks folder, with the decklist and a combo
 * block that start with the commander. Its frontmatter has no mtg_oracle_id, so it is never taken for
 * the commander's card primer.
 */
export async function createDeckPrimer(app: App, settings: MtgCardPrimersSettings, card: CardInfo): Promise<TFile> {
	const folder = normalizePath(settings.deckFolder || '/');
	const template = settings.deckTemplatePath ? await readTemplate(app, settings.deckTemplatePath) : DEFAULT_DECK_TEMPLATE;
	const body = fillTemplate(template, card);
	await ensureFolder(app, folder);
	const path = freePath(app, folder, card, ' Primer');
	const data = {
		mtg_commander: card.name,
		mtg_color_identity: card.colorIdentity,
		tags: ['mtg/deck-primer'],
	};
	return app.vault.create(path, `---\n${stringifyYaml(data)}---\n\n${body}`);
}
