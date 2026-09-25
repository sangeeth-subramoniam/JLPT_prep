# JLPT_prep — cover N4/N3/N2 kanji & vocabulary before testing yourself

## What this is
A **very simple**, personal, offline PWA. Home → level (N4 · N3 · N2) → deck (Kanji · Vocabulary) →
**numbered list** → one-page card. No testing, no SRS, no scores. Each list row has a **small status
square at the right edge** (Pending grey outline · Review amber · Done green), set by **long press**.
A deck is complete when every square is green. Static HTML/CSS/vanilla JS + JSON, GitHub Pages,
`localStorage`. No framework, no build step, no runtime dependency.

## Status (2026-09-25)
**P0 (local) + P1–P4 built**, 74 tests green, headless-Chrome e2e green. **P5 not done**: the GitHub
repo is not created yet (owner go-ahead needed). Deviations from the PRD are recorded in **PRD §16**.

## Source of truth
**`PRD.md` rev 1** (Fable, 2026-09-25). Implement it exactly; the only open item is §15 (levels are
assumed N4/N3/N2 — check the owner confirmed it before P1 freezes the decks).
- **§4** locked decisions · **§5** FR-1…FR-25 · **§6** data pipeline (normative, unit-tested):
  romaji rules §6.3, word-type table §6.4, forms §6.5, tips §6.6, **blocking validation gate §6.7**,
  **frozen numbering §6.8** · **§7** storage keys · **§11** AC-1…AC-13 · **§12** build order P0–P5.

## Data
- Input = the **sister project's committed data**: `../japanese_learning_bot/data/` (Kanji Commute;
  `<l>.json` kanji with lesson fields, `vocab/<l>.json` + `compounds/<l>.json`). The generator
  `tools/build_data.mjs` reads it via `--source` (that default path) and writes `data/N?/{kanji,vocab}.json`.
  Never fetch dictionaries here; never edit the sister repo.
- Vocabulary deck = vocab ∪ compounds per level (N4 663, N3 2139, N2 1792). Kanji N4 166, N3 367, N2 367.
- Card id: kanji char / `word|reading`. Card number = 1-based file position, **frozen after P1**.
- Romaji is generated at build time only (`tools/romaji.mjs`); the app never transliterates.
- Attribution: KANJIDIC2 / KRADFILE / JMdict © EDRDG, CC BY-SA; tanos.co.uk lists. Show in Settings
  and `data/README.md`.

## Key implementation rules
- Long press = `pointerdown` + 500 ms timer, cancel on move > 10 px / scroll / pointerup; also handle
  `contextmenu`. **Never `preventDefault` on `touchstart`.** Swallow the click after a long press.
- Status writes are write-through from an in-memory blob per deck (§7.2); no per-tap re-parse.
- Filter chips All/Pending/Review/Done; scroll + filter restored on Back (hash router).
- Card pages show everything, nothing collapsed; content order in FR-15 (kanji) / FR-17 (vocab).
- Never show a percentage, grade, streak, "wrong" or "score" (AC-12 is a grep).
- Tests: `node --test` — romaji goldens, forms goldens, tips rules, validation gate, frozen order,
  storage, completion.

## Deploy
Repo **`sangeeth-subramoniam/JLPT_prep`** (public), GitHub Pages from `main` root, live at
`https://sangeeth-subramoniam.github.io/JLPT_prep/`. Two accounts are signed into `gh` — the active
one must be `sangeeth-subramoniam` (`gh auth status`, `gh auth switch`). **Ask the owner once before
`gh repo create`.** Bump `CACHE` in `sw.js` on every deploy.

## Workflow convention (owner preference)
Owner uses **Fable only for review/structuring** and the **default model for implementation**.
If running as Fable: review, spec, structure — do not implement.
