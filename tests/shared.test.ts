import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decksHolding, moveSharedCard, parseShared } from '../src/shared.ts';

const BLADE = '1 Blackblade Reforged\n- [x] Arahbo, Roar of the World\n- [ ] Whiplash, Vengeful Engineer\n- [ ] Nine-Fingers Keene';

test('a card and the decks that share it, with the one holding it now', () => {
	const { cards } = parseShared(BLADE);
	assert.equal(cards.length, 1);
	assert.equal(cards[0]!.card.query.name, 'Blackblade Reforged');
	assert.equal(cards[0]!.copies, 1);
	assert.deepEqual(cards[0]!.decks.map((d) => [d.name, d.here]), [
		['Arahbo, Roar of the World', true],
		['Whiplash, Vengeful Engineer', false],
		['Nine-Fingers Keene', false],
	]);
	assert.equal(decksHolding(cards[0]!), 1);
});

test('plain lists, markers, links and several cards', () => {
	const source = 'title: Shared\n2 Sol Ring — the foil one stays in Grist\n* Grist, the Hunger Tide (here)\n1. [[Arahbo Primer|Arahbo]]\n\nSwords to Plowshares\n- Arahbo, Roar of the World ← aqui';
	const shared = parseShared(source);
	assert.equal(shared.title, 'Shared');
	const [ring, swords] = shared.cards;
	assert.equal(ring!.copies, 2);
	assert.equal(ring!.note, 'the foil one stays in Grist');
	assert.deepEqual(ring!.decks.map((d) => [d.name, d.link, d.here]), [
		['Grist, the Hunger Tide', undefined, true],
		['Arahbo', 'Arahbo Primer', false],
	]);
	assert.equal(swords!.copies, 1);
	assert.deepEqual(swords!.decks.map((d) => [d.name, d.here]), [['Arahbo, Roar of the World', true]]);
});

test('decks on the same line, after an arrow, split on semicolons', () => {
	const { cards } = parseShared('Blackblade Reforged -> Arahbo, Roar of the World; Whiplash, Vengeful Engineer; Nine-Fingers Keene');
	assert.deepEqual(cards[0]!.decks.map((d) => d.name), ['Arahbo, Roar of the World', 'Whiplash, Vengeful Engineer', 'Nine-Fingers Keene']);
	assert.equal(decksHolding(cards[0]!), 0);
});

test('a deck line before any card and comments are ignored', () => {
	assert.deepEqual(parseShared('- Arahbo\n// nothing').cards, []);
});

test('moving a single copy checks one deck and unchecks the others', () => {
	assert.equal(
		moveSharedCard(BLADE, 0, 2),
		'1 Blackblade Reforged\n- [ ] Arahbo, Roar of the World\n- [ ] Whiplash, Vengeful Engineer\n- [x] Nine-Fingers Keene',
	);
	// Lists without checkboxes get them.
	assert.equal(moveSharedCard('Sol Ring\n- Grist\n- [[Arahbo Primer|Arahbo]]', 0, 1), 'Sol Ring\n- [ ] Grist\n- [x] [[Arahbo Primer|Arahbo]]');
});

test('with more copies, a deck is toggled on its own', () => {
	assert.equal(moveSharedCard('2 Sol Ring\n- [x] Grist\n- [ ] Arahbo', 0, 1), '2 Sol Ring\n- [x] Grist\n- [x] Arahbo');
	assert.equal(moveSharedCard('2 Sol Ring\n- [x] Grist\n- [x] Arahbo', 0, 0), '2 Sol Ring\n- [ ] Grist\n- [x] Arahbo');
});

test('moving an inline card turns its decks into a list', () => {
	assert.equal(moveSharedCard('Blackblade Reforged -> Arahbo; Whiplash — equip', 0, 1), 'Blackblade Reforged — equip\n- [ ] Arahbo\n- [x] Whiplash');
});
