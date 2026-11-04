import { App, Modal, Setting, SuggestModal } from 'obsidian';
import type { ScryfallCard } from './card';
import { RARITY_NAMES, setSymbolValue } from './insert';
import { appendSetSymbol } from './mana';
import { languageName } from './localized';
import { looksLikeMoxfieldLine, parseMoxfieldLine, type CardQuery } from './moxfield';
import type { ScryfallClient } from './scryfall';

interface Suggestion {
	query: CardQuery;
	label: string;
	hint?: string;
}

const DEBOUNCE_MS = 250;
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/**
 * Card picker: Scryfall autocomplete, plus the typed text itself as the first
 * option so a pasted Moxfield line ("1 Sol Ring (C21) 263 *F*") can be used as-is.
 */
export class CardSuggestModal extends SuggestModal<Suggestion> {
	private latestQuery = '';

	constructor(
		app: App,
		private scryfall: ScryfallClient,
		private onPick: (query: CardQuery) => void,
		placeholder: string,
	) {
		super(app);
		this.setPlaceholder(placeholder);
		this.emptyStateText = 'Type a card name (in any language) or paste a Moxfield line.';
		this.limit = 30;
	}

	async getSuggestions(input: string): Promise<Suggestion[]> {
		this.latestQuery = input;
		const parsed = parseMoxfieldLine(input);
		if (!parsed) return [];

		const typed: Suggestion = looksLikeMoxfieldLine(input)
			? {
					query: parsed,
					label: parsed.name,
					hint: parsed.collectorNumber
						? `Moxfield line · ${parsed.set?.toUpperCase()} #${parsed.collectorNumber}`
						: parsed.set
							? `Moxfield line · ${parsed.set.toUpperCase()}`
							: 'Moxfield line',
				}
			: { query: parsed, label: parsed.name, hint: 'Search this name' };

		// Only autocomplete plain names; a pasted line already identifies the card.
		if (looksLikeMoxfieldLine(input)) return [typed];

		await sleep(DEBOUNCE_MS);
		if (input !== this.latestQuery) return [typed];

		let names: string[] = [];
		try {
			names = await this.scryfall.autocomplete(parsed.name);
		} catch {
			// Offline or rate-limited: the typed text is still usable.
		}
		const rest: Suggestion[] = names
			.filter((n) => n.toLowerCase() !== parsed.name.toLowerCase())
			.map((n) => ({ query: { name: n }, label: n }));
		const exact = names.find((n) => n.toLowerCase() === parsed.name.toLowerCase());

		// Names in other languages ("Anel Solar", "Sonnenring"): shown with the English name and language as the hint.
		let translated: Suggestion[] = [];
		if (parsed.name.length >= 2 && input === this.latestQuery) {
			try {
				const english = new Set([...names, exact].filter(Boolean).map((n) => n!.toLowerCase()));
				translated = (await this.scryfall.searchPrintedNames(parsed.name))
					.filter((m) => !english.has(m.name.toLowerCase()))
					.map((m) => ({ query: { name: m.name }, label: m.printedName, hint: `${m.name} · ${languageName(m.lang)}` }));
			} catch {
				// Offline or rate-limited: English results are still usable.
			}
		}

		const first = exact ? { query: { name: exact }, label: exact } : typed;
		// When the English autocomplete finds nothing, the text is probably another language: list those first.
		return names.length === 0 ? [...translated, typed] : [first, ...rest, ...translated];
	}

	renderSuggestion(s: Suggestion, el: HTMLElement): void {
		el.createDiv({ text: s.label });
		if (s.hint) el.createEl('small', { text: s.hint, cls: 'mtg-suggest-hint' });
	}

	onChooseSuggestion(s: Suggestion): void {
		this.onPick(s.query);
	}
}

/**
 * Edition picker: every printing of a card, with thumbnail, set symbol, number and year.
 * Filters as you type (set name, set code, collector number or year).
 */
export class PrintSuggestModal extends SuggestModal<ScryfallCard> {
	constructor(
		app: App,
		private prints: ScryfallCard[],
		private onPick: (print: ScryfallCard) => void,
	) {
		super(app);
		this.setPlaceholder(`${prints[0]?.name ?? 'Card'}: choose the edition (filter by set, code, number or year)`);
		this.emptyStateText = 'No edition found.';
		this.limit = 200;
	}

	getSuggestions(input: string): ScryfallCard[] {
		const words = input.toLowerCase().split(/\s+/).filter(Boolean);
		if (words.length === 0) return this.prints;
		return this.prints.filter((p) => {
			const haystack = [p.set_name, p.set, `#${p.collector_number}`, p.collector_number, p.released_at?.slice(0, 4)]
				.join(' ')
				.toLowerCase();
			return words.every((w) => haystack.includes(w));
		});
	}

	renderSuggestion(p: ScryfallCard, el: HTMLElement): void {
		el.addClass('mtg-print-suggestion');
		const thumb = p.image_uris?.small ?? p.card_faces?.[0]?.image_uris?.small;
		if (thumb) el.createEl('img', { cls: 'mtg-print-thumb', attr: { src: thumb, alt: '', loading: 'lazy' } });
		const text = el.createDiv({ cls: 'mtg-print-text' });
		const title = text.createDiv();
		appendSetSymbol(title, setSymbolValue(p));
		title.appendText(` ${p.set_name ?? p.set.toUpperCase()}`);
		const rarity = RARITY_NAMES[setSymbolValue(p).split(':')[1] ?? ''];
		const details = [`${p.set.toUpperCase()} #${p.collector_number}`, p.released_at?.slice(0, 4), rarity, finishesLabel(p.finishes)];
		text.createEl('small', { text: details.filter(Boolean).join(' · '), cls: 'mtg-suggest-hint' });
	}

	onChooseSuggestion(p: ScryfallCard): void {
		this.onPick(p);
	}
}

/** "foil", "foil only", "etched"…: which special finishes this printing exists in (nothing for non-foil only). */
function finishesLabel(finishes: string[] | undefined): string | undefined {
	const special = (finishes ?? []).filter((f) => f !== 'nonfoil');
	if (special.length === 0) return undefined;
	const label = special.join(' + ');
	return finishes?.includes('nonfoil') ? label : `${label} only`;
}

/** Yes/no prompt. Resolves true only when the user confirms. */
export function confirm(app: App, title: string, message: string, cta: string): Promise<boolean> {
	return new Promise((resolve) => {
		let answered = false;
		const modal = new Modal(app);
		modal.titleEl.setText(title);
		modal.contentEl.createEl('p', { text: message });
		new Setting(modal.contentEl)
			.addButton((b) =>
				b.setButtonText('Cancel').onClick(() => {
					modal.close();
				}),
			)
			.addButton((b) =>
				b
					.setButtonText(cta)
					.setCta()
					.onClick(() => {
						answered = true;
						modal.close();
					}),
			);
		modal.onClose = () => resolve(answered);
		modal.open();
	});
}
