import { App, normalizePath, stringifyYaml, TFile } from 'obsidian';
import type { CardInfo } from './card';
import { frontFaceName } from './moxfield';
import { sanitizeFileName } from './sanitize';
import type { MtgCardPrimersSettings } from './settings';

export const DEFAULT_TEMPLATE = `\`\`\`mtg-card
\`\`\`

## Summary

## How to play

## Synergies

## Pitfalls / interactions

## Decks I use it in
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
	if (!settings.templatePath) return DEFAULT_TEMPLATE;
	let path = normalizePath(settings.templatePath);
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
		.replace(/\{\{\s*oracle_id\s*\}\}/g, () => card.oracleId);
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
function freePath(app: App, folder: string, card: CardInfo): string {
	const base = sanitizeFileName(card.frontName);
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
