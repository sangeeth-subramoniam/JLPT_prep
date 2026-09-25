#!/usr/bin/env node
// build_data.mjs — generate data/ from Kanji Commute's committed data (PRD §6).
// Usage: node tools/build_data.mjs [--source ../japanese_learning_bot/data] [--check]
//   --check : build + validate + frozen-order check, write nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toRomajiDetailed } from './romaji.mjs';
import { labelsFor } from './wordtype.mjs';
import { buildForms } from './forms.mjs';
import { kanjiTips, kanjiIndex, vocabTips, vocabIndex } from './tips.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_SOURCE = path.resolve(ROOT, '../japanese_learning_bot/data');
export const LEVELS = ['N4', 'N3', 'N2'];
export const EXPECTED = {
  N4: { kanji: 166, vocab: 663 },
  N3: { kanji: 367, vocab: 2139 },
  N2: { kanji: 367, vocab: 1792 },
};
const ROMAJI_RE = /^[a-z'.\-]+$/;

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

function makeRomaji(report) {
  return (kana, where) => {
    if (kana == null) return null;
    try {
      const { romaji, droppedSokuon } = toRomajiDetailed(kana);
      report.droppedSokuon += droppedSokuon;
      return romaji;
    } catch (e) {
      throw new Error(`${where}: ${e.message}`);
    }
  };
}

export const EXAM_LEVELS = ['N5', 'N4', 'N3', 'N2'];

/**
 * Every JLPT word (N5–N2) containing `kanji`, grouped by the level the word is listed at, in deck
 * order. N4–N2 entries carry `n`, their number in this app's Vocabulary deck; N5 has no deck here.
 */
function examWords(kanji, examDecks) {
  const out = {};
  for (const L of EXAM_LEVELS) out[L] = examDecks[L].filter((w) => w.word.includes(kanji));
  return out;
}

function buildKanjiDeck(level, source, R, report, examDecks) {
  const src = readJson(path.join(source, `${level.toLowerCase()}.json`));
  const idx = kanjiIndex(src);
  const tipRules = report.tipRules;
  return src.map((k, i) => {
    const where = `${level} kanji ${k.kanji}`;
    const readings = k.readings.map((r) => {
      const out = { kana: r.kana, romaji: R(r.kana, where), type: r.type };
      if (r.word) Object.assign(out, { word: r.word, wordReading: r.wordReading, wordRomaji: R(r.wordReading, where), meaning: r.meaning });
      return out;
    });
    const tips = kanjiTips(k, idx);
    for (const t of tips) {
      const rule = t.startsWith('Most') ? 'K1' : t.includes('rare reading') ? 'K2' : t.startsWith('Same reading') ? 'K3' : 'K4';
      tipRules[rule] = (tipRules[rule] || 0) + 1;
    }
    return {
      n: i + 1, id: k.kanji, kanji: k.kanji, primary: k.primary, meanings: k.meanings,
      strokes: k.strokes ?? null, grade: k.grade ?? null, readings,
      components: k.components && k.components.length ? k.components : null,
      words: k.words.map((w) => ({ word: w.word, reading: w.reading, romaji: R(w.reading, where), meaning: w.meaning })),
      tips,
      exam: examWords(k.kanji, examDecks),
    };
  });
}

function buildVocabDeck(level, source, R, report) {
  const l = level.toLowerCase();
  const src = [...readJson(path.join(source, 'vocab', `${l}.json`)), ...readJson(path.join(source, 'compounds', `${l}.json`))];
  const idx = vocabIndex(src);
  const tipRules = report.tipRules;
  return src.map((w, i) => {
    const id = `${w.word}|${w.reading}`;
    const where = `${level} vocab ${id}`;
    const f = buildForms(w.word, w.reading, w.pos);
    if (f.skipped) report.formsSkipped.push(id);
    else if (f.forms) report.formsGenerated += 1;
    if (w.word === w.reading) report.kanaOnly += 1;
    if (!w.pos.length) report.noType.push(id);
    const suruNoun = f.kind === 'noun' && w.pos.includes('noun or participle which takes the aux. verb suru');
    const tips = vocabTips({ word: w.word, reading: w.reading, typeRaw: w.pos, kind: f.kind, suruNoun }, idx);
    for (const t of tips) {
      const rule = t.startsWith('Takes') || t.startsWith('No を') ? 'V1' : t.startsWith('Katakana') ? 'V2' : 'V3';
      tipRules[rule] = (tipRules[rule] || 0) + 1;
    }
    return {
      n: i + 1, id, word: w.word, reading: w.reading, romaji: R(w.reading, where),
      meanings: w.meanings, type: labelsFor(w.pos), typeRaw: w.pos, kind: f.kind,
      breakdown: w.breakdown && w.breakdown.length
        ? w.breakdown.map((b) => ({ part: b.part, reading: b.reading ?? null, romaji: R(b.reading, where), meaning: b.meaning }))
        : null,
      forms: f.forms, tips,
    };
  });
}

/** Build every deck in memory. @returns {{decks: {[level]: {kanji, vocab}}, report}} */
export function buildAll(source = DEFAULT_SOURCE) {
  const report = { droppedSokuon: 0, formsGenerated: 0, formsSkipped: [], kanaOnly: 0, noType: [], tipRules: {} };
  const R = makeRomaji(report);
  const decks = {};
  for (const L of LEVELS) decks[L] = { vocab: buildVocabDeck(L, source, R, report) };
  // Exam-word index: N5 straight from the source (no N5 deck in this app), N4–N2 from our decks.
  const entry = (w, where, n) => ({ word: w.word, reading: w.reading, romaji: R(w.reading, where), meaning: w.meanings[0], ...(n ? { n } : {}) });
  const examDecks = {
    N5: [...readJson(path.join(source, 'vocab', 'n5.json')), ...readJson(path.join(source, 'compounds', 'n5.json'))]
      .map((w) => entry(w, `N5 vocab ${w.word}|${w.reading}`)),
  };
  for (const L of LEVELS) examDecks[L] = decks[L].vocab.map((w) => entry(w, `${L} vocab ${w.id}`, w.n));
  for (const L of LEVELS) decks[L] = { kanji: buildKanjiDeck(L, source, R, report, examDecks), vocab: decks[L].vocab };
  return { decks, report };
}

/** §6.7 validation gate. @returns {string[]} errors (empty = pass) */
export function validate(decks) {
  const errs = [];
  const rom = (v, where) => { if (v != null && !ROMAJI_RE.test(v)) errs.push(`${where}: bad romaji "${v}"`); };
  for (const L of LEVELS) {
    for (const kind of ['kanji', 'vocab']) {
      const deck = decks[L]?.[kind];
      if (!deck) { errs.push(`${L}/${kind}: missing`); continue; }
      if (deck.length !== EXPECTED[L][kind]) errs.push(`${L}/${kind}: count ${deck.length} ≠ ${EXPECTED[L][kind]}`);
      const ids = new Set();
      deck.forEach((c, i) => {
        const where = `${L}/${kind} #${c.n} ${c.id}`;
        if (c.n !== i + 1) errs.push(`${where}: n not contiguous`);
        if (ids.has(c.id)) errs.push(`${where}: duplicate id`);
        ids.add(c.id);
        if (kind === 'kanji') {
          if (!c.primary) errs.push(`${where}: no primary`);
          if (!c.readings?.length) errs.push(`${where}: no readings`);
          if (!c.words?.length) errs.push(`${where}: no words`);
          for (const r of c.readings || []) { rom(r.romaji, where); if (r.romaji == null) errs.push(`${where}: reading without romaji`); rom(r.wordRomaji, where); }
          for (const w of c.words || []) { rom(w.romaji, where); if (!w.romaji) errs.push(`${where}: word without romaji`); }
          if (!c.exam || Object.keys(c.exam).join() !== 'N5,N4,N3,N2') errs.push(`${where}: exam must have N5,N4,N3,N2`);
          for (const [lv, ws] of Object.entries(c.exam || {})) for (const w of ws) {
            if (!w.word.includes(c.kanji)) errs.push(`${where}: exam word ${w.word} lacks the kanji`);
            if (!w.romaji || !w.meaning) errs.push(`${where}: exam word ${w.word} incomplete`);
            rom(w.romaji, where);
            if (lv === 'N5' ? w.n !== undefined : decks[lv]?.vocab?.[w.n - 1]?.word !== w.word) errs.push(`${where}: exam word ${w.word} bad deck link`);
          }
        } else {
          if (!c.meanings?.length) errs.push(`${where}: no meanings`);
          // Source has no JMdict POS for ~7% of (almost all kana-only) words; we never guess one.
          if (!Array.isArray(c.type)) errs.push(`${where}: type not an array`);
          if (c.typeRaw?.length && !c.type.length) errs.push(`${where}: no type`);
          if (!c.romaji) errs.push(`${where}: no romaji`);
          rom(c.romaji, where);
          for (const b of c.breakdown || []) rom(b.romaji, where);
          if (c.forms) {
            if (c.forms.length < 3 || c.forms.length > 4) errs.push(`${where}: ${c.forms.length} forms`);
            for (const f of c.forms) { if (!f.form || !f.reading || !f.romaji) errs.push(`${where}: empty form`); rom(f.romaji, where); }
          }
        }
        if (!Array.isArray(c.tips) || c.tips.length > 3) errs.push(`${where}: bad tips`);
      });
    }
  }
  return errs;
}

/** §6.8 frozen numbering: every committed n→id pair must survive. @returns {string[]} errors */
export function frozenCheck(decks, dataDir = path.join(ROOT, 'data')) {
  const errs = [];
  for (const L of LEVELS) for (const kind of ['kanji', 'vocab']) {
    const p = path.join(dataDir, L, `${kind}.json`);
    if (!fs.existsSync(p)) continue;
    const old = readJson(p);
    const now = decks[L][kind];
    if (now.length < old.length) errs.push(`${L}/${kind}: shrank ${old.length} → ${now.length}`);
    old.forEach((c, i) => { if (now[i]?.id !== c.id) errs.push(`${L}/${kind} #${c.n}: ${c.id} → ${now[i]?.id}`); });
  }
  return errs;
}

// One card per line keeps diffs readable. typeRaw is generator-only (PRD §9: N3 vocab > 1 MB).
const shipped = ({ typeRaw, ...c }) => c;
const dumpDeck = (deck) => `[\n${deck.map((c) => JSON.stringify(shipped(c))).join(',\n')}\n]\n`;

function writeAll(decks, report) {
  const dataDir = path.join(ROOT, 'data');
  const today = new Date().toISOString().slice(0, 10);
  const manifest = { generated: today, levels: LEVELS, decks: {} };
  const sizes = {};
  for (const L of LEVELS) {
    fs.mkdirSync(path.join(dataDir, L), { recursive: true });
    manifest.decks[L] = {};
    for (const kind of ['kanji', 'vocab']) {
      const file = `${L}/${kind}.json`;
      const body = dumpDeck(decks[L][kind]);
      fs.writeFileSync(path.join(dataDir, file), body);
      sizes[file] = Buffer.byteLength(body);
      manifest.decks[L][kind] = { file, count: decks[L][kind].length };
    }
  }
  fs.writeFileSync(path.join(dataDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(dataDir, 'README.md'), readme(today, decks, report, sizes));
  return sizes;
}

const examTotal = (decks) => LEVELS.reduce((a, L) => a + decks[L].kanji.reduce((b, k) => b + Object.values(k.exam).flat().length, 0), 0);

function readme(today, decks, report, sizes) {
  const kb = (b) => `${(b / 1024).toFixed(0)} KB`;
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  const rows = LEVELS.map((L) => `| ${L} | ${decks[L].kanji.length} | ${decks[L].vocab.length} | ${kb(sizes[`${L}/kanji.json`])} | ${kb(sizes[`${L}/vocab.json`])} |`).join('\n');
  const rules = ['K1', 'K2', 'K3', 'K4', 'V1', 'V2', 'V3'].map((r) => `| ${r} | ${report.tipRules[r] || 0} |`).join('\n');
  return `# JLPT_prep deck data

Generated by \`tools/build_data.mjs\` on **${today}**. Do not edit by hand — regenerate.
**Decks are frozen (PRD §6.8):** card numbers are user-visible, so a regeneration must keep every
existing \`n → id\` pair; new cards may only be appended. The generator refuses to write otherwise.

## Counts & sizes
| Level | Kanji | Vocabulary | kanji.json | vocab.json |
|---|---:|---:|---:|---:|
${rows}

Total deck data: **${kb(total)}** (all precached by the service worker).
Vocabulary = the level's full tanos vocabulary list: Kanji Commute's \`vocab/<l>.json\` followed by
\`compounds/<l>.json\`, merged into one deck with 0 id collisions (id = \`word|reading\`).

## Validation report (§6.7 gate: passed)
- Forms generated: **${report.formsGenerated}** · forms skipped by the final-kana guard: **${report.formsSkipped.length}**${report.formsSkipped.length ? ` (${report.formsSkipped.join(', ')})` : ''}
- Kana-only vocabulary words: ${report.kanaOnly}
- Words with **no word type** in the source (JMdict POS unmatched upstream; shown without a Word
  type section, never guessed): **${report.noType.length}**
- Dropped っ with no following consonant: ${report.droppedSokuon}

Tips per rule (PRD §6.6):

| Rule | Tips |
|---|---:|
${rules}

## How each field is made
- **Romaji** — \`tools/romaji.mjs\`: Hepburn consonants, long vowels written as the kana spell
  them (とうきょう → toukyou), ん → n' before a vowel or y. Generated here; the app never transliterates.
- **Word type** — \`tools/wordtype.mjs\`: every JMdict POS string mapped to a beginner label.
- **Forms** — \`tools/forms.mjs\`: rule-based ます / て / ない / た for verbs, adjective and する
  forms. Generated only when the word and its reading end with the kana the word type predicts.
- **Exam words** (\`exam\` on kanji cards) — every word on the N5–N2 vocabulary lists that contains
  the kanji, grouped by the word's level; N4–N2 entries link to their Vocabulary card number.
  **${examTotal(decks)}** entries in all.
- **Tips** — \`tools/tips.mjs\`: fixed templates that restate facts already in the deck. Never
  hand-written per card.

## Sources & licensing
Input is the committed data of the sister project **Kanji Commute** (\`japanese_learning_bot/data\`):
- Kanji readings, meanings, strokes, grade — **KANJIDIC2**. Components — **KRADFILE**, English names
  authored in Kanji Commute. Example words, word types, readings — **JMdict**.
- JLPT level membership — the **tanos.co.uk** (Jonathan Waller) lists, via
  \`davidluzgouveia/kanji-data\` (kanji) and \`jamsinclair/open-anki-jlpt-decks\` (vocabulary).
- KANJIDIC2, KRADFILE and JMdict are © the **Electronic Dictionary Research and Development Group
  (EDRDG)**, used under the **Creative Commons Attribution-ShareAlike (CC BY-SA)** licence.
`;
}

// ---- CLI ----
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const si = args.indexOf('--source');
  const source = si >= 0 ? path.resolve(args[si + 1]) : DEFAULT_SOURCE;
  const { decks, report } = buildAll(source);
  const errs = [...validate(decks), ...frozenCheck(decks)];
  if (errs.length) {
    console.error(`Validation FAILED (${errs.length}):\n  ${errs.slice(0, 50).join('\n  ')}`);
    process.exit(1);
  }
  for (const L of LEVELS) console.log(`${L}: kanji ${decks[L].kanji.length} · vocab ${decks[L].vocab.length}`);
  console.log(`forms ${report.formsGenerated} · skipped ${report.formsSkipped.length} · dropped っ ${report.droppedSokuon} · tips`, report.tipRules);
  if (args.includes('--check')) { console.log('check OK (nothing written)'); process.exit(0); }
  const sizes = writeAll(decks, report);
  console.log('wrote', Object.entries(sizes).map(([f, b]) => `${f} ${(b / 1024).toFixed(0)}KB`).join(', '));
}
