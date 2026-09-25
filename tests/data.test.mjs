// Validation gate (§6.7) on the COMMITTED data + frozen numbering (§6.8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, frozenCheck, buildAll, LEVELS, EXPECTED, DEFAULT_SOURCE } from '../tools/build_data.mjs';

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const load = (p) => JSON.parse(fs.readFileSync(path.join(DATA, p), 'utf8'));
const committed = Object.fromEntries(LEVELS.map((L) => [L, { kanji: load(`${L}/kanji.json`), vocab: load(`${L}/vocab.json`) }]));

test('§6.7 gate passes on the committed decks', () => assert.deepEqual(validate(committed), []));

test('manifest matches the deck files', () => {
  const m = load('manifest.json');
  assert.deepEqual(m.levels, ['N4', 'N3', 'N2']);
  for (const L of LEVELS) for (const k of ['kanji', 'vocab']) {
    assert.equal(m.decks[L][k].file, `${L}/${k}.json`);
    assert.equal(m.decks[L][k].count, EXPECTED[L][k]);
    assert.equal(committed[L][k].length, EXPECTED[L][k]);
  }
});

test('shipped decks contain only schema fields (§6.2)', () => {
  const K = ['n','id','kanji','primary','meanings','strokes','grade','readings','components','words','tips','exam'];
  const V = ['n','id','word','reading','romaji','meanings','type','kind','breakdown','forms','tips'];
  for (const L of LEVELS) {
    for (const c of committed[L].kanji) assert.deepEqual(Object.keys(c), K);
    for (const c of committed[L].vocab) assert.deepEqual(Object.keys(c), V);
  }
});

test('exam words: 会 (N4) lists every JLPT word with 会, grouped by level, linked to the deck', () => {
  const k = committed.N4.kanji.find((c) => c.kanji === '会');
  const words = (lv) => k.exam[lv].map((w) => w.word);
  assert.deepEqual(words('N5'), ['会う', '会社']);
  for (const w of ['会話', '会議', '社会', '機会', '教会', '会場', '会議室', '展覧会']) assert.ok(words('N4').includes(w), w);
  assert.ok(words('N3').includes('会員'));
  const kaigi = k.exam.N4.find((w) => w.word === '会議');
  assert.equal(committed.N4.vocab[kaigi.n - 1].word, '会議');
  assert.equal(kaigi.romaji, 'kaigi');
  assert.equal(k.exam.N5[0].n, undefined);
});

test('no card is 行く without an Iku/Yuku rule', () => {
  for (const L of LEVELS) assert.ok(!committed[L].vocab.some((c) => c.word === '行く'));
});

test('§6.8 frozen: regenerating from the source keeps every n → id', { skip: !fs.existsSync(DEFAULT_SOURCE) && 'sister repo not present' }, () => {
  const { decks } = buildAll(DEFAULT_SOURCE);
  assert.deepEqual(frozenCheck(decks, DATA), []);
});

test('frozenCheck flags a renumbering', () => {
  const swapped = structuredClone(committed);
  const v = swapped.N4.vocab;
  [v[0], v[1]] = [v[1], v[0]];
  assert.equal(frozenCheck(swapped, DATA).length, 2);
});
