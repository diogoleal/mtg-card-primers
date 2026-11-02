import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoxfieldLine, looksLikeMoxfieldLine } from '../src/moxfield.ts';

test('bare name', () => {
	assert.deepEqual(parseMoxfieldLine('Sol Ring'), { name: 'Sol Ring' });
});

test('quantity + name', () => {
	assert.deepEqual(parseMoxfieldLine('1 Sol Ring'), { name: 'Sol Ring' });
	assert.deepEqual(parseMoxfieldLine('4x Lightning Bolt'), { name: 'Lightning Bolt' });
});

test('full line with set and collector number', () => {
	assert.deepEqual(parseMoxfieldLine('1 Sol Ring (C21) 263'), {
		name: 'Sol Ring',
		set: 'c21',
		collectorNumber: '263',
	});
});

test('foil and etched markers are ignored', () => {
	const expected = { name: 'Sol Ring', set: 'c21', collectorNumber: '263' };
	assert.deepEqual(parseMoxfieldLine('1 Sol Ring (C21) 263 *F*'), expected);
	assert.deepEqual(parseMoxfieldLine('1 Sol Ring (C21) 263 *E*'), expected);
	assert.deepEqual(parseMoxfieldLine('1 Sol Ring (C21) 263 *F* #Ramp'), expected);
});

test('double-faced and split cards keep only the front face', () => {
	assert.deepEqual(parseMoxfieldLine('Delver of Secrets // Insectile Aberration'), {
		name: 'Delver of Secrets',
	});
	assert.deepEqual(parseMoxfieldLine('1 Fire // Ice (MH2) 290'), {
		name: 'Fire',
		set: 'mh2',
		collectorNumber: '290',
	});
});

test('collector numbers with letters and symbols', () => {
	assert.deepEqual(parseMoxfieldLine('1 Arcane Signet (PLST) CMR-297'), {
		name: 'Arcane Signet',
		set: 'plst',
		collectorNumber: 'CMR-297',
	});
	assert.deepEqual(parseMoxfieldLine('Forest (UNF) 239★'), {
		name: 'Forest',
		set: 'unf',
		collectorNumber: '239★',
	});
});

test('set without collector number', () => {
	assert.deepEqual(parseMoxfieldLine('1 Sol Ring (C21)'), { name: 'Sol Ring', set: 'c21' });
});

test('extra whitespace is tolerated', () => {
	assert.deepEqual(parseMoxfieldLine('  1   Sol Ring   (C21)   263  '), {
		name: 'Sol Ring',
		set: 'c21',
		collectorNumber: '263',
	});
});

test('names starting with numbers are not mistaken for quantity', () => {
	assert.deepEqual(parseMoxfieldLine('1996 World Champion'), { name: '1996 World Champion' });
	assert.deepEqual(parseMoxfieldLine('1 1996 World Champion'), { name: '1996 World Champion' });
});

test('names with punctuation', () => {
	assert.deepEqual(parseMoxfieldLine('1 Circle of Protection: Red (LEA) 251'), {
		name: 'Circle of Protection: Red',
		set: 'lea',
		collectorNumber: '251',
	});
	assert.deepEqual(parseMoxfieldLine('"Ach! Hans, Run!"'), { name: '"Ach! Hans, Run!"' });
});

test('empty input', () => {
	assert.equal(parseMoxfieldLine(''), null);
	assert.equal(parseMoxfieldLine('   '), null);
	assert.equal(parseMoxfieldLine('1 '), null);
});

test('looksLikeMoxfieldLine', () => {
	assert.equal(looksLikeMoxfieldLine('Sol Ring'), false);
	assert.equal(looksLikeMoxfieldLine('1 Sol Ring'), true);
	assert.equal(looksLikeMoxfieldLine('Sol Ring (C21) 263'), true);
});
