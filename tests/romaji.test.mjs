import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRomaji, toRomajiDetailed, RomajiError } from '../tools/romaji.mjs';

const GOLDEN = [
  ['きせつ','kisetsu'],['とうきょう','toukyou'],['おおきい','ookii'],['せんせい','sensei'],
  ['がっこう','gakkou'],['きって','kitte'],['まっちゃ','matcha'],['しんぶん','shinbun'],
  ['きんえん',"kin'en"],['しんや',"shin'ya"],['ほんや',"hon'ya"],['コーヒー','koohii'],
  ['パーティー','paatii'],['ファイル','fairu'],['ジュース','juusu'],['ちゃ','cha'],
  ['しゅっぱつ','shuppatsu'],['ぬすむ','nusumu'],['た.つ','ta.tsu'],['-べ','-be'],
  ['ヴァイオリン','vaiorin'],['ウォーク','wooku'],['づ','zu'],['を','o'],
];
for (const [kana, want] of GOLDEN) {
  test(`romaji ${kana} → ${want}`, () => assert.equal(toRomaji(kana), want));
}
test('っ before しゃ doubles s', () => assert.equal(toRomaji('いっしょ'), 'issho'));
test('っ carried across an okurigana dot', () => {
  assert.equal(toRomaji('もっ.て'), 'mot.te');
  assert.equal(toRomaji('ほっ.する'), 'hos.suru');
});
test('ん never becomes m', () => assert.equal(toRomaji('さんぽ'), 'sanpo'));
test('word-final っ is dropped and counted', () => {
  assert.deepEqual(toRomajiDetailed('あっ'), { romaji: 'a', droppedSokuon: 1 });
});
test('unknown characters are an error', () => {
  assert.throws(() => toRomaji('漢'), RomajiError);
  assert.throws(() => toRomaji('abc'), RomajiError);
});
