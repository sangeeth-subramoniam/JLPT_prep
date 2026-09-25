// forms.mjs — kind detection + rule-generated forms (PRD §6.5). Pure.
import { godanEnding } from './wordtype.mjs';
import { toRomaji } from './romaji.mjs';

const GODAN_FINAL = { u:'う', ku:'く', gu:'ぐ', su:'す', tsu:'つ', nu:'ぬ', bu:'ぶ', mu:'む', ru:'る' };

// final kana → [polite, te, negative, past] suffixes replacing the final kana
const GODAN_SETS = {
  う: ['います','って','わない','った'],
  つ: ['ちます','って','たない','った'],
  る: ['ります','って','らない','った'],
  む: ['みます','んで','まない','んだ'],
  ぶ: ['びます','んで','ばない','んだ'],
  ぬ: ['にます','んで','なない','んだ'],
  く: ['きます','いて','かない','いた'],
  ぐ: ['ぎます','いで','がない','いだ'],
  す: ['します','して','さない','した'],
};
const VERB_LABELS = ['polite ます','て-form','negative ない','past た'];

/**
 * @returns {{kind: string, expect: string|null}}
 * expect = the kana both word and reading must end with for forms to be generated.
 */
export function detectKind(typeRaw) {
  for (const t of typeRaw) {
    const g = godanEnding(t);
    if (g) return { kind: 'verb-u', expect: GODAN_FINAL[g] };
  }
  if (typeRaw.includes('Ichidan verb')) return { kind: 'verb-ru', expect: 'る' };
  if (typeRaw.includes('suru verb - special class') || typeRaw.includes('suru verb - included'))
    return { kind: 'verb-suru', expect: 'する' };
  if (typeRaw.includes('Kuru verb - special class')) return { kind: 'verb-kuru', expect: null };
  if (typeRaw.includes('adjective')) return { kind: 'adj-i', expect: 'い' };
  if (typeRaw.includes('adjectival nouns or quasi-adjectives')) return { kind: 'adj-na', expect: null };
  if (typeRaw.includes('noun or participle which takes the aux. verb suru')) return { kind: 'noun', expect: null, suru: true };
  if (typeRaw.includes('adverb')) return { kind: 'adverb', expect: null };
  if (typeRaw.includes('noun')) return { kind: 'noun', expect: null };
  return { kind: 'other', expect: null };
}

const IRREGULAR_I = new Set(['いい', 'よい', 'かっこいい']);

function mk(word, reading, cut, pairs) {
  // pairs: [label, suffix]; cut = number of trailing chars to remove from word AND reading
  const wStem = [...word].slice(0, [...word].length - cut).join('');
  const rStem = [...reading].slice(0, [...reading].length - cut).join('');
  return pairs.map(([label, suf]) => {
    const r = rStem + suf;
    return { label, form: wStem + suf, reading: r, romaji: toRomaji(r) };
  });
}

/**
 * @returns {{kind, forms: Array|null, skipped: boolean}}
 * skipped = the word's kind has forms but the guard (final kana) refused it.
 */
export function buildForms(word, reading, typeRaw) {
  const k = detectKind(typeRaw);
  const ends = (s) => s.endsWith(k.expect);
  const guarded = () => ends(word) && ends(reading);
  switch (k.kind) {
    case 'verb-u': {
      if (!guarded()) return { kind: k.kind, forms: null, skipped: true };
      if (word === '行く' || reading === 'いく') return { kind: k.kind, forms: null, skipped: true };
      const set = GODAN_SETS[k.expect];
      return { kind: k.kind, forms: mk(word, reading, 1, VERB_LABELS.map((l, i) => [l, set[i]])), skipped: false };
    }
    case 'verb-ru':
      if (!guarded()) return { kind: k.kind, forms: null, skipped: true };
      return { kind: k.kind, forms: mk(word, reading, 1, VERB_LABELS.map((l, i) => [l, ['ます','て','ない','た'][i]])), skipped: false };
    case 'verb-suru':
      if (!guarded()) return { kind: k.kind, forms: null, skipped: true };
      return { kind: k.kind, forms: mk(word, reading, 2, VERB_LABELS.map((l, i) => [l, ['します','して','しない','した'][i]])), skipped: false };
    case 'verb-kuru': {
      if (!(word === '来る' && reading === 'くる')) return { kind: k.kind, forms: null, skipped: true };
      const rows = [['polite ます','来ます','きます'],['て-form','来て','きて'],['negative ない','来ない','こない'],['past た','来た','きた']];
      return { kind: k.kind, forms: rows.map(([label, form, r]) => ({ label, form, reading: r, romaji: toRomaji(r) })), skipped: false };
    }
    case 'adj-i':
      if (IRREGULAR_I.has(reading)) return { kind: k.kind, forms: null, skipped: false };
      if (!guarded()) return { kind: k.kind, forms: null, skipped: true };
      return { kind: k.kind, forms: mk(word, reading, 1, [['negative','くない'],['past','かった'],['joining','くて']]), skipped: false };
    case 'adj-na':
      return { kind: k.kind, forms: mk(word, reading, 0, [['before a noun','な'],['negative','じゃない'],['past','だった']]), skipped: false };
    case 'noun':
      if (k.suru) return { kind: k.kind, forms: mk(word, reading, 0, [['as a verb','する'],['polite','します'],['て-form','して']]), skipped: false };
      return { kind: k.kind, forms: null, skipped: false };
    default:
      return { kind: k.kind, forms: null, skipped: false };
  }
}
