# PRD — JLPT_prep ("cover it before you test it")

**Status:** Revision 1 — structured by Fable 5.1 on 2026-09-25 from the owner's brief. All decisions
locked except the **one [CONFIRM]** item in §15. Ready for the default model to build.
**Owner:** Sangeeth · **Repo (to create):** github.com/sangeeth-subramoniam/JLPT_prep (public)
**Live URL (after P5):** https://sangeeth-subramoniam.github.io/JLPT_prep/
**Sister project:** Kanji Commute (`../japanese_learning_bot`, PRD rev 2 + §17–§20). JLPT_prep
**reuses its generated data**, nothing else. It is a separate app, separate repo, separate storage.

---

## 0. How to read this document
Implement exactly; do not re-litigate. §4 = locked decisions. §5 = functional requirements
(FR-n). §6 = data pipeline, **normative** (romaji, word-type labels, forms, tips, validation gate —
all unit-tested with `node --test`). §7 = storage. §11 = acceptance criteria (AC-n, the definition
of done). §12 = build order. §15 = the single item the owner still has to confirm.

Owner's brief, verbatim (2026-09-25), kept so intent is never lost:
> "very simple one which only focuses on only one function at a time … only jlpt n4, n3 and n3 [sic]
> to be selected in the first page. inside each selection have vocabulary cards and kanji cards. no
> testing but just the card, the kanji, the usage with romaji also so that I can easily grasp what it
> is. the cards should be properly numbered. on long pressing the cards I will be able to update the
> status of that card to done or pending or review (a small colour patch not covering the whole card
> but a small square in the right most …). this is for me to cover things first before testing
> myself. each card can be opened to see the full content (one page content, usage and tips and
> tricks if available … beginner friendly). once I open all cards and set the statuses and when all
> the statuses are green (done) then that means I have completed all vocabulary or kanji
> corresponding to that level."

---

## 1. Problem & context
Kanji Commute drills by *testing* (SRS flashcards, grades). Before being tested, the owner wants to
**cover** the material: read every kanji and every vocabulary word of a level once, in a calm,
numbered list, marking each one *done / review / pending* by hand. The signal of completion is
simple and visual: **every square in the list is green**.

The owner is a beginner-to-intermediate reader who wants **romaji next to every reading** so nothing
on a card is a puzzle, and wants each card to open into a single, beginner-friendly page: what it
means, how it is read, how it is used, and any tip that helps it stick.

## 2. Goals
- **G1.** One screen, one job. Home → level → deck → numbered list → card page. Nothing else.
- **G2.** Complete, accurate N4/N3/N2 kanji and vocabulary, each card with kana **and romaji**.
- **G3.** Three-state manual status per card (Pending / Review / Done), set by **long press** on the
  list row, shown as a **small square at the right edge** of the row. Persisted per device.
- **G4.** A deck is "completed" exactly when every card is Done; the level is completed when both of
  its decks are. This is visible without opening anything.
- **G5.** Offline-capable installable PWA on GitHub Pages, zero backend, zero accounts.

## 3. Non-goals (v1)
- **NG1.** No testing, quizzing, grading, spaced repetition, streaks, or scores of any kind.
- **NG2.** No sync between devices (export/import of the status file is the only escape hatch, §5.7).
- **NG3.** No N5 and no N1 decks. No grammar deck. (All are trivial to add later; see §14.)
- **NG4.** No search box, no sorting options, no custom decks, no editing of card content in-app.
- **NG5.** No audio, no stroke-order animation, no handwriting.
- **NG6.** No example *sentences* in v1 (needs a licensed sentence corpus + a morphological analyser
  for sentence romaji; deferred to §14 with the chosen source named).
- **NG7.** No shared code with Kanji Commute. Copy nothing but data; this app has no SRS.

## 4. Product decisions (locked) **[DECIDED]**
| Area | Decision |
|---|---|
| Levels | **N4, N3, N2** — three buttons on the home page, in that order. *(The brief says "n4, n3 and n3"; N2 is assumed because the owner is preparing for N2 — §15 [CONFIRM].)* |
| Decks per level | Exactly two: **Kanji** and **Vocabulary**. |
| Vocabulary deck membership | The level's full tanos vocabulary list = Kanji Commute's `vocab/<L>.json` **∪** `compounds/<L>.json` (that split was a Kanji Commute UI decision; here they are one deck). N4 = 663, N3 = 2139, N2 = 1792 cards. |
| Kanji deck membership | Kanji Commute's `<L>.json` (tanos-derived, byte-audited against tanos PDFs). N4 = 166, N3 = 367, N2 = 367. |
| Card order & numbering | Order = source order (frequency, most common first). **Number = 1-based position in the deck file**, shown on every row and card page. Numbers are stable because the deck files are frozen (§6.8); regeneration must be order-preserving. |
| Card identity (storage key) | Kanji: the character. Vocabulary: **`word\|reading`** (homograph-safe, inherited from Kanji Commute §17.4). Never the number. |
| Status model | Three values: `pending` (default, stored as *absence*), `review`, `done`. Manual only — opening a card changes nothing. |
| Status gesture | **Long press (500 ms) on a list row** opens a status sheet. Right-click / `contextmenu` opens the same sheet on desktop. The card page also carries the same three buttons (convenience; the row gesture is the primary path). |
| Status indicator | A **14 px square** at the right edge of the row: Pending = grey outline, Review = amber fill, Done = green fill. Never colour the whole row. |
| Completion | Deck complete ⇔ `done == total`. Level complete ⇔ both decks complete. Shown as a ✓ and a one-line "Completed" banner; no confetti, no score. |
| Romaji style | **Hepburn consonants, long vowels written as the kana spell them** (とうきょう → *toukyou*, おおきい → *ookii*). Matches how the owner types Japanese. Exact rules §6.3. |
| "Usage" on a card | Kanji: every reading shown **inside a real word**, plus up to 4 words. Vocabulary: plain-English word type + kanji pieces + **rule-generated forms** (ます/て/ない/た etc.). Sentences are v2. |
| "Tips & tricks" | **Rule-generated only**, from data already in the deck (§6.6). Never hand-written per card, never scraped. A card with no applicable rule shows no Tips section. |
| Platform | Static HTML + CSS + vanilla JS (ES modules) + JSON. No framework, no bundler, no runtime dependency. Generator runs in Node ≥ 20, no npm packages. |
| Hosting | **GitHub Pages** from `main`, repo root. Public repo `sangeeth-subramoniam/JLPT_prep` (the `gh` CLI is already signed in as this account; the older app lives under a different org — do not mix them). |
| Offline | Service worker precaches the shell **and all six decks** (≈2–3 MB; exact size recorded in `data/README.md`). Offline from the first visit. |
| Storage | `localStorage`, per device, written through on every change and held in memory (§7). |
| Fonts | System fonts only (no webfont fetch): `-apple-system, "Hiragino Sans", "Noto Sans CJK JP", "Yu Gothic", sans-serif`. |

---

## 5. Functional requirements

### 5.1 Home (route `#/`)
- **FR-1.** Three large buttons: **N4**, **N3**, **N2**. Each shows a one-line summary underneath:
  `Kanji 12 / 166 · Vocabulary 0 / 663` (done / total), and a ✓ when the level is complete.
- **FR-2.** A footer with the EDRDG attribution and a **Settings** link (§5.7). Nothing else.

### 5.2 Level page (route `#/N3`)
- **FR-3.** Two tiles: **Kanji (367)** and **Vocabulary (2139)**. Each tile shows done / review /
  pending counts, a thin progress bar (done share), and ✓ + "Completed" when done == total.
- **FR-4.** Back arrow to Home. Browser Back must also work (hash routing).

### 5.3 Card list (route `#/N3/kanji`, `#/N3/vocab`)
- **FR-5.** One row per card, in deck order, **numbered** (`12`), tappable. Row content:
  - Kanji row: `12 · 発 · Departure · hatsu` (number, kanji large, primary meaning, romaji of the
    first on-reading — or first kun reading if no on).
  - Vocabulary row: `100 · 季節 · きせつ · kisetsu · season` (number, word, kana, romaji, first
    meaning, ellipsised to one line).
  - Right edge: the **status square** (§4). Its `aria-label` is the status word.
- **FR-6.** Filter chips at the top: **All · Pending · Review · Done**, each with its count. Default
  All. The chip choice is per-deck and remembered (§7.3).
- **FR-7.** Header: deck name, `done / total`, and the ✓ + "Completed" banner when complete.
- **FR-8.** Tap a row → card page. **Long press** a row → status sheet (§5.4). The tap must not fire
  after a long press.
- **FR-9.** Returning from a card page restores the previous scroll position and filter.
- **FR-10.** Lists up to 2139 rows must scroll smoothly on a phone. Rendering may be chunked (e.g.
  200 rows, then the rest on idle) but the DOM must eventually contain every row so the filter counts
  and find-in-page work; no virtual scrolling library.

### 5.4 Status sheet (long press)
- **FR-11.** Gesture: `pointerdown` starts a **500 ms** timer; cancelled by `pointerup`,
  `pointercancel`, scroll, or movement > **10 px**. On fire: `navigator.vibrate?.(10)`, open the
  sheet, and swallow the next `click` on that row. `contextmenu` on a row: `preventDefault()` and
  open the sheet (desktop right-click; Android also synthesises it on long press — if the sheet is
  already open, ignore). Rows carry `-webkit-touch-callout: none; user-select: none`.
- **FR-12.** The sheet is a bottom sheet: the card's headline (`発 · Departure` / `季節 · kisetsu`),
  three full-width buttons **Pending · Review · Done**, each with its coloured square, the current one
  marked; and **Cancel**. Tapping a status writes through immediately (§7), updates that row's square
  in place (no full re-render), updates the header counts and filter chip counts, and closes.
- **FR-13.** If the active filter now excludes the card (e.g. filter = Pending, card set to Done), the
  row fades out and is removed; the list does not jump.

### 5.5 Card page — Kanji (route `#/N3/kanji/12`)
Content order is **normative** (mirrors the lesson layout the owner approved in Kanji Commute §20.2,
plus romaji everywhere). Nothing is collapsed or hidden behind a tap.
- **FR-14.** Header: `N3 · Kanji · 12 / 367`, ‹ Prev / Next › buttons (wrap disabled at the ends),
  and the three status buttons (same behaviour as the sheet).
- **FR-15.** Body, in order:
  1. The kanji, very large.
  2. **Meaning** — `primary`, headline size.
  3. Context line: `9 strokes · grade 3 · JLPT N3` (omit a missing part silently).
  4. **How it is read** — every reading as a row: kana, **romaji**, on/kun label, and the word that
     proves it: `ハツ · hatsu · on · 不発 ふはつ fuhatsu — misfire`. A reading with no word shows
     `— rare, skip for now` instead of a word.
  5. **Pieces you can spot** — components as `char + name` chips, or the sentence
     "It is a single piece" when there are none.
  6. **Words you will meet** — up to 4: `一発 · いっぱつ · ippatsu · one shot; one charge`.
  7. **Also means** — remaining glosses, de-emphasised. Omitted when empty.
  8. **Tips** — 1–3 generated tips (§6.6). Omitted when empty.

### 5.6 Card page — Vocabulary (route `#/N3/vocab/100`)
- **FR-16.** Header as FR-14 (`N3 · Vocabulary · 100 / 2139`).
- **FR-17.** Body, in order:
  1. The word, very large. Underneath: kana reading and **romaji**, both prominent.
  2. **Meaning** — all glosses, first one headline size.
  3. **Word type** — plain-English labels (§6.4), e.g. `う-verb (Group 1) · transitive (uses を)`.
  4. **Pieces** — the kanji breakdown chips `季 season · 節 occasion`, with reading + romaji per part
     when the part has a reading. Omitted for kana-only words.
  5. **Forms you will see** — the generated forms table (§6.5): label · form · kana · romaji.
     Omitted when the word has no forms.
  6. **Tips** — 1–3 generated tips (§6.6). Omitted when empty.

### 5.7 Settings (route `#/settings`)
- **FR-18.** **Export progress** → downloads `jlptprep-progress-YYYY-MM-DD.json` (all status keys).
- **FR-19.** **Import progress** → file picker; merges (imported `review`/`done` overwrite; imported
  absence never clears a local status) after a confirm dialog that states the counts.
- **FR-20.** **Reset** per deck and **Reset everything**, each behind a confirm dialog.
- **FR-21.** Data provenance + licence text (EDRDG CC BY-SA; tanos lists; "data generated by the
  Kanji Commute pipeline") and the app version (`CACHE` name).

### 5.8 Global
- **FR-22.** Never show a percentage, grade, streak, or the words "wrong"/"score" anywhere.
- **FR-23.** Every screen has a back arrow; browser Back and Forward work at every route (hash
  router). Unknown routes redirect to Home.
- **FR-24.** Light and dark themes via `prefers-color-scheme`; status colours keep ≥ 3:1 contrast
  against the row background in both.
- **FR-25.** All copy in English; Japanese only in card content.

---

## 6. Data pipeline (normative)

### 6.1 Sources
JLPT_prep does **not** fetch any dictionary. Its single input is Kanji Commute's committed,
already-validated data (`../japanese_learning_bot/data/`, path overridable with `--source`):

| Deck | Input files | Records used |
|---|---|---|
| Kanji L | `<l>.json` (with §20 lesson fields) | all |
| Vocabulary L | `vocab/<l>.json` then `compounds/<l>.json` | all, concatenated in that order |

Lineage (must appear in `data/README.md` and Settings): kanji readings/meanings/strokes/grade from
**KANJIDIC2**; components from **KRADFILE** with English names authored in Kanji Commute; example
words, POS, readings from **JMdict**; level membership from **tanos.co.uk** via
`jamsinclair/open-anki-jlpt-decks`. KANJIDIC2/KRADFILE/JMdict are © **EDRDG**, **CC BY-SA**.
Romaji, word-type labels, forms and tips are **derived here by rules** (§6.3–§6.6).

### 6.2 Output files & schemas
```
data/manifest.json
data/N4/kanji.json   data/N4/vocab.json
data/N3/kanji.json   data/N3/vocab.json
data/N2/kanji.json   data/N2/vocab.json
data/README.md       (generated: counts, sizes, validation report, lineage)
```
`manifest.json`:
```json
{ "generated": "2026-09-25", "levels": ["N4","N3","N2"],
  "decks": { "N4": { "kanji": { "file": "N4/kanji.json", "count": 166 },
                     "vocab": { "file": "N4/vocab.json", "count": 663 } }, "N3": {…}, "N2": {…} } }
```
Kanji card (array element; `n` is 1-based and equals index + 1):
```json
{ "n": 12, "id": "発", "kanji": "発", "primary": "Departure",
  "meanings": ["Departure","Discharge","Publish"], "strokes": 9, "grade": 3,
  "readings": [
    { "kana": "ハツ", "romaji": "hatsu", "type": "on",
      "word": "不発", "wordReading": "ふはつ", "wordRomaji": "fuhatsu", "meaning": "misfire" },
    { "kana": "た.つ", "romaji": "ta.tsu", "type": "kun" } ],
  "components": [ { "char": "二", "name": "two" } ],
  "words": [ { "word": "一発", "reading": "いっぱつ", "romaji": "ippatsu", "meaning": "one shot; one charge" } ],
  "tips": [ "Most of these words use the reading ハツ (hatsu)." ] }
```
`components` may be `null`; `words` = Kanji Commute's `words` filtered exactly as its lesson list
is (no digits, latin, or katakana counters); `meanings[0]` may equal `primary`.

Vocabulary card:
```json
{ "n": 100, "id": "季節|きせつ", "word": "季節", "reading": "きせつ", "romaji": "kisetsu",
  "meanings": ["season (in reference to weather)"],
  "type": ["noun", "noun (can take の)"], "typeRaw": ["noun","nouns which may take the genitive case particle 'no'"],
  "kind": "noun",
  "breakdown": [ { "part": "季", "reading": null, "romaji": null, "meaning": "season (in nature, sports, etc.)" } ],
  "forms": null,
  "tips": [] }
```
`kind` ∈ `noun | verb-u | verb-ru | verb-suru | verb-kuru | adj-i | adj-na | adverb | other`.
`breakdown` `null` for kana-only words. `forms` = array of `{ label, form, reading, romaji }` or
`null`. **Drop** every field not listed (`freq`, `level`, `examples`, `onyomi`, `kunyomi` …) — the
app must not depend on anything the schema does not name.

### 6.3 Romaji (`tools/romaji.mjs`, pure, unit-tested)
Input: a hiragana/katakana string that may also contain the markers `.` (okurigana boundary) and
`-` (prefix/suffix marker), and `ー`. Output: lowercase ASCII plus `'`, `.`, `-`.
1. **Consonants: Hepburn.** し *shi*, ち *chi*, つ *tsu*, ふ *fu*, じ/ぢ *ji*, ず/づ *zu*, を *o*,
   しゃ/しゅ/しょ *sha/shu/sho*, ちゃ… *cha/chu/cho*, じゃ… *ja/ju/jo*, きゃ *kya*, にゃ *nya*, ひゃ
   *hya*, みゃ *mya*, りゃ *rya*, ぎゃ *gya*, びゃ *bya*, ぴゃ *pya*.
2. **Katakana extensions:** ティ *ti*, ディ *di*, トゥ *tu*, ドゥ *du*, デュ *dyu*, ファ/フィ/フェ/フォ
   *fa/fi/fe/fo*, ウィ/ウェ/ウォ *wi/we/wo*, ヴ *vu*, ヴァ/ヴィ/ヴェ/ヴォ *va/vi/ve/vo*, シェ *she*, ジェ
   *je*, チェ *che*, ツァ/ツェ/ツォ *tsa/tse/tso*. Katakana is treated exactly like hiragana otherwise.
3. **Long vowels are written as spelled:** おう *ou*, おお *oo*, えい *ei*, うう *uu*, ああ *aa*. No
   macrons, no *oh*. **ー** repeats the previous vowel (コーヒー *koohii*).
4. **っ/ッ** doubles the next consonant (きって *kitte*, がっこう *gakkou*); before ち → *tchi*
   (まっちゃ *matcha*); before しゃ → *ssha*. A っ with no following consonant (word-final, or before a
   vowel) is dropped and counted in the validation report.
5. **ん/ン** → *n*; **n'** before a vowel or *y* (きんえん *kin'en*, しんや *shin'ya*). Never *m*.
6. Small vowel kana ぁぃぅぇぉ not consumed by rule 2 → the plain vowel.
7. `.` and `-` pass through unchanged, in place (た.つ → *ta.tsu*, -べ → *-be*).
8. **Any other character is an error** (the generator hard-fails and names the card). Kanji never
   reach this function.

Golden cases (all must be tests): きせつ *kisetsu* · とうきょう *toukyou* · おおきい *ookii* · せんせい
*sensei* · がっこう *gakkou* · きって *kitte* · まっちゃ *matcha* · しんぶん *shinbun* · きんえん *kin'en* ·
しんや *shin'ya* · ほんや *hon'ya* · コーヒー *koohii* · パーティー *paatii* · ファイル *fairu* · ジュース
*juusu* · ちゃ *cha* · しゅっぱつ *shuppatsu* · ぬすむ *nusumu* · た.つ *ta.tsu* · -べ *-be* · ヴァイオリン
*vaiorin* · ウォーク *wooku* · づ *zu* · を *o*.

### 6.4 Word-type labels (`tools/wordtype.mjs`)
Every JMdict POS string present in the N4–N2 decks maps to a beginner label; the generator fails on
an unmapped string (so a new POS is a conscious decision). `type` keeps the input order, de-duplicated.

| JMdict POS (raw) | Label |
|---|---|
| noun | noun |
| nouns which may take the genitive case particle 'no' | noun (can take の) |
| noun or participle which takes the aux. verb suru | noun · add する to make a verb |
| noun, used as a suffix / suffix | suffix (attaches after a word) |
| noun, used as a prefix / prefix | prefix (attaches before a word) |
| transitive verb | transitive (uses を) |
| intransitive verb | intransitive (no を) |
| Ichidan verb | る-verb (Group 2) |
| Ichidan verb - zuru verb | verb (〜ずる, formal) |
| Godan verb with '…' ending (any) | う-verb (Group 1) |
| suru verb - special class / suru verb - included | する-verb |
| Kuru verb - special class | 来る (irregular) |
| Nidan verb with 'u' ending | verb (classical) |
| auxiliary verb | auxiliary verb |
| adjective | い-adjective |
| adjectival nouns or quasi-adjectives | な-adjective |
| 'taru' adjective | adjective (〜たる, formal) |
| pre-noun adjectival / noun or verb acting prenominally | goes before a noun |
| adverb | adverb |
| adverb taking the 'to' particle | adverb (often with と) |
| counter | counter |
| expressions | expression / set phrase |
| interjection | interjection |
| conjunction | conjunction |
| pronoun | pronoun |
| numeric | number |
| particle | particle |

### 6.5 Forms (`tools/forms.mjs`, pure, unit-tested)
**6.5.1 Kind detection** (first match wins, on `typeRaw`):
1. any `Godan verb with 'X' ending` → `verb-u`, expected final kana from X: u→う, ku→く, gu→ぐ, su→す,
   tsu→つ, nu→ぬ, bu→ぶ, mu→む, ru→る.
2. `Ichidan verb` (not zuru) → `verb-ru`, expected final kana る.
3. `suru verb - special class` / `suru verb - included` → `verb-suru`, expected final する.
4. `Kuru verb - special class` → `verb-kuru`.
5. `adjective` → `adj-i`, expected final い. **Exceptions → no forms:** reading ∈ {いい, よい,
   かっこいい}.
6. `adjectival nouns or quasi-adjectives` → `adj-na`.
7. `noun or participle which takes the aux. verb suru` → `noun` with **する forms** (below).
8. `adverb` → `adverb`; `noun` → `noun`; else `other`.

**Guard:** forms are generated only when **both** `word` and `reading` end with the expected kana
(for `verb-suru`, `word` ends in する and `reading` in する). Otherwise `forms = null` and the card is
listed in the validation report under "forms skipped". Never guess.

**6.5.2 Form sets** (suffix replaces the final kana; apply identically to `word` and `reading`, then
romaji the reading):

| kind | polite ます | て-form | negative ない | past た |
|---|---|---|---|---|
| verb-u う | 〜います | 〜って | 〜わない | 〜った |
| verb-u つ | 〜ちます | 〜って | 〜たない | 〜った |
| verb-u る | 〜ります | 〜って | 〜らない | 〜った |
| verb-u む | 〜みます | 〜んで | 〜まない | 〜んだ |
| verb-u ぶ | 〜びます | 〜んで | 〜ばない | 〜んだ |
| verb-u ぬ | 〜にます | 〜んで | 〜なない | 〜んだ |
| verb-u く | 〜きます | 〜いて | 〜かない | 〜いた |
| verb-u ぐ | 〜ぎます | 〜いで | 〜がない | 〜いだ |
| verb-u す | 〜します | 〜して | 〜さない | 〜した |
| verb-ru | 〜ます | 〜て | 〜ない | 〜た |
| verb-suru | 〜します | 〜して | 〜しない | 〜した |
| verb-kuru (来る) | 来ます きます | 来て きて | 来ない こない | 来た きた |

| kind | forms |
|---|---|
| adj-i | negative 〜くない · past 〜かった · joining 〜くて |
| adj-na | before a noun 〜な · negative 〜じゃない · past 〜だった |
| noun + する | as a verb 〜する · polite 〜します · て-form 〜して |

Labels shown in the UI are exactly the column headers above (`polite ます`, `て-form`, `negative ない`,
`past た`, `negative`, `past`, `joining`, `before a noun`, `as a verb`).

**6.5.3 Golden cases** (tests): 盗む→盗みます/盗んで/盗まない/盗んだ · 食べる→食べます/食べて/食べない/食べた ·
話す→話します/話して/話さない/話した · 買う→買います/買って/買わない/買った · 待つ→待ちます/待って/待たない/
待った · 書く→書きます/書いて/書かない/書いた · 泳ぐ→泳ぎます/泳いで/泳がない/泳いだ · 遊ぶ→遊びます/遊んで/
遊ばない/遊んだ · 死ぬ→死にます/死んで/死なない/死んだ · 帰る (Godan ru)→帰ります/帰って/帰らない/帰った ·
愛する→愛します/愛して/愛しない/愛した · 高い→高くない/高かった/高くて · 静か→静かな/静かじゃない/静かだった ·
勉強 (suru-noun)→勉強する/勉強します/勉強して · いい→null · 行く is N5 and absent; if it ever appears,
`verb-u く` would produce 行いて — add the Iku/Yuku special class (て 行って, た 行った) **before** shipping
any deck that contains it (the guard test must assert no card's `word` is 行く without that rule).

### 6.6 Tips (`tools/tips.mjs`, pure, unit-tested)
Rules only; each rule has a fixed sentence template. A card gets at most **3** tips, in the priority
order listed. Sentences are plain English, no jargon beyond *on/kun*.

**Kanji** (inputs: the card, and the whole kanji deck of the same level):
- **K1 Most common reading.** For each word in `words`, find which reading it uses (on: katakana →
  hiragana, substring of the word reading; kun: stem before `.`, prefix of the word reading at the
  kanji's position is not computable, so use substring). If one reading is used by ≥ 2 words:
  "Most of these words use the reading ハツ (hatsu)."
- **K2 Rare readings.** Readings with no `word`, when at least one reading *has* a word:
  "ホツ, た.つ are rare readings — skip them for now." (max 4 listed).
- **K3 Same sound.** Other kanji in the same level sharing the card's first on-reading (max 4):
  "Same reading ケン (ken) as 研, 験, 検 — watch for the shared piece."
- **K4 Shared piece.** A component that appears in ≥ 2 other kanji of the same level (pick the
  component with the most co-occurrences; list max 3 kanji): "The piece 癶 (feet apart) also appears
  in 登, 発."

**Vocabulary** (inputs: the card, and the whole vocabulary deck of the same level):
- **V1 Transitivity.** `transitive verb` → "Takes を: (something) を 盗む." `intransitive verb` →
  "No を — the subject does it: (something) が 起きる." Uses the card's own word.
- **V2 Katakana word.** Word is entirely katakana (ー allowed) → "Katakana word — read the romaji
  aloud, it is usually a borrowed word: koohii."
- **V3 Word family.** Other cards in the same deck whose `word` contains the card's first kanji
  (max 3, by deck order): "Same kanji 季 in: 季刊, 四季." Only when the word has ≥ 1 kanji.

### 6.7 Validation gate (blocking; the generator exits non-zero on any failure)
- Per-deck counts equal the sums in §4 (N4 663/166, N3 2139/367, N2 1792/367); `n` is contiguous
  from 1; `id` unique within a deck (the vocab ∪ compounds merge must have **0** collisions).
- Every `romaji`, `wordRomaji`, form `romaji` matches `^[a-z'.\-]+$`; every reading passed through
  §6.3 without the "unknown character" error.
- Every kanji card has `primary`, ≥ 1 reading, ≥ 1 word; every vocab card has ≥ 1 meaning and ≥ 1
  `type`.
- No `typeRaw` string outside §6.4.
- `forms`, when present, have 3 or 4 entries with non-empty `form`, `reading`, `romaji`.
- Report (to `data/README.md`): per-deck counts, file sizes, forms generated / skipped (with the
  skipped ids), tips per rule, dropped っ count, kana-only word count.

### 6.8 Frozen decks
After P1 the six deck files are frozen: numbers are user-visible and the owner will refer to them.
Any regeneration must keep every existing `n → id` pair (assert in a test against the committed
files); new cards may only be appended. If the source ever changes membership, that is a new major
version with a status-key migration — not a silent renumbering.

---

## 7. Storage
- **7.1 Keys.** `jlptprep.v1.status.<LEVEL>.<deck>` (e.g. `jlptprep.v1.status.N3.vocab`) →
  `{ "ids": { "<id>": "done" | "review" }, "updatedAt": "<ISO>" }`. Pending = key absent. Level
  and deck names are exactly `N4|N3|N2` and `kanji|vocab`.
- **7.2 Write-through, in-memory.** On first use each deck's blob is parsed once and held in
  memory; every status change mutates memory and writes the whole (small) blob back synchronously.
  No per-tap re-parse. Corrupt JSON → treat as empty and log; never throw at the user.
- **7.3 UI state.** `jlptprep.v1.ui` → `{ "filter": { "N3.vocab": "pending" }, "scroll": { "N3.vocab": 1234 } }`.
  Best-effort; wrap every read/write in try/catch.
- **7.4 Export** = `{ "app": "jlptprep", "version": 1, "exportedAt": …, "status": { "<LEVEL>.<deck>": blob } }`.
  **Import** validates `app` and `version`, then merges per §5.7 (FR-19).
- **7.5 Completion** is derived, never stored: `done == deck.count`.

---

## 8. UI / UX
- Mobile-first, one-handed. Minimum tap target 44 px. Rows ≈ 56 px high.
- **Colour tokens** (light / dark): `--done #1f9d55 / #34c759`, `--review #e6961e / #f5b342`,
  `--pending-outline #9aa0a6 / #6b7078`, bg `#ffffff / #12141c`, text `#1a1a1a / #e8e8ee`.
- Japanese text: kanji glyph 72 px on card pages, 28 px in rows; kana 18 px; romaji 15 px muted.
- The status square is `14 × 14 px`, `border-radius 3px`, vertically centred, 16 px from the right
  edge; pending = 2 px outline, no fill.
- Bottom sheet: slides up, backdrop tap = Cancel, `Esc` = Cancel, focus trapped.
- Card page: swipe left/right is **not** required; Prev/Next buttons and ←/→ keys are.
- Empty filter result: one sentence ("Nothing under Review yet."), no illustration.

## 9. Non-functional
- **PWA:** `manifest.webmanifest` (name "JLPT Prep", short_name "JLPT", standalone, portrait),
  `sw.js` precaching shell + all decks, `CACHE = 'jlpt-prep-v1'`, old caches purged on activate.
  Bump `CACHE` on every deploy.
- **Performance:** cold load ≤ 2 s on a mid-range phone after install; list of 2139 rows interactive
  ≤ 300 ms after data is in memory (chunked render allowed, FR-10).
- **Size:** total precache ≤ 4 MB. If the N3 vocab deck exceeds 1 MB, strip `typeRaw` from the
  shipped file (keep it in the generator) — measure first.
- **Tests:** `node --test` covers romaji goldens, forms goldens, tips rules, validation gate on the
  committed data, frozen-order assertion, storage (set/unset/merge-import/export round-trip),
  completion derivation. Pure modules under `tools/` and `js/` take no DOM.
- **No runtime dependencies, no build step**; `python3 -m http.server` is the dev server.

## 10. Architecture / file layout
```
JLPT_prep/
  index.html            shell + <template>s for views
  css/styles.css
  js/app.js             hash router + views (home, level, list, card, settings)
  js/store.js           status storage (§7), pure except localStorage access
  js/gesture.js         long-press + contextmenu → status sheet
  js/data.js            manifest + deck loading (fetch, cached in memory)
  sw.js  manifest.webmanifest  icons/icon-192.png  icons/icon-512.png
  data/                 §6.2 (generated, committed, frozen)
  tools/build_data.mjs  reads --source (default ../japanese_learning_bot/data), writes data/
  tools/romaji.mjs  tools/wordtype.mjs  tools/forms.mjs  tools/tips.mjs   (pure)
  tests/*.test.mjs
  PRD.md  CLAUDE.md  README.md  .gitignore
```

## 11. Acceptance criteria (definition of done)
- **AC-1.** Home shows exactly N4, N3, N2 with live done/total summaries; each opens its level page.
- **AC-2.** Each level page shows Kanji and Vocabulary tiles with counts matching §4 totals.
- **AC-3.** Every list row shows its number, content per FR-5, and a status square at the right edge;
  numbers run 1…count without gaps.
- **AC-4.** Long press (touch) and right-click (desktop) open the status sheet; a plain tap opens the
  card page; a long press never also opens the card page.
- **AC-5.** Setting Done/Review/Pending updates the square in place, persists across reload, and is
  reflected in header, chip counts, level page, and home.
- **AC-6.** Setting every card in a deck to Done shows ✓ + "Completed" on the list header, the level
  tile, and the home summary; clearing one card removes it.
- **AC-7.** Kanji card page shows all eight sections of FR-15 in order, with romaji on every reading
  and every word; vocabulary card page shows FR-17 likewise. No section is behind a tap.
- **AC-8.** All §6.3 and §6.5.3 golden cases pass; §6.7 gate passes on the committed data; the
  frozen-order test passes.
- **AC-9.** Export produces a file that, after "Reset everything" and Import, restores every status.
- **AC-10.** Airplane mode after one visit: every route, every deck, every card page works.
- **AC-11.** Live at https://sangeeth-subramoniam.github.io/JLPT_prep/ from repo
  `sangeeth-subramoniam/JLPT_prep`; installable (Add to Home Screen) on iOS Safari and Android Chrome.
- **AC-12.** No percentage, grade, streak or score text exists in the codebase's UI strings (grep).
- **AC-13 (owner gate).** Owner covers one deck section on the phone: opens ~20 cards, long-presses
  statuses, filters by Review, reopens after a day — and confirms it feels like *covering*, not testing.

## 12. Milestones / build order
| # | Milestone | Done when |
|---|---|---|
| **P0** | Scaffold | Local repo at `~/Desktop/code/JLPT_prep`; `gh auth status` active account is `sangeeth-subramoniam` (switch with `gh auth switch` if not); **owner confirmed** the repo may be created public (§15); `gh repo create sangeeth-subramoniam/JLPT_prep --public`; Pages = `main` / root. |
| **P1** | Data | `tools/*.mjs` + tests green; `data/` generated, §6.7 gate passes, README written, decks frozen (commit). |
| **P2** | Shell + list + status | Home, level, list, filter chips, long-press sheet, storage. AC-1–AC-6. |
| **P3** | Card pages | Kanji + vocab pages, Prev/Next, status buttons. AC-7. |
| **P4** | Settings + PWA | Export/import/reset, sw.js precache, manifest, icons. AC-9, AC-10 (local). |
| **P5** | Deploy + verify | Pages green, AC-10 on the live URL, AC-11, AC-12; hand AC-13 to the owner. |

## 13. Risks
- **R1. Long press vs scroll on iOS.** Cancel on any movement > 10 px and on `scroll`; never call
  `preventDefault` on `touchstart` (it kills scrolling). Test on a real iPhone in P2, not at the end.
- **R2. Forms correctness.** Rule-based conjugation is only as good as the POS tag. The §6.5 guard
  (final kana must match) plus the skipped-list in the README keep bad output out; review the skipped
  list once in P1 and accept it.
- **R3. Tips that sound wrong.** Templates are fixed and factual (they only restate deck data). If
  a rule misfires on inspection, drop the rule, do not patch individual cards.
- **R4. Renumbering.** Guarded by §6.8; a membership change is a major version.
- **R5. Big lists on old phones.** Chunked rendering (FR-10); measure N3 vocab on the phone in P2.
- **R6. Wrong GitHub account.** Two accounts are signed into `gh`; P0 checks the active one.

## 14. Future (v2, prioritised)
1. **Example sentences** with kana + romaji, from the **Tatoeba/Tanaka corpus** (CC BY 2.0 FR,
   distributed with JMdict tooling) and `kuromoji` in the generator for sentence readings.
2. N5 and N1 decks (data already exists in Kanji Commute; N1 kanji lack lesson fields).
3. Grammar deck (reuse Kanji Commute's authored N2 grammar; still no scraping).
4. "Mark all in view" bulk action, and a jump-to-number box.
5. Optional link from a Done deck into Kanji Commute's quiz for the same level.

## 15. Open item for the owner **[CONFIRM]**
1. **Levels = N4, N3, N2?** The brief says "n4, n3 and n3". Assumed N2 for the third. If it should be
   **N5, N4, N3** instead, only §4's level row, the counts in §4/§6.7 (N5: kanji 79, vocab 713) and the
   home order change; nothing structural.

Everything else in this document is decided. Choices made on the owner's behalf, listed so they can be
overruled in one line if wanted: vocabulary deck = vocab ∪ compounds (one deck, §4); romaji writes
long vowels as spelled (§6.3 rule 3); "usage" for vocabulary = word type + pieces + generated forms,
sentences deferred (§4/NG6); status buttons also on the card page (§4); export/import in Settings
(§5.7); repo is created public under `sangeeth-subramoniam` (P0 asks once before creating it).

---
## 16. Build notes (P1–P4, default model, 2026-09-25)
Everything in §4–§11 is implemented as written, except these deliberate, recorded deviations:
- **Word type can be empty (§6.7 relaxed).** 314 vocabulary cards (N4 71, N3 92, N2 151, almost all
  kana-only words such as もらう, しっかり) arrive from Kanji Commute with no JMdict POS. §6.1 forbids
  fetching a dictionary here and §6.5 forbids guessing, so they ship with `type: []`, no Word type
  section and no forms. The gate still fails any card whose source *has* a POS but no label. Fixing
  it properly = upstream in Kanji Commute's `build_vocab.mjs` (kana-only JMdict lookup), then regenerate.
- **K3 tip wording.** "… — watch for the shared piece" was factually wrong for most same-reading sets
  (政 / 性, 制, 成, 声 share no piece). Template is now "… — don't mix them up."
- **V1 tip** fires only when a verb is *either* transitive *or* intransitive; words tagged both get no V1.
- **っ before an okurigana dot** is carried across it: もっ.て → *mot.te*, ほっ.する → *hos.suru*
  (§6.3 rule 4 + 7 combined). Word-final ッ (ガッ, サッ) is still dropped and counted (12).
- **Context line** says "school grade 3", not "grade 3", so a beginner does not read it as a score.
- **`typeRaw` is not shipped** (§9: N3 vocab was 1.07 MB with it, 1.0 MB without); total deck data ≈ 3.1 MB.
- **Long-press click swallowing** is document-wide, not per-row: the sheet opens under the finger, so
  the click fired on lift lands on the sheet backdrop and would close it instantly. Found in the
  headless-Chrome run; a fresh pointerdown ends the swallow so the next real tap always works.

Verification: 74 `node --test` cases (romaji/forms goldens, tips, gate on committed data, frozen
order, storage/import/export, precache completeness, AC-12 wording) + a headless-Chrome run at
390×844 with touch emulation covering AC-1–AC-7 and AC-10 locally (every route offline).
Outstanding: P5 deploy (awaiting owner go-ahead for the public repo), AC-11, AC-13.

---
*End of PRD rev 1. Implementer: read CLAUDE.md first.*
