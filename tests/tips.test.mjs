import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kanjiTips, kanjiIndex, vocabTips, vocabIndex } from '../tools/tips.mjs';

const 発 = {
  kanji: '発',
  readings: [
    { kana: 'ハツ', type: 'on', word: '不発' }, { kana: 'ホツ', type: 'on' },
    { kana: 'た.つ', type: 'kun' },
  ],
  words: [{ reading: 'いっぱつ' }, { reading: 'ふはつ' }, { reading: 'はつばい' }],
  components: [{ char: '癶', name: 'feet apart' }],
};
const deck = [
  発,
  { kanji: '登', readings: [{ kana: 'トウ', type: 'on' }], words: [], components: [{ char: '癶', name: 'feet apart' }] },
  { kanji: '発2', readings: [{ kana: 'ハツ', type: 'on' }], words: [], components: [{ char: '癶', name: 'feet apart' }] },
];

test('kanji tips K1–K4 in priority order, capped at 3', () => {
  const tips = kanjiTips(発, kanjiIndex(deck));
  assert.deepEqual(tips, [
    'Most of these words use the reading ハツ (hatsu).',
    'ホツ, た.つ are rare readings — skip them for now.',
    'Same reading ハツ (hatsu) as 発2 — don\'t mix them up.',
  ]);
});
test('K4 shared piece needs ≥ 2 other kanji', () => {
  const lone = { kanji: 'X', readings: [{ kana: 'ア', type: 'on', word: 'y' }], words: [], components: [{ char: '癶', name: 'feet apart' }] };
  assert.deepEqual(kanjiTips(lone, kanjiIndex([lone, ...deck])), ['The piece 癶 (feet apart) also appears in 発, 登, 発2.']);
});
test('K2 is silent when no reading has a word', () => {
  const k = { kanji: 'Y', readings: [{ kana: 'ア', type: 'on' }], words: [], components: null };
  assert.deepEqual(kanjiTips(k, kanjiIndex([k])), []);
});

const vdeck = [{ word: '季節' }, { word: '四季' }, { word: '季刊' }, { word: '盗む' }];
test('vocab V1 transitive + V3 family', () => {
  const idx = vocabIndex(vdeck);
  assert.deepEqual(vocabTips({ word: '盗む', reading: 'ぬすむ', typeRaw: ["Godan verb with 'mu' ending", 'transitive verb'], kind: 'verb-u' }, idx),
    ['Takes を: (something) を 盗む.']);
  assert.deepEqual(vocabTips({ word: '季節', reading: 'きせつ', typeRaw: ['noun'], kind: 'noun' }, idx),
    ['Same kanji 季 in: 四季, 季刊.']);
});
test('vocab V1 on a suru-noun uses 〜する; intransitive wording', () => {
  const idx = vocabIndex([]);
  assert.deepEqual(vocabTips({ word: '起きる', reading: 'おきる', typeRaw: ['Ichidan verb', 'intransitive verb'], kind: 'verb-ru' }, idx),
    ['No を — the subject does it: (something) が 起きる.']);
  assert.deepEqual(vocabTips({ word: '勉強', reading: 'べんきょう', typeRaw: ['noun or participle which takes the aux. verb suru', 'transitive verb'], kind: 'noun', suruNoun: true }, idx),
    ['Takes を: (something) を 勉強する.']);
});
test('vocab V2 katakana', () => {
  assert.deepEqual(vocabTips({ word: 'コーヒー', reading: 'コーヒー', typeRaw: ['noun'], kind: 'noun' }, vocabIndex([])),
    ['Katakana word — read the romaji aloud, it is usually a borrowed word: koohii.']);
});
