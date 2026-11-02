import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ScryfallCard } from '../src/card.ts';
import { cardImageMarkdown, cardTextMarkdown, setSymbolToken } from '../src/insert.ts';

const base = { object: 'card', id: 'id', set: 'dsc', collector_number: '220', color_identity: [], scryfall_uri: '' } as const;

const grist: ScryfallCard = {
	...base,
	name: 'Grist, the Hunger Tide',
	layout: 'normal',
	rarity: 'mythic',
	mana_cost: '{1}{B}{G}',
	type_line: 'Legendary Planeswalker — Grist',
	oracle_text: 'As long as Grist isn\'t on the battlefield, it\'s a 1/1 Insect creature.\n+1: Create a 1/1 Insect.\n−2: You may sacrifice a creature.\n−5: Each opponent loses life.',
	loyalty: '3',
	image_uris: { normal: 'https://img/normal.jpg', art_crop: 'https://img/art.jpg' },
};

test('text: blockquote with name, cost, type, loyalty symbols and stats', () => {
	assert.equal(
		cardTextMarkdown(grist),
		[
			'> **Grist, the Hunger Tide** {1}{B}{G}',
			'> Legendary Planeswalker — Grist',
			'>',
			"> As long as Grist isn't on the battlefield, it's a 1/1 Insect creature.",
			'>',
			'> [+1]: Create a 1/1 Insect.',
			'>',
			'> [−2]: You may sacrifice a creature.',
			'>',
			'> [−5]: Each opponent loses life.',
			'>',
			'> Loyalty: **3**',
		].join('\n'),
	);
});

test('text: level bands and power/toughness', () => {
	const joraga: ScryfallCard = {
		...base,
		name: 'Joraga Treespeaker',
		layout: 'leveler',
		mana_cost: '{G}',
		type_line: 'Creature — Elf Druid',
		oracle_text: 'Level up {1}{G}\nLEVEL 1-4\n1/2\n{T}: Add {G}{G}.',
		power: '1',
		toughness: '1',
	};
	const md = cardTextMarkdown(joraga);
	assert.match(md, /^> \[LEVEL 1-4\]$/m);
	assert.ok(md.indexOf('**1/1**') < md.indexOf('[LEVEL 1-4]'), 'base stats come before the first level band');
});

test('text: one blockquote per face', () => {
	const delver: ScryfallCard = {
		...base,
		name: 'Delver of Secrets // Insectile Aberration',
		layout: 'transform',
		card_faces: [
			{ name: 'Delver of Secrets', mana_cost: '{U}', type_line: 'Creature — Human Wizard', oracle_text: 'Transform it.', power: '1', toughness: '1' },
			{ name: 'Insectile Aberration', mana_cost: '', type_line: 'Creature — Human Insect', oracle_text: 'Flying', power: '3', toughness: '2' },
		],
	};
	const quotes = cardTextMarkdown(delver).split('\n\n');
	assert.equal(quotes.length, 2);
	assert.ok(quotes[0]!.startsWith('> **Delver of Secrets** {U}'));
	assert.ok(quotes[1]!.startsWith('> **Insectile Aberration**\n'));
});

test('image: full card at 250px, art crop full width', () => {
	assert.equal(cardImageMarkdown(grist, 'card'), '![Grist, the Hunger Tide · DSC #220|250](https://img/normal.jpg)');
	assert.equal(cardImageMarkdown(grist, 'art'), '![Grist, the Hunger Tide · DSC #220](https://img/art.jpg)');
});

test('image: double-faced card gives one image per face', () => {
	const card: ScryfallCard = {
		...base,
		name: 'A // B',
		layout: 'transform',
		card_faces: [
			{ name: 'A', image_uris: { normal: 'https://a.jpg', art_crop: 'https://a-art.jpg' } },
			{ name: 'B', image_uris: { normal: 'https://b.jpg', art_crop: 'https://b-art.jpg' } },
		],
	};
	assert.equal(cardImageMarkdown(card, 'card'), '![A · DSC #220|250](https://a.jpg) ![B · DSC #220|250](https://b.jpg)');
	assert.equal(cardImageMarkdown(card, 'art'), '![A · DSC #220](https://a-art.jpg)\n\n![B · DSC #220](https://b-art.jpg)');
});

test('set symbol token carries the rarity', () => {
	assert.equal(setSymbolToken({ set: 'DSC', rarity: 'mythic' }), '{set:dsc:m}');
	assert.equal(setSymbolToken({ set: 'c21', rarity: 'uncommon' }), '{set:c21:u}');
	assert.equal(setSymbolToken({ set: 'lea' }), '{set:lea}');
});
