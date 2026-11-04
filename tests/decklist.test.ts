import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canBeCommander, groupDeck, lineFinish, manaCurve, parseDecklist, primerDecklist, sectionName, setDeckOption, setViewOption, typeGroup, withPrinting, type TypeGroup } from '../src/decklist.ts';

test('Moxfield export with sections and options', () => {
	const deck = parseDecklist(`title: Hunger Tide
view: images

Commander
1 Grist, the Hunger Tide (DSC) 220

Deck
1 Sol Ring (C21) 263 *F*
4 Forest
1x Swamp #land

Sideboard
2 Duress`);
	assert.equal(deck.title, 'Hunger Tide');
	assert.equal(deck.view, 'images');
	assert.deepEqual(
		deck.sections.map((s) => [s.name, s.entries.map((e) => [e.quantity, e.query.name])]),
		[
			['Commander', [[1, 'Grist, the Hunger Tide']]],
			['Deck', [[1, 'Sol Ring'], [4, 'Forest'], [1, 'Swamp']]],
			['Sideboard', [[2, 'Duress']]],
		],
	);
	assert.deepEqual(deck.sections[1]!.entries[0]!.query, { name: 'Sol Ring', set: 'c21', collectorNumber: '263' });
});

test('header-less list: everything is the deck; blank line starts the sideboard (MTGA)', () => {
	const deck = parseDecklist('4 Lightning Bolt\n20 Mountain\n\n2 Smash to Smithereens');
	assert.deepEqual(
		deck.sections.map((s) => [s.name, s.entries.length]),
		[
			['Deck', 2],
			['Sideboard', 1],
		],
	);
});

test('blank lines inside a section with headers stay in that section', () => {
	const deck = parseDecklist('Deck\n1 Sol Ring\n\n1 Arcane Signet');
	assert.deepEqual(deck.sections.map((s) => [s.name, s.entries.length]), [['Deck', 2]]);
});

test('repeated lines add up; comments and junk are ignored', () => {
	const deck = parseDecklist('// my list\n2 Forest\n1 Forest\n\n#notes');
	assert.deepEqual(deck.sections[0]!.entries.map((e) => [e.quantity, e.query.name]), [[3, 'Forest']]);
});

test('section header spellings', () => {
	assert.equal(sectionName('SIDEBOARD:'), 'Sideboard');
	assert.equal(sectionName('// Sideboard'), 'Sideboard');
	assert.equal(sectionName('Mainboard (99)'), 'Deck');
	assert.equal(sectionName('Commanders'), 'Commander');
	assert.equal(sectionName('Sol Ring'), null);
});

test('type groups', () => {
	assert.equal(typeGroup('Artifact Creature — Golem'), 'Creature');
	assert.equal(typeGroup('Legendary Planeswalker — Grist'), 'Planeswalker');
	assert.equal(typeGroup('Land Creature — Forest Dryad'), 'Creature');
	assert.equal(typeGroup('Kindred Instant — Elf'), 'Instant');
	assert.equal(typeGroup('Basic Land — Forest'), 'Land');
	assert.equal(typeGroup('Sorcery // Land'), 'Sorcery');
	assert.equal(typeGroup('Legendary Enchantment Artifact'), 'Artifact');
	assert.equal(typeGroup('Conspiracy'), 'Other');
});

test('mana curve skips lands and caps at 7+', () => {
	const curve = manaCurve([
		{ quantity: 1, manaValue: 1, group: 'Artifact' },
		{ quantity: 4, manaValue: 3, group: 'Creature' },
		{ quantity: 1, manaValue: 9, group: 'Sorcery' },
		{ quantity: 30, manaValue: 0, group: 'Land' },
	]);
	assert.deepEqual(curve, [0, 1, 0, 4, 0, 0, 0, 1]);
});

test('setViewOption replaces, or inserts after the title', () => {
	assert.equal(setViewOption('view: text\n1 Sol Ring', 'images'), 'view: images\n1 Sol Ring');
	assert.equal(setViewOption('title: X\nview: images\nDeck\n1 Sol Ring', 'text'), 'title: X\nview: text\nDeck\n1 Sol Ring');
	assert.equal(setViewOption('title: X\n\nCommander\n1 Grist', 'images'), 'title: X\nview: images\n\nCommander\n1 Grist');
	assert.equal(setViewOption('1 Sol Ring\n1 Arcane Signet', 'images'), 'view: images\n1 Sol Ring\n1 Arcane Signet');
	assert.equal(setViewOption('View:Text\r\n1 Sol Ring', 'images'), 'View:images\r\n1 Sol Ring');
	// a "view:" after the first card is a card line, not an option
	assert.equal(setViewOption('1 Sol Ring\nview: text', 'images'), 'view: images\n1 Sol Ring\nview: text');
	assert.equal(parseDecklist(setViewOption('Deck\n1 Sol Ring', 'images')).view, 'images');
});

test('withPrinting sets the edition and keeps quantity, name and markers', () => {
	assert.equal(withPrinting('1 Sol Ring', 'c21', '263'), '1 Sol Ring (C21) 263');
	assert.equal(withPrinting('1 Sol Ring *F*', 'c21', '263'), '1 Sol Ring (C21) 263 *F*');
	assert.equal(withPrinting('1x Sol Ring (LCC) 1 #Ramp', 'c21', '263'), '1x Sol Ring (C21) 263 #Ramp');
	assert.equal(withPrinting('1 Sol Ring (LCC) *F* #!Ramp', 'c21', '263'), '1 Sol Ring (C21) 263 *F* #!Ramp');
	assert.equal(withPrinting('8 Forest (MDD) 34a', 'sld', '1520★'), '8 Forest (SLD) 1520★');
	assert.equal(withPrinting('1 Bala Ged Recovery // Bala Ged Sanctuary', 'znr', '180'), '1 Bala Ged Recovery // Bala Ged Sanctuary (ZNR) 180');
	// the result parses back to that exact printing
	const deck = parseDecklist(withPrinting('1 Anel Solar *F*', 'c21', '263'));
	assert.deepEqual(deck.sections[0]!.entries[0]!.query, { name: 'Anel Solar', set: 'c21', collectorNumber: '263' });
});

test('view option accepts grid', () => {
	assert.equal(parseDecklist('view: grid\n1 Sol Ring').view, 'grid');
	assert.equal(setViewOption('view: images\n1 Sol Ring', 'grid'), 'view: grid\n1 Sol Ring');
});

test('foil and etched markers', () => {
	assert.equal(lineFinish('1 Sol Ring (C21) 263 *F*'), 'foil');
	assert.equal(lineFinish('1 Sol Ring *f* #Ramp'), 'foil');
	assert.equal(lineFinish('1 Sol Ring (CMM) 400 *E*'), 'etched');
	assert.equal(lineFinish('1 Sol Ring'), undefined);
	assert.equal(lineFinish('1 Grist *CMDR*'), undefined);
	// the same card in foil and non-foil stays on two lines
	const deck = parseDecklist('1 Sol Ring *F*\n1 Sol Ring\n1 Sol Ring *F*');
	assert.deepEqual(deck.sections[0]!.entries.map((e) => [e.quantity, e.finish]), [
		[2, 'foil'],
		[1, undefined],
	]);
});

const card = (name: string, manaValue: number, group: TypeGroup, colors: string[] = []) => ({ name, manaValue, group, colors });
const pool = [
	card('Llanowar Elves', 1, 'Creature', ['G']),
	card('Sol Ring', 1, 'Artifact'),
	card('Grave Titan', 6, 'Creature', ['B']),
	card('Forest', 0, 'Land'),
	card('Assassin\'s Trophy', 2, 'Instant', ['B', 'G']),
	card('Emrakul, the Aeons Torn', 15, 'Creature'),
	card('Swords to Plowshares', 1, 'Instant', ['W']),
];
const labels = (sort: 'type' | 'name' | 'cmc' | 'color') =>
	groupDeck(pool, sort).map((g) => `${g.label}: ${g.cards.map((c) => c.name).join(', ')}`);

test('group by type (default): type order, mana value inside', () => {
	assert.deepEqual(labels('type'), [
		'Creatures: Llanowar Elves, Grave Titan, Emrakul, the Aeons Torn',
		"Instants: Swords to Plowshares, Assassin's Trophy",
		'Artifacts: Sol Ring',
		'Lands: Forest',
	]);
});

test('group by name: one A–Z list', () => {
	assert.deepEqual(labels('name'), [
		"Cards (A–Z): Assassin's Trophy, Emrakul, the Aeons Torn, Forest, Grave Titan, Llanowar Elves, Sol Ring, Swords to Plowshares",
	]);
});

test('group by mana value: buckets, 7+, lands last', () => {
	assert.deepEqual(labels('cmc'), [
		'Mana value 1: Llanowar Elves, Sol Ring, Swords to Plowshares',
		"Mana value 2: Assassin's Trophy",
		'Mana value 6: Grave Titan',
		'Mana value 7+: Emrakul, the Aeons Torn',
		'Lands: Forest',
	]);
});

test('group by colour: WUBRG, multicolor, colorless, lands', () => {
	assert.deepEqual(labels('color'), [
		'White: Swords to Plowshares',
		'Black: Grave Titan',
		'Green: Llanowar Elves',
		"Multicolor: Assassin's Trophy",
		'Colorless: Sol Ring, Emrakul, the Aeons Torn',
		'Lands: Forest',
	]);
});

test('sort option is parsed and written', () => {
	assert.equal(parseDecklist('sort: Mana value\n1 Sol Ring').sort, 'cmc');
	assert.equal(parseDecklist('sort: colour\n1 Sol Ring').sort, 'color');
	assert.equal(parseDecklist('sort: banana\n1 Sol Ring').sort, undefined);
	assert.equal(setDeckOption('view: grid\n1 Sol Ring', 'sort', 'name'), 'view: grid\nsort: name\n1 Sol Ring');
	assert.equal(setDeckOption('sort: name\nview: grid\n1 Sol Ring', 'sort', 'cmc'), 'sort: cmc\nview: grid\n1 Sol Ring');
});

test('cards after a blank line under Commander are the deck (no "Deck" header)', () => {
	const deck = parseDecklist('Commander\nGrist, The Hunder Tide\n\n1 Abrupt Decay (RTR) 141\n1 Sol Ring\n\nSideboard\n1 Duress');
	assert.deepEqual(
		deck.sections.map((s) => [s.name, s.entries.map((e) => e.query.name)]),
		[
			['Commander', ['Grist, The Hunder Tide']],
			['Deck', ['Abrupt Decay', 'Sol Ring']],
			['Sideboard', ['Duress']],
		],
	);
	// partners listed together stay in Commander
	const partners = parseDecklist('Commander\n1 Tymna the Weaver\n1 Thrasios, Triton Hero\n\n1 Sol Ring');
	assert.deepEqual(partners.sections.map((s) => [s.name, s.entries.length]), [['Commander', 2], ['Deck', 1]]);
});

test('primer decklist: commander or deck card', () => {
	const grist = primerDecklist({
		name: 'Grist, the Hunger Tide',
		typeLine: 'Legendary Planeswalker — Grist',
		oracleText: 'As long as Grist, the Hunger Tide isn\'t on the battlefield, it\'s a 1/1 Insect creature in addition to its other types.\nGrist, the Hunger Tide can be your commander.',
		set: 'mh2',
		collectorNumber: '202',
	});
	assert.equal(grist, '```mtg-deck\nCommander\n1 Grist, the Hunger Tide (MH2) 202\n\nDeck\n```');
	assert.equal(parseDecklist(grist.split('\n').slice(1, -1).join('\n')).sections[0]!.name, 'Commander');

	const bolt = primerDecklist({ name: 'Lightning Bolt', typeLine: 'Instant', oracleText: '', set: 'lea', collectorNumber: '161' });
	assert.equal(bolt, '```mtg-deck\nDeck\n1 Lightning Bolt (LEA) 161\n```');

	assert.ok(canBeCommander('Legendary Creature — Human // Legendary Planeswalker — Jace', ''));
	assert.ok(!canBeCommander('Legendary Artifact', ''));
	assert.ok(!canBeCommander('Instant // Legendary Creature — Spirit', ''));
});
