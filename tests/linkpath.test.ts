import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanLinkpath } from '../src/linkpath.ts';

test('plain link', () => assert.equal(cleanLinkpath('Phyrexian Altar'), 'Phyrexian Altar'));
test('alias is dropped', () => assert.equal(cleanLinkpath('Phyrexian Altar|Altar'), 'Phyrexian Altar'));
test('heading and block are dropped', () => {
	assert.equal(cleanLinkpath('Protean Hulk#Regras'), 'Protean Hulk');
	assert.equal(cleanLinkpath('Protean Hulk#^abc|Hulk'), 'Protean Hulk');
});
test('folder and extension are dropped', () => assert.equal(cleanLinkpath('MTG/Primers/Sol Ring.md'), 'Sol Ring'));
test("apostrophes are kept", () => assert.equal(cleanLinkpath("Ashnod's Altar"), "Ashnod's Altar"));
