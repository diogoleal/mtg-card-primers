import assert from 'node:assert/strict';
import { test } from 'node:test';
import { comboStyle, parseCombo, parseComboLine, parseToken, resultIcon, starterCombo, zoneName } from '../src/combo.ts';

const names = (row: ReturnType<typeof parseComboLine>) => row.map((c) => c.options.map((o) => o.name).join(' | '));

test('zones, alternatives and results', () => {
	const combo = parseCombo(`title: Grave Titan loop

battlefield:
Ashmod's Altar or phyrexian Altar  + gravecrawler + grave titan

graveyard:
reassembling skeletom
result: infinite mana, infinite death triggers`);
	assert.equal(combo.title, 'Grave Titan loop');
	assert.deepEqual(combo.results, ['infinite mana', 'infinite death triggers']);
	assert.deepEqual(combo.zones.map((z) => z.zone), ['battlefield', 'graveyard']);
	const row = combo.zones[0]!.rows[0]!;
	assert.deepEqual(names(row), ["Ashmod's Altar | phyrexian Altar", 'gravecrawler', 'grave titan']);
	assert.deepEqual(row.map((c) => c.link), [undefined, '+', '+']);
	assert.deepEqual(names(combo.zones[1]!.rows[0]!), ['reassembling skeletom']);
});

test('operators: removed, on the stack, tapped', () => {
	const row = parseComboLine('~Phyrexian Altar - Gravecrawler + *Grave Titan');
	assert.deepEqual(names(row), ['Phyrexian Altar', 'Gravecrawler', 'Grave Titan']);
	assert.deepEqual(row.map((c) => [c.link, c.tapped, c.removed, c.onStack]), [
		[undefined, true, false, false],
		['-', false, true, false],
		['+', false, false, true],
	]);
	assert.deepEqual(parseComboLine('-Gravecrawler').map((c) => [c.link, c.removed]), [['-', true]]);
});

test('hyphens, quotes and printings stay in the name', () => {
	assert.deepEqual(names(parseComboLine('Lim-Dûl the Necromancer + Mind-Bomb')), ['Lim-Dûl the Necromancer', 'Mind-Bomb']);
	assert.deepEqual(names(parseComboLine('"Fight or Flight" or Hit // Run')), ['Fight or Flight | Hit']);
	const [skeleton] = parseComboLine('Reassembling Skeleton (M19) 116');
	assert.deepEqual(skeleton!.options[0], { name: 'Reassembling Skeleton', set: 'm19', collectorNumber: '116' });
});

test('zone names: aliases, Portuguese, same line, no header', () => {
	assert.equal(zoneName('Cemitério'), 'graveyard');
	assert.equal(zoneName('command zone'), 'command');
	assert.equal(zoneName('Circle of Protection'), null);
	const combo = parseCombo('Sol Ring\nhand: Dark Ritual + Lion\'s Eye Diamond\nCircle of Protection: Red');
	assert.deepEqual(combo.zones.map((z) => [z.zone, z.rows.length]), [['battlefield', 1], ['hand', 2]]);
	assert.deepEqual(names(combo.zones[1]!.rows[1]!), ['Circle of Protection: Red']);
});

test('result icons', () => {
	assert.equal(resultIcon('infinite mana'), 'gem');
	assert.equal(resultIcon('win the game'), 'trophy');
	assert.equal(resultIcon('infinite death triggers'), 'skull');
	assert.equal(resultIcon('something else'), 'infinity');
});

test('note format: heading with links, numbered steps, bold results, notes', () => {
	const combo = parseCombo(`### Combo 1 — [[Reassembling Skeleton]] + [[Phyrexian Altar]] + [[Pitiless Plunderer]]
1. Sacrifique o Skeleton no Altar → 1 mana de qualquer cor.
2. Plunderer cria um Treasure.
3. Pague {1}{B} (mana do Altar + Treasure) e devolva o Skeleton.
4. Repita. **Mortes infinitas.** Saldo de mana zero. Precisa de pagador.

O Skeleton funciona a partir do cemitério: [[Entomb]] nele já deixa a peça pronta.`);
	assert.equal(combo.title, 'Combo 1');
	assert.deepEqual(combo.zones.map((z) => z.zone), ['pieces']);
	assert.deepEqual(names(combo.zones[0]!.rows[0]!), ['Reassembling Skeleton', 'Phyrexian Altar', 'Pitiless Plunderer']);
	assert.equal(combo.steps.length, 4);
	assert.equal(combo.steps[2], 'Pague {1}{B} (mana do Altar + Treasure) e devolva o Skeleton.');
	assert.deepEqual(combo.results, ['Mortes infinitas']);
	assert.deepEqual(combo.notes, ['O Skeleton funciona a partir do cemitério: [[Entomb]] nele já deixa a peça pronta.']);
});

test('note format mixed with zones; wikilink aliases', () => {
	const combo = parseCombo(`## Grave Titan loop
battlefield: [[Phyrexian Altar|Altar]] + [[Gravecrawler]]
graveyard:
Reassembling Skeleton

Needs a sac outlet.`);
	assert.equal(combo.title, 'Grave Titan loop');
	assert.deepEqual(combo.zones.map((z) => [z.zone, names(z.rows[0]!)]), [
		['battlefield', ['Phyrexian Altar', 'Gravecrawler']],
		['graveyard', ['Reassembling Skeleton']],
	]);
	assert.deepEqual(combo.notes, ['Needs a sac outlet.']);
	assert.deepEqual(parseCombo('Sol Ring\nArcane Signet').zones[0]!.rows.length, 2);
});

test('targets: players, objects and cards', () => {
	const row = parseComboLine('Blood Artist > each opponent > me + Fling -> target creature + Lightning Bolt → -[[Gravecrawler]]');
	assert.deepEqual(names(row), ['Blood Artist', 'Fling', 'Lightning Bolt']);
	assert.deepEqual(row[0]!.targets, [
		{ kind: 'player', who: 'each-opponent' },
		{ kind: 'player', who: 'you' },
	]);
	assert.deepEqual(row[1]!.targets, [{ kind: 'object', label: 'Target creature' }]);
	const bolt = row[2]!.targets[0]!;
	assert.equal(bolt.kind, 'card');
	assert.ok(bolt.kind === 'card' && bolt.card.removed && bolt.card.options[0]!.name === 'Gravecrawler');
	assert.deepEqual(row.map((c) => c.link), [undefined, '+', '+']);
});

test('targets in Portuguese, and names that look like targets', () => {
	const t = (s: string) => parseComboLine(`Kaervek's Torch > ${s}`)[0]!.targets[0];
	assert.deepEqual(t('oponente alvo'), { kind: 'player', who: 'opponent' });
	assert.deepEqual(t('todos os oponentes'), { kind: 'player', who: 'each-opponent' });
	assert.deepEqual(t('eu'), { kind: 'player', who: 'you' });
	assert.deepEqual(t('criatura alvo'), { kind: 'object', label: 'Criatura alvo' });
	assert.deepEqual(t('any target'), { kind: 'player', who: 'any' });
	assert.deepEqual(t('two lands'), { kind: 'object', label: 'Two lands' });
	assert.equal(t('Grave Titan')!.kind, 'card');
	// A quoted name is always a card.
	assert.equal(t('"Opponent"')!.kind, 'card');
	// A target before any card is ignored rather than becoming a card.
	assert.deepEqual(names(parseComboLine('> me + Sol Ring')), ['Sol Ring']);
});

test('how: multi-line explanation until the next field or zone', () => {
	const combo = parseCombo(`battlefield:
Phyrexian Altar + Gravecrawler + Grave Titan
how: Sacrifice Gravecrawler to the Altar for {B}.

1. Cast it again from the graveyard: Grave Titan keeps a Zombie around.
2. Repeat for **infinite death triggers**.
   Each loop nets two Zombies.
graveyard:
Reassembling Skeleton
result: infinite mana`);
	assert.deepEqual(combo.how, [
		'Sacrifice Gravecrawler to the Altar for {B}.',
		'',
		'1. Cast it again from the graveyard: Grave Titan keeps a Zombie around.',
		'2. Repeat for **infinite death triggers**.',
		'   Each loop nets two Zombies.',
	]);
	assert.deepEqual(combo.zones.map((z) => z.zone), ['battlefield', 'graveyard']);
	assert.deepEqual(combo.results, ['infinite mana']);
	assert.deepEqual(combo.steps, []);
});

test('how: Portuguese label; bold in numbered lines gives results', () => {
	const combo = parseCombo('Sol Ring\ncomo funciona:\n1. Repita. **Mana infinita.**');
	assert.deepEqual(combo.how, ['1. Repita. **Mana infinita.**']);
	assert.deepEqual(combo.results, ['Mana infinita']);
});

test('keywords: highlighted at the top, with icon and colour', () => {
	const combo = parseCombo('keyword: mana infinita, ganho de vida; mata todos os oponentes\ntags: vitória\nSol Ring');
	assert.deepEqual(combo.keywords, ['mana infinita', 'ganho de vida', 'mata todos os oponentes', 'vitória']);
	assert.deepEqual(combo.keywords.map((k) => comboStyle(k).tone), ['mana', 'life', 'damage', 'win']);
	assert.equal(comboStyle('infinite drain').tone, 'damage');
	assert.equal(comboStyle('infinite tokens').icon, 'copy');
	assert.equal(comboStyle('lock').tone, 'other');
	// A keyword line ends a "how:" explanation.
	assert.deepEqual(parseCombo('how:\nLoop it.\nkeywords: win').keywords, ['win']);
});

test('weak: problems and weak points, next to how:', () => {
	const combo = parseCombo(`battlefield:
Phyrexian Altar + Gravecrawler
how: Loop Gravecrawler.
pontos fracos:
- [[Rest in Peace]] stops the loop.
- Needs a Zombie on the battlefield.

how it works: Repeat.
result: infinite mana`);
	assert.deepEqual(combo.weak, ['- [[Rest in Peace]] stops the loop.', '- Needs a Zombie on the battlefield.']);
	assert.deepEqual(combo.how, ['Loop Gravecrawler.', 'Repeat.']);
	assert.deepEqual(combo.results, ['infinite mana']);
	assert.deepEqual(parseCombo('Sol Ring\nweaknesses: Artifact removal.').weak, ['Artifact removal.']);
	assert.deepEqual(parseCombo('Sol Ring\nproblemas: Graveyard hate.').weak, ['Graveyard hate.']);
});

test('result: and keyword: with the values on the lines below', () => {
	const combo = parseCombo(`battlefield:
[[Witherbloom Apprentice]]
how:
Copy it again and again.

result:
infinite drain
- infinite life
keyword:
mata todos os oponentes
stack:
Chain of Smog`);
	assert.deepEqual(combo.results, ['infinite drain', 'infinite life']);
	assert.deepEqual(combo.keywords, ['mata todos os oponentes']);
	assert.deepEqual(combo.notes, []);
	assert.deepEqual(combo.zones.map((z) => z.zone), ['battlefield', 'stack']);
	assert.deepEqual(combo.how, ['Copy it again and again.']);
});

test('tokens in square brackets', () => {
	assert.deepEqual(parseToken('[Zombie 2/2]'), { name: 'Zombie', power: '2', toughness: '2', colors: [], quantity: 1 });
	assert.deepEqual(parseToken('[token Zombie 2/2 black]'), { name: 'Zombie', power: '2', toughness: '2', colors: ['B'], quantity: 1 });
	assert.deepEqual(parseToken('[3x Insect 1/1 BG]'), { name: 'Insect', power: '1', toughness: '1', colors: ['B', 'G'], quantity: 3 });
	assert.deepEqual(parseToken('[ficha Eldrazi Spawn 0/1 incolor]'), { name: 'Eldrazi Spawn', power: '0', toughness: '1', colors: ['C'], quantity: 1 });
	assert.deepEqual(parseToken('[Treasure x2]'), { name: 'Treasure', power: undefined, toughness: undefined, colors: [], quantity: 2 });
	assert.equal(parseToken('Zombie 2/2'), null);
	assert.equal(parseToken('[2/2]'), null);

	const row = parseComboLine('[[Phyrexian Altar]] - [Eldrazi Spawn 0/1] + Pawn of Ulamog > [Zombie 2/2] + ~[Treasure]');
	assert.deepEqual(row.map((c) => c.token?.name ?? c.options[0]!.name), ['Phyrexian Altar', 'Eldrazi Spawn', 'Pawn of Ulamog', 'Treasure']);
	assert.deepEqual(row.map((c) => [c.link, c.removed, c.tapped]), [
		[undefined, false, false],
		['-', true, false],
		['+', false, false],
		['+', false, true],
	]);
	const target = row[2]!.targets[0]!;
	assert.ok(target.kind === 'card' && target.card.token?.name === 'Zombie');
});

test('starter combo block for new primers', () => {
	const block = starterCombo({ name: 'Grist, the Hunger Tide', frontName: 'Grist, the Hunger Tide' });
	const combo = parseCombo(block.split('\n').slice(1, -1).join('\n'));
	assert.equal(combo.title, 'Grist, the Hunger Tide combo');
	assert.deepEqual(combo.zones.map((z) => [z.zone, names(z.rows[0]!)]), [['battlefield', ['Grist, the Hunger Tide']]]);
	assert.deepEqual([combo.keywords, combo.results, combo.how, combo.weak, combo.notes], [[], [], [], [], []]);
});

test('Portuguese título: and resultado: fields', () => {
	const combo = parseCombo('título: Loop do Grist\ncampo:\nGravecrawler\nresultado: mortes infinitas, dreno infinito');
	assert.equal(combo.title, 'Loop do Grist');
	assert.deepEqual(combo.results, ['mortes infinitas', 'dreno infinito']);
});
