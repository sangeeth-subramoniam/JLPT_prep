// tips.mjs — rule-generated tips (PRD §6.6). Pure. Max 3 per card, rules in priority order.
import { toRomaji } from './romaji.mjs';

const MAX_TIPS = 3;
const KANJI_RE = /[一-鿿]/u;
const KATAKANA_WORD = /^[ァ-ヶー]+$/;

export const kataToHira = (s) => [...s].map((c) => {
  const p = c.codePointAt(0);
  return p >= 0x30a1 && p <= 0x30f6 ? String.fromCodePoint(p - 0x60) : c;
}).join('');

const stemOf = (r) => (r.type === 'on' ? kataToHira(r.kana) : r.kana.split('.')[0]).replace(/-/g, '');
const listJa = (xs) => xs.join(', ');

/** Index built once per level: first on-reading → kanji, component → kanji. */
export function kanjiIndex(deck) {
  const byOn = new Map();
  const byComp = new Map();
  for (const k of deck) {
    const on = k.readings.find((r) => r.type === 'on');
    if (on) (byOn.get(on.kana) || byOn.set(on.kana, []).get(on.kana)).push(k.kanji);
    for (const c of k.components || []) (byComp.get(c.char) || byComp.set(c.char, []).get(c.char)).push(k.kanji);
  }
  return { byOn, byComp };
}

/** @param k source kanji record (with readings/words/components); @param idx kanjiIndex(level deck) */
export function kanjiTips(k, idx) {
  const tips = [];
  // K1 — most common reading among the words
  const counts = k.readings.map((r) => {
    const stem = stemOf(r);
    return stem ? k.words.filter((w) => w.reading.includes(stem)).length : 0;
  });
  let best = -1;
  counts.forEach((c, i) => { if (c >= 2 && (best < 0 || c > counts[best])) best = i; });
  if (best >= 0) {
    const r = k.readings[best];
    tips.push(`Most of these words use the reading ${r.kana} (${toRomaji(r.kana)}).`);
  }
  // K2 — rare readings
  const rare = k.readings.filter((r) => !r.word).map((r) => r.kana);
  if (rare.length && rare.length < k.readings.length) {
    const shown = rare.slice(0, 4);
    tips.push(shown.length === 1
      ? `${shown[0]} is a rare reading — skip it for now.`
      : `${listJa(shown)} are rare readings — skip them for now.`);
  }
  // K3 — same sound
  const on = k.readings.find((r) => r.type === 'on');
  if (on) {
    const same = (idx.byOn.get(on.kana) || []).filter((c) => c !== k.kanji).slice(0, 4);
    if (same.length) tips.push(`Same reading ${on.kana} (${toRomaji(on.kana)}) as ${listJa(same)} — don't mix them up.`);
  }
  // K4 — shared piece
  let bestComp = null;
  for (const c of k.components || []) {
    const others = (idx.byComp.get(c.char) || []).filter((x) => x !== k.kanji);
    if (others.length >= 2 && (!bestComp || others.length > bestComp.others.length)) bestComp = { c, others };
  }
  if (bestComp) tips.push(`The piece ${bestComp.c.char} (${bestComp.c.name}) also appears in ${listJa(bestComp.others.slice(0, 3))}.`);
  return tips.slice(0, MAX_TIPS);
}

/** Index built once per level: kanji char → words (deck order). */
export function vocabIndex(deck) {
  const byKanji = new Map();
  for (const w of deck) {
    for (const c of new Set([...w.word].filter((ch) => KANJI_RE.test(ch)))) {
      (byKanji.get(c) || byKanji.set(c, []).get(c)).push(w.word);
    }
  }
  return { byKanji };
}

/** @param w {word, reading, typeRaw, kind, suru?} ; @param idx vocabIndex(level deck) */
export function vocabTips(w, idx) {
  const tips = [];
  const verb = w.suruNoun ? `${w.word}する` : w.word;
  const isVerbish = w.kind.startsWith('verb') || w.suruNoun;
  // V1 — transitivity
  if (isVerbish && w.typeRaw.includes('transitive verb') && !w.typeRaw.includes('intransitive verb')) {
    tips.push(`Takes を: (something) を ${verb}.`);
  } else if (isVerbish && w.typeRaw.includes('intransitive verb') && !w.typeRaw.includes('transitive verb')) {
    tips.push(`No を — the subject does it: (something) が ${verb}.`);
  }
  // V2 — katakana word
  if (KATAKANA_WORD.test(w.word)) {
    tips.push(`Katakana word — read the romaji aloud, it is usually a borrowed word: ${toRomaji(w.reading)}.`);
  }
  // V3 — word family
  const first = [...w.word].find((ch) => KANJI_RE.test(ch));
  if (first) {
    const fam = [...new Set((idx.byKanji.get(first) || []).filter((x) => x !== w.word))].slice(0, 3);
    if (fam.length) tips.push(`Same kanji ${first} in: ${listJa(fam)}.`);
  }
  return tips.slice(0, MAX_TIPS);
}
