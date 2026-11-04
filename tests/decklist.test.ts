import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manaCurve, parseDecklist, lineFinish, sectionName, setViewOption, typeGroup, withPrinting } from '../src/decklist.ts';

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
