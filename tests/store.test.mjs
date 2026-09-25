import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';

function fakeStorage() {
  const m = new Map();
  let writes = 0, reads = 0;
  return {
    m, get writes() { return writes; }, get reads() { return reads; },
    getItem: (k) => { reads++; return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { writes++; m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
  };
}
const NOW = () => '2026-09-25T00:00:00.000Z';

test('default is pending; set/unset round-trip; pending = key absent', () => {
  const s = fakeStorage();
  const st = createStore(s, NOW);
  assert.equal(st.get('N3', 'vocab', '季節|きせつ'), 'pending');
  st.set('N3', 'vocab', '季節|きせつ', 'done');
  assert.deepEqual(JSON.parse(s.m.get('jlptprep.v1.status.N3.vocab')), { ids: { '季節|きせつ': 'done' }, updatedAt: NOW() });
  st.set('N3', 'vocab', '季節|きせつ', 'pending');
  assert.equal(s.m.has('jlptprep.v1.status.N3.vocab'), false);
  assert.throws(() => st.set('N3', 'vocab', 'x', 'bogus'));
});

test('persists across a new store instance', () => {
  const s = fakeStorage();
  createStore(s, NOW).set('N4', 'kanji', '発', 'review');
  assert.equal(createStore(s, NOW).get('N4', 'kanji', '発'), 'review');
});

test('blob is parsed once per deck, not per tap (§7.2)', () => {
  const s = fakeStorage();
  const st = createStore(s, NOW);
  for (let i = 0; i < 50; i++) st.set('N2', 'vocab', `w${i}`, 'done');
  assert.equal(s.reads, 1);
  assert.equal(s.writes, 50);
});

test('corrupt JSON is treated as empty', () => {
  const s = fakeStorage();
  s.m.set('jlptprep.v1.status.N3.kanji', '{nope');
  const st = createStore(s, NOW);
  assert.equal(st.get('N3', 'kanji', '政'), 'pending');
  st.set('N3', 'kanji', '政', 'done');
  assert.equal(st.get('N3', 'kanji', '政'), 'done');
});

test('counts + completion are derived', () => {
  const st = createStore(fakeStorage(), NOW);
  assert.deepEqual(st.counts('N4', 'kanji', 3), { done: 0, review: 0, pending: 3, total: 3, complete: false });
  st.set('N4', 'kanji', 'a', 'done'); st.set('N4', 'kanji', 'b', 'done'); st.set('N4', 'kanji', 'c', 'review');
  assert.equal(st.counts('N4', 'kanji', 3).complete, false);
  st.set('N4', 'kanji', 'c', 'done');
  assert.deepEqual(st.counts('N4', 'kanji', 3), { done: 3, review: 0, pending: 0, total: 3, complete: true });
  st.set('N4', 'kanji', 'a', 'pending');
  assert.equal(st.counts('N4', 'kanji', 3).complete, false);
});

test('export → reset everything → import restores every status (AC-9)', () => {
  const st = createStore(fakeStorage(), NOW);
  st.set('N4', 'kanji', '発', 'done');
  st.set('N3', 'vocab', '季節|きせつ', 'review');
  st.set('N2', 'vocab', '日本式|にほんしき', 'done');
  const file = JSON.parse(JSON.stringify(st.exportAll()));
  st.resetAll();
  assert.equal(st.get('N4', 'kanji', '発'), 'pending');
  const plan = st.planImport(file);
  assert.equal(plan.done, 2); assert.equal(plan.review, 1);
  st.applyImport(plan);
  assert.equal(st.get('N4', 'kanji', '発'), 'done');
  assert.equal(st.get('N3', 'vocab', '季節|きせつ'), 'review');
  assert.equal(st.get('N2', 'vocab', '日本式|にほんしき'), 'done');
});

test('import merges: absence never clears; unknown ids dropped; bad files rejected', () => {
  const st = createStore(fakeStorage(), NOW);
  st.set('N4', 'kanji', '発', 'done');
  const file = { app: 'jlptprep', version: 1, status: { 'N4.kanji': { ids: { 登: 'review', 幽霊: 'done' } } } };
  const plan = st.planImport(file, { 'N4.kanji': new Set(['発', '登']) });
  assert.deepEqual([plan.review, plan.done, plan.unknown], [1, 0, 1]);
  st.applyImport(plan);
  assert.equal(st.get('N4', 'kanji', '発'), 'done');
  assert.equal(st.get('N4', 'kanji', '登'), 'review');
  assert.throws(() => st.planImport({ app: 'other' }));
  assert.throws(() => st.planImport(null));
});

test('ui state is best-effort', () => {
  const s = fakeStorage();
  const st = createStore(s, NOW);
  assert.deepEqual(st.ui.read(), { filter: {}, scroll: {} });
  st.ui.write({ filter: { 'N3.vocab': 'pending' }, scroll: { 'N3.vocab': 12 } });
  assert.deepEqual(st.ui.read().filter, { 'N3.vocab': 'pending' });
  s.m.set('jlptprep.v1.ui', 'garbage');
  assert.deepEqual(st.ui.read(), { filter: {}, scroll: {} });
});
