import { test } from 'node:test';
import assert from 'node:assert/strict';
import { count, parseSwapCard, parseSwaps, setSwapView, type Swap } from '../src/swap.ts';

const names = (swap: Swap) => ({
	out: swap.out.map((c) => `${c.quantity} ${c.query.name}`),
	in: swap.in.map((c) => `${c.quantity} ${c.query.name}`),
});

test('A -> B: A comes out, B goes in', () => {
	const { groups } = parseSwaps('Fabled Passage -> Verdant Catacombs');
	assert.equal(groups.length, 1);
	assert.deepEqual(names(groups[0]!.swaps[0]!), { out: ['1 Fabled Passage'], in: ['1 Verdant Catacombs'] });
});

test('a colon before the arrow and other arrows are accepted', () => {
	for (const line of ['Fabled Passage: -> Verdant Catacombs', 'Fabled Passage → Verdant Catacombs', 'Fabled Passage => Verdant Catacombs', 'Fabled Passage > Verdant Catacombs']) {
		const swap = parseSwaps(line).groups[0]!.swaps[0]!;
		assert.deepEqual(names(swap), { out: ['1 Fabled Passage'], in: ['1 Verdant Catacombs'] }, line);
	}
});

test('quantities, several cards on a side, links and Moxfield lines', () => {
	const swap = parseSwaps('2x Shock + [[Lightning Bolt]] -> Duress x2; 1 Thoughtseize (2XM) 107').groups[0]!.swaps[0]!;
	assert.deepEqual(names(swap), { out: ['2 Shock', '1 Lightning Bolt'], in: ['2 Duress', '1 Thoughtseize'] });
	assert.equal(swap.in[1]!.query.set, '2xm');
	assert.equal(count(swap.out), 3);
});

test('names with commas, hyphens and // stay whole', () => {
	const swap = parseSwaps('Kiki-Jiki, Mirror Breaker -> Fire // Ice').groups[0]!.swaps[0]!;
	assert.deepEqual(names(swap), { out: ['1 Kiki-Jiki, Mirror Breaker'], in: ['1 Fire'] });
});

test('only out or only in', () => {
	const { swaps } = parseSwaps('Sol Ring ->\n-> Rest in Peace').groups[0]!;
	assert.deepEqual(swaps.map(names), [
		{ out: ['1 Sol Ring'], in: [] },
		{ out: [], in: ['1 Rest in Peace'] },
	]);
});

test('the reason after an em dash', () => {
	const swap = parseSwaps('Fabled Passage -> Verdant Catacombs — enters untapped, [[Ragavan]] food').groups[0]!.swaps[0]!;
	assert.equal(swap.note, 'enters untapped, [[Ragavan]] food');
	assert.equal(parseSwaps('A -> B -- why not').groups[0]!.swaps[0]!.note, 'why not');
});

test('-1 / +1 lines pair up into one change', () => {
	const { swaps } = parseSwaps('-1 Fabled Passage\n-1 Evolving Wilds\n+2 Verdant Catacombs\n-1 Shock\n+1 Duress').groups[0]!;
	assert.deepEqual(swaps.map(names), [
		{ out: ['1 Fabled Passage', '1 Evolving Wilds'], in: ['2 Verdant Catacombs'] },
		{ out: ['1 Shock'], in: ['1 Duress'] },
	]);
});

test('out: and in: lists, also in Portuguese', () => {
	const source = 'out:\n2 Swords to Plowshares\nPath to Exile\nin: 2 Mana Drain\nCounterspell\n\nsai: Shock\nentra: Duress';
	const { swaps } = parseSwaps(source).groups[0]!;
	assert.deepEqual(swaps.map(names), [
		{ out: ['2 Swords to Plowshares', '1 Path to Exile'], in: ['2 Mana Drain', '1 Counterspell'] },
		{ out: ['1 Shock'], in: ['1 Duress'] },
	]);
});

test('groups from headings and lines ending in a colon', () => {
	const source = 'title: Sideboard guide\nview: text\nvs. Aggro:\nA -> B\n\n## vs. Control\nout: C\nin: D\n\nKeep the counters.';
	const swaps = parseSwaps(source);
	assert.equal(swaps.title, 'Sideboard guide');
	assert.equal(swaps.view, 'text');
	assert.deepEqual(
		swaps.groups.map((g) => [g.title, g.swaps.length, g.notes]),
		[
			['vs. Aggro', 1, []],
			['vs. Control', 1, ['Keep the counters.']],
		],
	);
});

test('a heading in an out:/in: list starts a new group', () => {
	const { groups } = parseSwaps('out: A\nin: B\nvs. Combo:\nC -> D');
	assert.deepEqual(groups.map((g) => g.title), [undefined, 'vs. Combo']);
});

test('comments and empty blocks', () => {
	assert.deepEqual(parseSwaps('// Out -> In — why').groups, []);
	assert.deepEqual(parseSwaps('').groups, []);
});

test('parseSwapCard', () => {
	assert.deepEqual(parseSwapCard('3 Island'), { query: { name: 'Island' }, quantity: 3, text: '3 Island' });
	assert.equal(parseSwapCard('Island x4')!.quantity, 4);
	assert.equal(parseSwapCard('  '), null);
});

test('setSwapView replaces the view line or adds it after the title', () => {
	assert.equal(setSwapView('view: images\nA -> B', 'text'), 'view: text\nA -> B');
	assert.equal(setSwapView('title: Side\nA -> B', 'text'), 'title: Side\nview: text\nA -> B');
	assert.equal(setSwapView('A -> B', 'images'), 'view: images\nA -> B');
});
