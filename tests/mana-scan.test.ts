import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanSymbols, splitOracleLine } from '../src/mana-scan.ts';

const KNOWN = new Set(['{1}', '{2}', '{B}', '{U}', '{G}', '{R}', '{W}', '{C}', '{X}', '{T}', '{Q}', '{PW}', '{B/G}', '{G/P}', '{2/W}', '{10}']);
const isMana = (s: string) => KNOWN.has(s);
const scan = (t: string) => scanSymbols(t, isMana).map((m) => m.symbol);
const values = (t: string) => scanSymbols(t, isMana).map((m) => `${m.kind}:${m.value}`);
const positions = (t: string) => scanSymbols(t, isMana).map((m) => t.slice(m.from, m.to));

test('basic colors and generic', () => {
	assert.deepEqual(scan('Pay {1}{B} and {W}{U}{G}{R}'), ['{1}', '{B}', '{W}', '{U}', '{G}', '{R}']);
});

test('positions match the source text', () => {
	assert.deepEqual(positions('Cost {1}{B}{G}, [+1] and [LEVEL 5+].'), ['{1}', '{B}', '{G}', '[+1]', '[LEVEL 5+]']);
});

test('hybrid, phyrexian, colorless, X, tap, untap, planeswalker, two-digit', () => {
	assert.deepEqual(scan('{B/G} {G/P} {2/W} {C} {X} {T} {Q} {PW} {10}'), [
		'{B/G}', '{G/P}', '{2/W}', '{C}', '{X}', '{T}', '{Q}', '{PW}', '{10}',
	]);
});

test('unknown braces are ignored', () => {
	assert.deepEqual(scan('{name} {{oracle_id}} {Z} { B } {}'), []);
});

test('loyalty costs', () => {
	assert.deepEqual(values('[+1] create [−2] destroy [-5] lose [0] nothing [+X] [-x]'), [
		'loyalty:+1', 'loyalty:−2', 'loyalty:−5', 'loyalty:0', 'loyalty:+X', 'loyalty:−X',
	]);
});

test('level bands', () => {
	assert.deepEqual(values('[LEVEL 1-4] 1/2 and [LEVEL 5+] 1/4, [level 2-3]'), ['level:1-4', 'level:5+', 'level:2-3']);
});

test('brackets that are links or not loyalty are ignored', () => {
	assert.deepEqual(scan('[[+1]] [+1](http://x) [+1][ref] array[0] [1] [x] - [ ] task [LEVEL] [LEVEL 1-]'), []);
});

test('inline code is skipped', () => {
	assert.deepEqual(scan('use `{B}` ou ``{1}`` ou `[+1]` mas {G}'), ['{G}']);
});

test('fenced code blocks are skipped', () => {
	assert.deepEqual(scan('{B}\n```js\nconst x = {1};\n{U}\n```\n{R}'), ['{B}', '{R}']);
	assert.deepEqual(scan('~~~\n{U}\n~~~\n{W}'), ['{W}']);
});

test('math is skipped', () => {
	assert.deepEqual(scan('$\\frac{1}{2}$ and {B}'), ['{B}']);
	assert.deepEqual(scan('$$\n\\sum_{1}\n$$\n{G}'), ['{G}']);
	assert.deepEqual(scan('costs $5 and {1} and $6'), ['{1}']);
	assert.deepEqual(scan('$x^{2}$ {2}'), ['{2}']);
});

test('frontmatter is skipped', () => {
	assert.deepEqual(scan('---\nmtg_mana_cost: "{1}{B}{G}"\n---\nTexto {B}'), ['{B}']);
});

test('table cells', () => {
	assert.deepEqual(scan('| Custo | {1}{B} |\n|---|---|\n| x | {G/P} [+1] |'), ['{1}', '{B}', '{G/P}', '[+1]']);
});

test('oracle lines: planeswalker abilities', () => {
	assert.deepEqual(splitOracleLine('+1: Create a 1/1 token.'), { kind: 'loyalty', value: '+1', rest: ': Create a 1/1 token.' });
	assert.deepEqual(splitOracleLine('−2: You may sacrifice a creature.'), { kind: 'loyalty', value: '−2', rest: ': You may sacrifice a creature.' });
	assert.deepEqual(splitOracleLine('0: Draw a card.'), { kind: 'loyalty', value: '0', rest: ': Draw a card.' });
	assert.deepEqual(splitOracleLine('−X: Destroy.'), { kind: 'loyalty', value: '−X', rest: ': Destroy.' });
});

test('oracle lines: level bands', () => {
	assert.deepEqual(splitOracleLine('LEVEL 1-4'), { kind: 'level', value: '1-4', rest: '' });
	assert.deepEqual(splitOracleLine('LEVEL 5+'), { kind: 'level', value: '5+', rest: '' });
});

test('oracle lines: other text is untouched', () => {
	assert.deepEqual(splitOracleLine('{T}: Add {G}{G}.'), { kind: 'text', rest: '{T}: Add {G}{G}.' });
	assert.deepEqual(splitOracleLine('1/2'), { kind: 'text', rest: '1/2' });
	assert.deepEqual(splitOracleLine('Level up {1}{G}'), { kind: 'text', rest: 'Level up {1}{G}' });
});

test('set symbols', () => {
	assert.deepEqual(values('Grist {set:dsc:m}, Sol Ring {set:C21:U} and {set:lea} [{set:x}] {set:dsc:z}'), [
		'set:dsc:m', 'set:c21:u', 'set:lea',
	]);
});

test('set symbols are skipped in code', () => {
	assert.deepEqual(values('`{set:dsc}` {set:dsc}'), ['set:dsc']);
});

test('Commander brackets', () => {
	assert.deepEqual(values('[BRACKET 3] [bracket 1] [B4] [BRACKET 2-3] [B1-5]'), [
		'bracket:3', 'bracket:1', 'bracket:4', 'bracket:2-3', 'bracket:1-5',
	]);
});

test('invalid brackets are ignored', () => {
	assert.deepEqual(values('[BRACKET 6] [B0] [b2] [B3-2] [B3-3] [[B3]] [B3](x) item[B3] [BRACKET3]'), []);
});
