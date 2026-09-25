import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildForms, detectKind } from '../tools/forms.mjs';
import { labelsFor, WordTypeError } from '../tools/wordtype.mjs';

const G = (e) => [`Godan verb with '${e}' ending`, 'transitive verb'];
const forms = (w, r, t) => buildForms(w, r, t).forms?.map((f) => f.form);

const VERBS = [
  ['盗む','ぬすむ',G('mu'),['盗みます','盗んで','盗まない','盗んだ']],
  ['食べる','たべる',['Ichidan verb','transitive verb'],['食べます','食べて','食べない','食べた']],
  ['話す','はなす',G('su'),['話します','話して','話さない','話した']],
  ['買う','かう',G('u'),['買います','買って','買わない','買った']],
  ['待つ','まつ',G('tsu'),['待ちます','待って','待たない','待った']],
  ['書く','かく',G('ku'),['書きます','書いて','書かない','書いた']],
  ['泳ぐ','およぐ',G('gu'),['泳ぎます','泳いで','泳がない','泳いだ']],
  ['遊ぶ','あそぶ',G('bu'),['遊びます','遊んで','遊ばない','遊んだ']],
  ['死ぬ','しぬ',G('nu'),['死にます','死んで','死なない','死んだ']],
  ['帰る','かえる',G('ru'),['帰ります','帰って','帰らない','帰った']],
  ['愛する','あいする',['suru verb - special class','transitive verb'],['愛します','愛して','愛しない','愛した']],
  ['来る','くる',['Kuru verb - special class'],['来ます','来て','来ない','来た']],
  ['高い','たかい',['adjective'],['高くない','高かった','高くて']],
  ['静か','しずか',['adjectival nouns or quasi-adjectives'],['静かな','静かじゃない','静かだった']],
  ['勉強','べんきょう',['noun','noun or participle which takes the aux. verb suru'],['勉強する','勉強します','勉強して']],
];
for (const [w, r, t, want] of VERBS) test(`forms ${w}`, () => assert.deepEqual(forms(w, r, t), want));

test('forms carry kana reading + romaji', () => {
  const f = buildForms('盗む', 'ぬすむ', G('mu')).forms[1];
  assert.deepEqual(f, { label: 'て-form', form: '盗んで', reading: 'ぬすんで', romaji: 'nusunde' });
  assert.equal(buildForms('来る','くる',['Kuru verb - special class']).forms[2].reading, 'こない');
});
test('いい has no forms and is not "skipped"', () => {
  assert.deepEqual(buildForms('いい', 'いい', ['adjective']), { kind: 'adj-i', forms: null, skipped: false });
});
test('guard: final kana mismatch → no forms, skipped', () => {
  assert.deepEqual(buildForms('盗', 'ぬすむ', G('mu')), { kind: 'verb-u', forms: null, skipped: true });
  assert.equal(buildForms('食べ', 'たべ', ['Ichidan verb']).skipped, true);
});
test('行く is never conjugated by the plain く rule', () => {
  assert.equal(buildForms('行く', 'いく', G('ku')).forms, null);
});
test('kind priority: Godan beats noun', () => {
  assert.equal(detectKind(['noun', "Godan verb with 'ru' ending"]).kind, 'verb-u');
  assert.equal(detectKind(['adverb', 'noun']).kind, 'adverb');
  assert.equal(detectKind(['pronoun']).kind, 'other');
});
test('word-type labels: order kept, de-duplicated, unmapped throws', () => {
  assert.deepEqual(labelsFor(['noun, used as a suffix', 'suffix', "Godan verb with 'mu' ending"]),
    ['suffix (attaches after a word)', 'う-verb (Group 1)']);
  assert.throws(() => labelsFor(['made-up pos']), WordTypeError);
});
