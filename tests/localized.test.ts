import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestPrintedMatches, foldText, languageName, printedNameMatches, printedNameQuery } from '../src/localized.ts';

test('foldText removes accents and case', () => {
	assert.equal(foldText('Laboratório Arcano'), 'laboratorio arcano');
	assert.equal(foldText('Aberração Aviana'), 'aberracao aviana');
});

test('printedNameQuery quotes each word and drops syntax characters', () => {
	assert.equal(printedNameQuery('anel solar'), 'lang:any "anel" "solar"');
	assert.equal(printedNameQuery(' "altar" (phyrex '), 'lang:any "altar" "phyrex"');
	assert.equal(printedNameQuery('a'), null);
	assert.equal(printedNameQuery(''), null);
});

test('printedNameMatches needs every word, ignoring accents', () => {
	assert.ok(printedNameMatches('Anel Solar', 'anel sol'));
	assert.ok(printedNameMatches('Laboratório Arcano', 'laboratorio'));
	assert.ok(printedNameMatches('Aberração Aviana', 'ABERRAÇÃO'));
	assert.ok(!printedNameMatches('Anel de Bilbo', 'anel solar'));
	assert.ok(!printedNameMatches('Laboratório Arcano', 'arcane'));
});

test('printedNameMatches works for non-Latin scripts', () => {
	assert.ok(printedNameMatches('黒の魔力貯蔵器', '魔力'));
	assert.ok(printedNameMatches('Солнечное кольцо', 'солнечное'));
});

test('languageName', () => {
	assert.equal(languageName('it'), 'Italian');
	assert.equal(languageName('xx'), 'XX');
});

test('bestPrintedMatches keeps one card, with the best matching language', () => {
	const prints = [
		{ name: 'Sol Ring', printedName: 'Anello Solare', lang: 'it' },
		{ name: 'Sol Ring', printedName: 'Anel Solar', lang: 'pt' },
		{ name: 'Sol Ring', printedName: 'Sol Ring', lang: 'en' },
		{ name: "Bilbo's Ring", printedName: 'Anel de Bilbo', lang: 'pt' },
		{ name: 'Sunlance', printedName: 'Lanza solar', lang: 'es' },
	];
	assert.deepEqual(
		bestPrintedMatches(prints, 'anel solar').map((p) => `${p.name}:${p.lang}`),
		['Sol Ring:pt'],
	);
	assert.deepEqual(
		bestPrintedMatches(prints, 'anel').map((p) => `${p.name}:${p.lang}`),
		['Sol Ring:pt', "Bilbo's Ring:pt"],
	);
});
