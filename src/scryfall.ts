import { requestUrl } from 'obsidian';
import { printedName, type ScryfallCard } from './card';
import { bestPrintedMatches, printedNameQuery, type NamedPrint } from './localized';
import type { CardQuery } from './moxfield';

const API = 'https://api.scryfall.com';

// https://scryfall.com/docs/api/rate-limits
const DELAY_SLOW = 500; // /cards/named, /cards/search: 2/s
const DELAY_FAST = 100; // all other endpoints: 10/s
const PAUSE_AFTER_429 = 30_000;

export class ScryfallError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = 'ScryfallError';
	}
}

interface ScryfallList<T> {
	object: 'list' | 'catalog';
	data: T[];
	has_more?: boolean;
}

interface ScryfallSet {
	code: string;
	name: string;
	icon_svg_uri: string;
}

/** What the set symbol renderer needs. */
export interface SetInfo {
	code: string;
	name: string;
	iconUrl: string;
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/**
 * Scryfall client: one serial queue honouring per-endpoint rate limits,
 * required headers, and an in-memory cache for the session.
 */
export class ScryfallClient {
	private queue: Promise<unknown> = Promise.resolve();
	private nextAllowedAt = 0;
	private cache = new Map<string, Promise<unknown>>();
	private setsByCode: Promise<Map<string, SetInfo>> | null = null;
	private readonly headers: Record<string, string>;

	constructor(version: string) {
		this.headers = {
			'User-Agent': `MtgCardPrimers/${version}`,
			Accept: 'application/json',
		};
	}

	autocomplete(q: string): Promise<string[]> {
		if (q.trim().length < 2) return Promise.resolve([]);
		return this.get<ScryfallList<string>>('/cards/autocomplete', { q }, DELAY_FAST).then((c) => c.data);
	}

	cardById(id: string): Promise<ScryfallCard> {
		return this.get<ScryfallCard>(`/cards/${encodeURIComponent(id)}`, {}, DELAY_FAST);
	}

	cardBySetNumber(set: string, number: string): Promise<ScryfallCard> {
		const path = `/cards/${encodeURIComponent(set)}/${encodeURIComponent(number)}`;
		return this.get<ScryfallCard>(path, {}, DELAY_FAST);
	}

	cardNamed(fuzzy: string, set?: string): Promise<ScryfallCard> {
		const params: Record<string, string> = { fuzzy };
		if (set) params.set = set;
		return this.get<ScryfallCard>('/cards/named', params, DELAY_SLOW);
	}

	/** Exact English name (any face name works). 404 when it is not a card. */
	cardExact(name: string, set?: string): Promise<ScryfallCard> {
		const params: Record<string, string> = { exact: name };
		if (set) params.set = set;
		return this.get<ScryfallCard>('/cards/named', params, DELAY_SLOW);
	}

	/**
	 * Cards whose printed name in any language contains every typed word
	 * ("anel sol" → Anel Solar, "sonnen" → Sonnenring; one result per card, in the language that matches best).
	 * Scryfall does not ignore accents here, so "laboratorio" won't find "Laboratório".
	 */
	async searchPrintedNames(input: string): Promise<NamedPrint[]> {
		const q = printedNameQuery(input);
		if (!q) return [];
		try {
			// unique=prints: one printing per card could be in a language that doesn't match the input.
			const list = await this.get<ScryfallList<ScryfallCard>>(
				'/cards/search',
				{ q, unique: 'prints', order: 'name' },
				DELAY_SLOW,
			);
			const prints: NamedPrint[] = [];
			for (const card of list.data) {
				const printed = printedName(card);
				if (printed) prints.push({ name: card.name, printedName: printed, lang: card.lang ?? '' });
			}
			return bestPrintedMatches(prints, input);
		} catch (e) {
			if (e instanceof ScryfallError && e.status === 404) return [];
			throw e;
		}
	}

	/** Card by its exact printed name in any language ("Anel Solar", "Sonnenring"), as the English printing. 404 when none. */
	async cardByPrintedName(name: string): Promise<ScryfallCard> {
		const list = await this.get<ScryfallList<ScryfallCard>>(
			'/cards/search',
			{ q: `lang:any !"${name.replace(/"/g, '')}"`, unique: 'cards' },
			DELAY_SLOW,
		);
		const card = list.data[0];
		if (!card) throw new ScryfallError(`No card named "${name}".`, 404);
		return this.englishPrint(card);
	}

	/**
	 * Fuzzy name search matches names in any language and then returns that language's printing
	 * ("anel solar" → the Portuguese Sol Ring). Swap it for the English printing of the same set
	 * so primers, images and links stay consistent; any English printing if that set has none.
	 */
	async englishPrint(card: ScryfallCard): Promise<ScryfallCard> {
		if (!card.lang || card.lang === 'en') return card;
		try {
			return await this.cardExact(card.name, card.set);
		} catch (e) {
			if (!(e instanceof ScryfallError && e.status === 404)) throw e;
		}
		try {
			return await this.cardExact(card.name);
		} catch (e) {
			if (e instanceof ScryfallError && e.status === 404) return card;
			throw e;
		}
	}

	/** Most recent paper printing of an oracle card, or null when none exists. */
	async latestPaperPrint(oracleId: string): Promise<ScryfallCard | null> {
		try {
			const list = await this.get<ScryfallList<ScryfallCard>>(
				'/cards/search',
				{ q: `oracleid:${oracleId} game:paper`, order: 'released', dir: 'desc', unique: 'prints' },
				DELAY_SLOW,
			);
			return list.data[0] ?? null;
		} catch (e) {
			if (e instanceof ScryfallError && e.status === 404) return null;
			throw e;
		}
	}

	/**
	 * Every printing of an oracle card, newest first (first page only: up to 175 prints).
	 * Includes promos and digital prints, so the user can pick any edition.
	 */
	async prints(oracleId: string): Promise<ScryfallCard[]> {
		try {
			const list = await this.get<ScryfallList<ScryfallCard>>(
				'/cards/search',
				{ q: `oracleid:${oracleId}`, order: 'released', dir: 'desc', unique: 'prints', include_extras: 'true' },
				DELAY_SLOW,
			);
			return list.data;
		} catch (e) {
			if (e instanceof ScryfallError && e.status === 404) return [];
			throw e;
		}
	}

	/**
	 * Set name and icon by set code. Loads the whole set list once per session (one request),
	 * because many sets reuse another set's icon file (tdsc → dsc.svg, sld → star.svg).
	 */
	async setInfo(code: string): Promise<SetInfo | null> {
		this.setsByCode ??= this.get<ScryfallList<ScryfallSet>>('/sets', {}, DELAY_FAST).then(
			(list) => new Map(list.data.map((s) => [s.code, { code: s.code, name: s.name, iconUrl: s.icon_svg_uri }])),
		);
		try {
			return (await this.setsByCode).get(code.toLowerCase()) ?? null;
		} catch (e) {
			this.setsByCode = null; // retry next time (e.g. back online)
			throw e;
		}
	}

	/**
	 * Resolves a parsed Moxfield line to a card.
	 * Set + number → exact printing (falls back to the name if that printing is not found).
	 * Otherwise → fuzzy name search (name in any language), limited to the set when one was given.
	 * Always returns an English printing when one exists.
	 */
	async resolve(query: CardQuery): Promise<ScryfallCard> {
		if (query.set && query.collectorNumber) {
			try {
				return await this.englishPrint(await this.cardBySetNumber(query.set, query.collectorNumber));
			} catch (e) {
				if (!(e instanceof ScryfallError && e.status === 404)) throw e;
			}
		}
		return this.englishPrint(await this.cardNamed(query.name, query.set));
	}

	private get<T>(path: string, params: Record<string, string>, delay: number): Promise<T> {
		const qs = new URLSearchParams(params).toString();
		const url = `${API}${path}${qs ? `?${qs}` : ''}`;

		const cached = this.cache.get(url);
		if (cached) return cached as Promise<T>;

		const result = this.enqueue(() => this.fetch<T>(url), delay);
		this.cache.set(url, result);
		// Keep "not found" answers; drop other failures so the next attempt (e.g. back online) retries.
		result.catch((e: unknown) => {
			if (!(e instanceof ScryfallError && e.status === 404)) this.cache.delete(url);
		});
		return result;
	}

	private enqueue<T>(task: () => Promise<T>, delay: number): Promise<T> {
		const run = this.queue.then(async () => {
			const wait = this.nextAllowedAt - Date.now();
			if (wait > 0) await sleep(wait);
			try {
				return await task();
			} finally {
				this.nextAllowedAt = Math.max(this.nextAllowedAt, Date.now() + delay);
			}
		});
		this.queue = run.catch(() => undefined);
		return run;
	}

	private async fetch<T>(url: string): Promise<T> {
		let res;
		try {
			res = await requestUrl({ url, method: 'GET', headers: this.headers, throw: false });
		} catch (e) {
			throw new ScryfallError(`Cannot reach Scryfall (${e instanceof Error ? e.message : String(e)}).`, 0);
		}

		if (res.status === 429) {
			this.nextAllowedAt = Date.now() + PAUSE_AFTER_429;
			throw new ScryfallError('Scryfall asked us to slow down (HTTP 429). Pausing for 30 s.', 429);
		}
		if (res.status >= 400) {
			let details = `HTTP ${res.status}`;
			try {
				const body = res.json as { details?: string };
				if (body?.details) details = body.details;
			} catch {
				// non-JSON error body
			}
			throw new ScryfallError(details, res.status);
		}
		return res.json as T;
	}
}
