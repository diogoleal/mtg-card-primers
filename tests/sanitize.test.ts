import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeFileName } from '../src/sanitize.ts';

test('plain name is unchanged', () => {
	assert.equal(sanitizeFileName('Sol Ring'), 'Sol Ring');
});

test('"//" keeps only the front face', () => {
	assert.equal(sanitizeFileName('Delver of Secrets // Insectile Aberration'), 'Delver of Secrets');
	assert.equal(sanitizeFileName('Who // What // When // Where // Why'), 'Who');
});

test('":" becomes " -"', () => {
	assert.equal(sanitizeFileName('Circle of Protection: Red'), 'Circle of Protection - Red');
	assert.equal(sanitizeFileName('Momir Vig, Simic Visionary:Avatar'), 'Momir Vig, Simic Visionary - Avatar');
});

test('"?" is removed', () => {
	assert.equal(sanitizeFileName('Question?'), 'Question');
	assert.equal(sanitizeFileName('Did It Fall?'), 'Did It Fall');
});

test('double quotes are removed', () => {
	assert.equal(sanitizeFileName('"Ach! Hans, Run!"'), 'Ach! Hans, Run!');
	assert.equal(sanitizeFileName('Kongming, "Sleeping Dragon"'), 'Kongming, Sleeping Dragon');
});

test('apostrophes are kept', () => {
	assert.equal(sanitizeFileName("Urza's Saga"), "Urza's Saga");
});

test('accents are kept and normalized to NFC', () => {
	assert.equal(sanitizeFileName('Lim-Dûl the Necromancer'), 'Lim-Dûl the Necromancer');
	assert.equal(sanitizeFileName('Séance'), 'Séance');
	// Decomposed "é" (e + combining acute) becomes the composed form.
	assert.equal(sanitizeFileName('Séance'), 'Séance');
	assert.equal(sanitizeFileName('Æther Vial'), 'Æther Vial');
});

test('other invalid characters are removed', () => {
	assert.equal(sanitizeFileName('A\\B*C<D>E|F#G^H[I]J'), 'ABCDEFGHIJ');
	assert.equal(sanitizeFileName('Tab\tand\nnewline'), 'Tab and newline');
});

test('trailing dots and leading dots are removed', () => {
	assert.equal(sanitizeFileName('...Wait...'), 'Wait');
});

test('empty result falls back to a default', () => {
	assert.equal(sanitizeFileName('???'), 'Untitled card');
});
