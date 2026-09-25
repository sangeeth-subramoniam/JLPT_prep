// wordtype.mjs — JMdict POS strings → beginner labels (PRD §6.4). Pure.
const EXACT = {
  'noun': 'noun',
  "nouns which may take the genitive case particle 'no'": 'noun (can take の)',
  'noun or participle which takes the aux. verb suru': 'noun · add する to make a verb',
  'noun, used as a suffix': 'suffix (attaches after a word)',
  'suffix': 'suffix (attaches after a word)',
  'noun, used as a prefix': 'prefix (attaches before a word)',
  'prefix': 'prefix (attaches before a word)',
  'transitive verb': 'transitive (uses を)',
  'intransitive verb': 'intransitive (no を)',
  'Ichidan verb': 'る-verb (Group 2)',
  'Ichidan verb - zuru verb': 'verb (〜ずる, formal)',
  'suru verb - special class': 'する-verb',
  'suru verb - included': 'する-verb',
  'Kuru verb - special class': '来る (irregular)',
  "Nidan verb with 'u' ending": 'verb (classical)',
  'auxiliary verb': 'auxiliary verb',
  'adjective': 'い-adjective',
  'adjectival nouns or quasi-adjectives': 'な-adjective',
  "'taru' adjective": 'adjective (〜たる, formal)',
  'pre-noun adjectival': 'goes before a noun',
  'noun or verb acting prenominally': 'goes before a noun',
  'adverb': 'adverb',
  "adverb taking the 'to' particle": 'adverb (often with と)',
  'counter': 'counter',
  'expressions': 'expression / set phrase',
  'interjection': 'interjection',
  'conjunction': 'conjunction',
  'pronoun': 'pronoun',
  'numeric': 'number',
  'particle': 'particle',
};
const GODAN = /^Godan verb with '(u|ku|gu|su|tsu|nu|bu|mu|ru)' ending$/;

export class WordTypeError extends Error {}

export function labelFor(raw) {
  if (EXACT[raw]) return EXACT[raw];
  if (GODAN.test(raw)) return 'う-verb (Group 1)';
  throw new WordTypeError(`unmapped JMdict POS: "${raw}"`);
}

/** Labels in input order, de-duplicated. Throws on an unmapped string. */
export function labelsFor(rawList) {
  const out = [];
  for (const raw of rawList) {
    const l = labelFor(raw);
    if (!out.includes(l)) out.push(l);
  }
  return out;
}

export function godanEnding(raw) {
  const m = GODAN.exec(raw);
  return m ? m[1] : null;
}
