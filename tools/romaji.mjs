// romaji.mjs — kana → romaji (PRD §6.3). Pure. Hepburn consonants, long vowels as spelled.
const BASE = {
  あ:'a',い:'i',う:'u',え:'e',お:'o',
  か:'ka',き:'ki',く:'ku',け:'ke',こ:'ko', が:'ga',ぎ:'gi',ぐ:'gu',げ:'ge',ご:'go',
  さ:'sa',し:'shi',す:'su',せ:'se',そ:'so', ざ:'za',じ:'ji',ず:'zu',ぜ:'ze',ぞ:'zo',
  た:'ta',ち:'chi',つ:'tsu',て:'te',と:'to', だ:'da',ぢ:'ji',づ:'zu',で:'de',ど:'do',
  な:'na',に:'ni',ぬ:'nu',ね:'ne',の:'no',
  は:'ha',ひ:'hi',ふ:'fu',へ:'he',ほ:'ho', ば:'ba',び:'bi',ぶ:'bu',べ:'be',ぼ:'bo',
  ぱ:'pa',ぴ:'pi',ぷ:'pu',ぺ:'pe',ぽ:'po',
  ま:'ma',み:'mi',む:'mu',め:'me',も:'mo',
  や:'ya',ゆ:'yu',よ:'yo',
  ら:'ra',り:'ri',る:'ru',れ:'re',ろ:'ro',
  わ:'wa',ゐ:'i',ゑ:'e',を:'o',ん:'n',
  ゔ:'vu',
  ぁ:'a',ぃ:'i',ぅ:'u',ぇ:'e',ぉ:'o',
};
// Two-kana combinations (checked before single kana). Keys are hiragana.
const DIGRAPH = {
  きゃ:'kya',きゅ:'kyu',きょ:'kyo', ぎゃ:'gya',ぎゅ:'gyu',ぎょ:'gyo',
  しゃ:'sha',しゅ:'shu',しょ:'sho', じゃ:'ja',じゅ:'ju',じょ:'jo',
  ちゃ:'cha',ちゅ:'chu',ちょ:'cho', ぢゃ:'ja',ぢゅ:'ju',ぢょ:'jo',
  にゃ:'nya',にゅ:'nyu',にょ:'nyo', ひゃ:'hya',ひゅ:'hyu',ひょ:'hyo',
  びゃ:'bya',びゅ:'byu',びょ:'byo', ぴゃ:'pya',ぴゅ:'pyu',ぴょ:'pyo',
  みゃ:'mya',みゅ:'myu',みょ:'myo', りゃ:'rya',りゅ:'ryu',りょ:'ryo',
  // katakana extensions (rule 2), expressed in hiragana after folding
  てぃ:'ti',でぃ:'di',とぅ:'tu',どぅ:'du',でゅ:'dyu',
  ふぁ:'fa',ふぃ:'fi',ふぇ:'fe',ふぉ:'fo',
  うぃ:'wi',うぇ:'we',うぉ:'wo',
  ゔぁ:'va',ゔぃ:'vi',ゔぇ:'ve',ゔぉ:'vo',
  しぇ:'she',じぇ:'je',ちぇ:'che',
  つぁ:'tsa',つぇ:'tse',つぉ:'tso',
};

function fold(ch) {
  const c = ch.codePointAt(0);
  // katakana ァ(30A1)…ヶ(30F6) → hiragana; ヴ(30F4) → ゔ(3094)
  if (c >= 0x30a1 && c <= 0x30f6) return String.fromCodePoint(c - 0x60);
  return ch;
}

export class RomajiError extends Error {}

/** @returns {{romaji: string, droppedSokuon: number}} */
export function toRomajiDetailed(input) {
  const s = [...String(input)].map(fold);
  const out = [];           // array of syllable strings (plus '.'/'-' markers)
  let pendingSokuon = 0;
  let dropped = 0;
  const lastVowel = () => {
    for (let i = out.length - 1; i >= 0; i--) {
      const m = /[aeiou]$/.exec(out[i]);
      if (m) return m[0];
      if (out[i] === '.' || out[i] === '-') continue;
      return null;
    }
    return null;
  };
  const push = (syl) => {
    if (pendingSokuon) {
      const first = syl[0];
      if (/[bcdfghjkmprstvwz]/.test(first)) {
        const dbl = syl.startsWith('ch') ? 't' : first;
        // っ carried across an okurigana dot (もっ.て): the doubled consonant goes before the dot.
        if (out[out.length - 1] === '.') out[out.length - 1] = dbl + '.';
        else syl = dbl + syl;
      } else {
        dropped += 1;
      }
      pendingSokuon = 0;
    }
    out.push(syl);
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '.' || ch === '-') {
      if (pendingSokuon && ch === '-') { dropped += 1; pendingSokuon = 0; }
      out.push(ch);
      continue;
    }
    if (ch === 'っ') { if (pendingSokuon) dropped += 1; pendingSokuon = 1; continue; }
    if (ch === 'ー') {
      const v = lastVowel();
      if (!v) throw new RomajiError(`ー with no preceding vowel in "${input}"`);
      push(v);
      continue;
    }
    const pair = ch + (s[i + 1] || '');
    if (DIGRAPH[pair]) { push(DIGRAPH[pair]); i++; continue; }
    if (BASE[ch] === undefined) throw new RomajiError(`unknown character "${ch}" in "${input}"`);
    push(BASE[ch]);
  }
  if (pendingSokuon) dropped += 1;
  // ん → n' before a vowel or y
  let str = '';
  for (let i = 0; i < out.length; i++) {
    const syl = out[i];
    str += syl;
    if (syl === 'n' && i + 1 < out.length && /^[aeiouy]/.test(out[i + 1])) str += "'";
  }
  return { romaji: str, droppedSokuon: dropped };
}

export function toRomaji(input) {
  return toRomajiDetailed(input).romaji;
}
