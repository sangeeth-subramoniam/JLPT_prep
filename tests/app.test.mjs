// Static checks on the shipped app: PWA precache completeness, version sync, AC-12 wording.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const sw = read('sw.js');
const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

test('APP_VERSION equals the service worker CACHE', () => {
  const cache = sw.match(/const CACHE = '([^']+)'/)[1];
  const ver = read('js/app.js').match(/APP_VERSION = '([^']+)'/)[1];
  assert.equal(ver, cache);
});

test('every precached asset exists; every js module and deck is precached', () => {
  for (const a of assets) if (a !== './') assert.ok(fs.existsSync(path.join(ROOT, a)), `missing ${a}`);
  for (const f of fs.readdirSync(path.join(ROOT, 'js'))) assert.ok(assets.includes(`js/${f}`), `js/${f} not precached`);
  const m = JSON.parse(read('data/manifest.json'));
  for (const L of m.levels) for (const d of ['kanji', 'vocab']) assert.ok(assets.includes(`data/${m.decks[L][d].file}`));
});

test('AC-12: no score, streak, percentage or "wrong" in UI code', () => {
  const src = read('index.html') + read('js/app.js');
  for (const bad of [/\bscore/i, /\bstreak/i, /\bwrong\b/i, /\baccuracy/i, /%/]) {
    assert.doesNotMatch(src, bad, `found ${bad}`);
  }
});

test('home lists exactly N4, N3, N2 in that order', () => {
  assert.match(read('js/store.js'), /LEVELS = \['N4', 'N3', 'N2'\]/);
});
