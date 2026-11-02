import { Editor, Notice, Plugin, TFile } from 'obsidian';
import { toCardInfo, type CardInfo, type ScryfallCard } from './card';
import { renderCardBlock } from './codeblock';
import { CardHoverPopup } from './hover';
import { cardImageMarkdown, cardTextMarkdown, setSymbolToken } from './insert';
import { configureSetLookup, replaceManaInElement } from './mana';
import { manaLivePreview } from './mana-editor';
import { CardSuggestModal, confirm, PrintSuggestModal } from './modal';
import type { CardQuery } from './moxfield';
import { createPrimer, findPrimerByOracleId } from './primers';
import { ScryfallClient } from './scryfall';
import { DEFAULT_SETTINGS, MtgCardPrimersSettings, MtgCardPrimersSettingTab } from './settings';

export default class MtgCardPrimersPlugin extends Plugin {
	settings!: MtgCardPrimersSettings;
	scryfall!: ScryfallClient;

	async onload() {
		await this.loadSettings();
		this.scryfall = new ScryfallClient(this.manifest.version);

		this.addCommand({
			id: 'new-card-primer',
			name: 'New card primer',
			callback: () => this.pickCard('New card: name or Moxfield line', (q) => this.openOrCreate(q, false)),
		});

		this.addCommand({
			id: 'open-card-primer',
			name: 'Open card primer',
			callback: () => this.pickCard('Open card: name or Moxfield line', (q) => this.openOrCreate(q, true)),
		});

		this.addCommand({
			id: 'insert-card-text',
			name: 'Insert card text',
			editorCallback: (editor) =>
				this.pickCard('Card text: name or Moxfield line', async (q) => {
					const card = await this.scryfall.resolve(q);
					insertBlock(editor, cardTextMarkdown(card));
				}),
		});

		this.addCommand({
			id: 'insert-card-art',
			name: 'Insert card art (illustration only)',
			editorCallback: (editor) =>
				this.pickPrint('Card art: name or Moxfield line', (print) => {
					insertBlock(editor, requireMarkdown(cardImageMarkdown(print, 'art')));
				}),
		});

		this.addCommand({
			id: 'insert-card-image',
			name: 'Insert full card image (choose edition)',
			editorCallback: (editor) =>
				this.pickPrint('Card image: name or Moxfield line', (print) => {
					editor.replaceSelection(requireMarkdown(cardImageMarkdown(print, 'card')));
				}),
		});

		this.addCommand({
			id: 'insert-set-symbol',
			name: 'Insert set symbol',
			editorCallback: (editor) =>
				this.pickPrint('Set symbol: name or Moxfield line', (print) => {
					editor.replaceSelection(setSymbolToken(print));
				}),
		});

		configureSetLookup((code) => this.scryfall.setInfo(code));

		this.registerMarkdownCodeBlockProcessor('mtg-card', (source, el, ctx) =>
			renderCardBlock(this, source, el, ctx),
		);

		new CardHoverPopup(this).register();

		this.registerMarkdownPostProcessor((el) => {
			if (this.settings.manaSymbols) replaceManaInElement(el);
		});
		this.registerEditorExtension(manaLivePreview(() => this.settings.manaSymbols));

		this.addSettingTab(new MtgCardPrimersSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<MtgCardPrimersSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private pickCard(placeholder: string, onPick: (q: CardQuery) => Promise<void>) {
		new CardSuggestModal(this.app, this.scryfall, (q) => void onPick(q).catch(showError), placeholder).open();
	}

	/**
	 * Card, then edition. A Moxfield line with a set ("Sol Ring (C21) 263") already names the edition,
	 * so the edition list is skipped. Otherwise the list starts with the default print (see settings).
	 */
	private pickPrint(placeholder: string, onPick: (print: ScryfallCard) => void) {
		this.pickCard(placeholder, async (q) => {
			if (q.set) return onPick(await this.scryfall.resolve(q));
			const chosen = await this.resolveScryfallCard(q);

			const notice = new Notice('Fetching editions…', 0);
			let prints: ScryfallCard[];
			try {
				prints = await this.scryfall.prints(toCardInfo(chosen).oracleId);
			} finally {
				notice.hide();
			}
			const list = [chosen, ...prints.filter((p) => p.id !== chosen.id)];
			if (list.length === 1) return onPick(chosen);
			new PrintSuggestModal(this.app, list, (p) => {
				try {
					onPick(p);
				} catch (e) {
					showError(e);
				}
			}).open();
		});
	}

	/** Opens the existing primer for the card, or creates one (asking first when askBeforeCreate). */
	private async openOrCreate(query: CardQuery, askBeforeCreate: boolean): Promise<void> {
		const card = await this.resolveCard(query);

		const existing = findPrimerByOracleId(this.app, card.oracleId);
		if (existing) {
			if (!askBeforeCreate) new Notice(`A primer for ${card.name} already exists. Opening it.`);
			await this.openFile(existing);
			return;
		}

		if (askBeforeCreate) {
			const ok = await confirm(
				this.app,
				'Primer not found',
				`There is no primer for "${card.name}" yet. Create it now?`,
				'Create primer',
			);
			if (!ok) return;
		}

		const file = await createPrimer(this.app, this.settings, card);
		new Notice(`Primer created: ${file.basename}`);
		await this.openFile(file);
	}

	private async resolveCard(query: CardQuery): Promise<CardInfo> {
		return toCardInfo(await this.resolveScryfallCard(query));
	}

	/** The card the user asked for, in the preferred print (see settings). */
	private async resolveScryfallCard(query: CardQuery): Promise<ScryfallCard> {
		const card = await this.scryfall.resolve(query);
		if (this.settings.preferredPrint === 'latest') {
			return (await this.scryfall.latestPaperPrint(toCardInfo(card).oracleId)) ?? card;
		}
		return card;
	}

	private async openFile(file: TFile) {
		await this.app.workspace.getLeaf(false).openFile(file);
	}
}

function showError(e: unknown): void {
	console.error('[mtg-card-primers]', e);
	new Notice(`MTG Card Primers: ${e instanceof Error ? e.message : String(e)}`);
}

/**
 * Inserts Markdown as its own block, separated by blank lines from the text around it.
 * Without the blank line after, text that follows a blockquote would be pulled into it.
 */
function insertBlock(editor: Editor, markdown: string): void {
	const from = editor.getCursor('from');
	const to = editor.getCursor('to');
	const before = editor.getLine(from.line).slice(0, from.ch);
	const after = editor.getLine(to.line).slice(to.ch);
	const prevLine = from.line > 0 ? editor.getLine(from.line - 1) : '';
	const nextLine = to.line + 1 < editor.lineCount() ? editor.getLine(to.line + 1) : '';
	const prefix = before.trim() !== '' ? '\n\n' : prevLine.trim() !== '' ? '\n' : '';
	const suffix = after.trim() !== '' ? '\n\n' : nextLine.trim() !== '' ? '\n' : '';
	editor.replaceSelection(`${prefix}${markdown}${suffix}`);
}

/** Card images are missing for a few cards (some digital-only printings). */
function requireMarkdown(markdown: string): string {
	if (!markdown) throw new Error('Scryfall has no image for this printing.');
	return markdown;
}
