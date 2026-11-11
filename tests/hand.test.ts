import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handSize, parseHand, parseHandCard, setHandView } from '../src/hand.ts';

const names = (source: string) => parseHand(source).cards.map((c) => `${c.quantity} ${c.query.name}`);

test('cards one per line, with quantities, links, bullets and Moxfield lines', () => {
	const source = 'Grist, the Hunger Tide\n[[Sol Ring]]\n2 Swamp\n- Forest\n1. Overgrown Tomb (GRN) 253';
	assert.deepEqual(names(source), ['1 Grist, the Hunger Tide', '1 Sol Ring', '2 Swamp', '1 Forest', '1 Overgrown Tomb']);
	assert.equal(handSize(parseHand(source)), 6);
	assert.equal(parseHand(source).cards[4]!.query.set, 'grn');
});

test('keep or mulligan, as a line or an option, also in Portuguese', () => {
	for (const [line, verdict] of [
		['keep', 'keep'],
		['Keep!', 'keep'],
		['Mulligan', 'mulligan'],
		['mull', 'mulligan'],
		['manter', 'keep'],
		['Mantém', 'keep'],
		['verdict: mulligan', 'mulligan'],
		['decisão: keep', 'keep'],
	] as const) {
		assert.equal(parseHand(`${line}\nSol Ring`).verdict, verdict, line);
	}
	assert.equal(parseHand('Sol Ring').verdict, undefined);
});

test('on the play or on the draw', () => {
	assert.equal(parseHand('on the play\nSol Ring').play, 'play');
	assert.equal(parseHand('On the draw.\nSol Ring').play, 'draw');
	assert.equal(parseHand('play: draw\nSol Ring').play, 'draw');
	assert.equal(parseHand('jogando primeiro\nSol Ring').play, 'play');
	assert.equal(parseHand('Sol Ring').play, undefined);
});

test('a note after an em dash belongs to the card', () => {
	const card = parseHandCard('Sol Ring — turn 1, then [[Grist, the Hunger Tide]]')!;
	assert.equal(card.query.name, 'Sol Ring');
	assert.equal(card.note, 'turn 1, then [[Grist, the Hunger Tide]]');
	assert.equal(parseHandCard('2 Swamp -- untapped')!.quantity, 2);
	assert.equal(parseHandCard('Swamp')!.note, undefined);
});

test('everything after why: is the explanation, blank lines included', () => {
	const hand = parseHand('title: Turn-2 Grist\nkeep\nSol Ring\nwhy:\nFast mana.\n\n- [[Grist, the Hunger Tide]] on turn 2\nSwamp\n\n');
	assert.equal(hand.title, 'Turn-2 Grist');
	assert.deepEqual(names('Sol Ring'), ['1 Sol Ring']);
	assert.equal(hand.cards.length, 1);
	assert.deepEqual(hand.why, ['Fast mana.', '', '- [[Grist, the Hunger Tide]] on turn 2', 'Swamp']);
	assert.deepEqual(parseHand('Sol Ring\npor quê: sem terrenos').why, ['sem terrenos']);
});

test('names with a colon stay cards; comments and options are skipped', () => {
	assert.deepEqual(names('// seven cards\nview: text\nCircle of Protection: Red\nKiki-Jiki, Mirror Breaker'), [
		'1 Circle of Protection: Red',
		'1 Kiki-Jiki, Mirror Breaker',
	]);
	assert.equal(parseHand('view: text').view, 'text');
});

test('setHandView', () => {
	assert.equal(setHandView('keep\nSol Ring', 'text'), 'view: text\nkeep\nSol Ring');
	assert.equal(setHandView('title: A\nview: text\nkeep', 'images'), 'title: A\nview: images\nkeep');
});
