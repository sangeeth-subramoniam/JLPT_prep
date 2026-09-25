// app.js — hash router + views (PRD §5). Home → level → list → card; settings.
import { createStore, LEVELS, DECKS, STATUSES } from './store.js';
import { loadManifest, loadDeck } from './data.js';
import { attachRowGestures } from './gesture.js';

export const APP_VERSION = 'jlpt-prep-v2'; // keep equal to CACHE in sw.js (tested)
const DECK_NAME = { kanji: 'Kanji', vocab: 'Vocabulary' };
const STATUS_NAME = { pending: 'Pending', review: 'Review', done: 'Done' };
const FILTERS = ['all', 'pending', 'review', 'done'];
const FIRST_CHUNK = 200;
const CHUNK = 400;

const store = createStore();
const app = document.getElementById('app');
let cleanup = [];          // per-view teardown functions
let current = null;        // parsed route

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sq = (status) => `<span class="sq ${status}" role="img" aria-label="${STATUS_NAME[status]}"></span>`;
const back = (href, label) => `<a class="back" href="${href}" aria-label="${esc(label)}">‹</a>`;
const bar = (backHref, backLabel, title, sub = '') =>
  `<header class="bar">${back(backHref, backLabel)}<h1>${title}</h1>${sub ? `<span class="sub" data-sub>${sub}</span>` : ''}</header>`;
const completedBanner = (what) => `<div class="completed"><span class="check">✓</span> Completed — every ${what} card is done.</div>`;
const ui = () => store.ui.read();
const saveUi = (fn) => { const u = ui(); fn(u); store.ui.write(u); };

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { view: 'home' };
  if (parts[0] === 'settings' && parts.length === 1) return { view: 'settings' };
  const [L, D, n] = parts;
  if (!LEVELS.includes(L)) return null;
  if (parts.length === 1) return { view: 'level', L };
  if (!DECKS.includes(D)) return null;
  if (parts.length === 2) return { view: 'list', L, D };
  if (parts.length === 3 && /^[1-9]\d*$/.test(n)) return { view: 'card', L, D, n: Number(n) };
  return null;
}

// ---------- home ----------
async function viewHome(r) {
  const m = await loadManifest();
  if (r.stale()) return;
  const tiles = LEVELS.map((L) => {
    const k = store.counts(L, 'kanji', m.decks[L].kanji.count);
    const v = store.counts(L, 'vocab', m.decks[L].vocab.count);
    const done = k.complete && v.complete;
    return `<a class="tile" href="#/${L}">
      <div class="name">${L}${done ? ' <span class="check" aria-label="Completed">✓</span>' : ''}</div>
      <div class="meta">Kanji ${k.done} / ${k.total} · Vocabulary ${v.done} / ${v.total}</div>
    </a>`;
  }).join('');
  app.innerHTML = `
    <div class="hero"><h1>JLPT Prep</h1><p>Cover every card first. Test yourself later.</p></div>
    <nav class="tiles" aria-label="Levels">${tiles}</nav>
    <footer class="foot">
      Data: KANJIDIC2, KRADFILE and JMdict © EDRDG (CC BY-SA); JLPT lists from tanos.co.uk.
      · <a href="#/settings">Settings</a>
    </footer>`;
}

// ---------- level ----------
async function viewLevel({ L, stale }) {
  const m = await loadManifest();
  if (stale()) return;
  const tiles = DECKS.map((D) => {
    const c = store.counts(L, D, m.decks[L][D].count);
    return `<a class="tile" href="#/${L}/${D}">
      <div class="name">${DECK_NAME[D]} <small>(${c.total})</small>${c.complete ? ' <span class="check">✓</span>' : ''}</div>
      <div class="legend">
        <span>${sq('done')} ${c.done} done</span><span>${sq('review')} ${c.review} review</span><span>${sq('pending')} ${c.pending} pending</span>
      </div>
      <div class="progress" aria-hidden="true"><i style="--p:${c.total ? c.done / c.total : 0}"></i></div>
      ${c.complete ? '<div class="meta"><span class="check">Completed</span></div>' : ''}
    </a>`;
  }).join('');
  const all = DECKS.every((D) => store.counts(L, D, m.decks[L][D].count).complete);
  app.innerHTML = `${bar('#/', 'Back to levels', `JLPT ${L}`)}
    ${all ? completedBanner(L) : ''}
    <nav class="tiles" aria-label="Decks">${tiles}</nav>`;
}

// ---------- list ----------
const firstReading = (c) => c.readings.find((r) => r.type === 'on') || c.readings[0];

function rowHtml(L, D, c) {
  const status = store.get(L, D, c.id);
  let body;
  if (D === 'kanji') {
    const r = firstReading(c);
    body = `<span class="ja">${esc(c.kanji)}</span>
      <span class="txt"><span class="l1">${esc(c.primary)}</span><span class="l2">${esc(r?.romaji || '')}</span></span>`;
  } else {
    const l1 = c.word === c.reading ? `<span class="rom">${esc(c.romaji)}</span>`
      : `${esc(c.reading)} · <span class="rom">${esc(c.romaji)}</span>`;
    body = `<span class="ja word">${esc(c.word)}</span>
      <span class="txt"><span class="l1">${l1}</span><span class="l2">${esc(c.meanings[0])}</span></span>`;
  }
  return `<li class="row" role="button" tabindex="0" data-n="${c.n}" data-status="${status}">
    <span class="num">${c.n}</span>${body}${sq(status)}</li>`;
}

async function viewList({ L, D, stale }) {
  const deck = await loadDeck(L, D);
  if (stale()) return;
  const key = `${L}.${D}`;
  let filter = FILTERS.includes(ui().filter[key]) ? ui().filter[key] : 'all';
  const counts = () => store.counts(L, D, deck.length);

  app.innerHTML = `${bar(`#/${L}`, `Back to ${L}`, `${L} · ${DECK_NAME[D]}`, '&nbsp;')}
    <div data-banner></div>
    <div class="chips" role="toolbar" aria-label="Filter">${FILTERS.map((f) =>
      `<button type="button" class="chip" data-filter="${f}" aria-pressed="${f === filter}"></button>`).join('')}</div>
    <ul class="list" id="list"></ul>
    <p class="empty" hidden></p>`;
  const list = app.querySelector('#list');
  const empty = app.querySelector('.empty');

  function refreshCounts() {
    const c = counts();
    app.querySelector('[data-sub]').textContent = `${c.done} / ${c.total} done`;
    app.querySelector('[data-banner]').innerHTML = c.complete ? completedBanner(`${L} ${DECK_NAME[D].toLowerCase()}`) : '';
    const n = { all: c.total, pending: c.pending, review: c.review, done: c.done };
    for (const b of app.querySelectorAll('.chip')) b.textContent = `${b.dataset.filter[0].toUpperCase()}${b.dataset.filter.slice(1)} ${n[b.dataset.filter]}`;
    return n;
  }

  let renderToken = 0;
  function renderRows(restoreScroll) {
    const token = ++renderToken;
    const cards = filter === 'all' ? deck : deck.filter((c) => store.get(L, D, c.id) === filter);
    const html = cards.map((c) => rowHtml(L, D, c));
    empty.hidden = cards.length > 0;
    empty.textContent = cards.length ? '' : filter === 'all' ? 'This deck is empty.' : `Nothing under ${STATUS_NAME[filter]} yet.`;
    const saved = restoreScroll ? ui().scroll[key] : 0;
    if (saved) {
      list.innerHTML = html.join('');       // everything now, so the saved position exists
      window.scrollTo(0, saved);
      return;
    }
    list.innerHTML = html.slice(0, FIRST_CHUNK).join('');
    let i = FIRST_CHUNK;
    const step = () => {
      if (token !== renderToken || i >= html.length) return;
      list.insertAdjacentHTML('beforeend', html.slice(i, i + CHUNK).join(''));
      i += CHUNK;
      (window.requestIdleCallback || ((f) => setTimeout(f, 16)))(step);
    };
    step();
  }

  refreshCounts();
  renderRows(true);

  app.querySelector('.chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b || b.dataset.filter === filter) return;
    filter = b.dataset.filter;
    for (const c of app.querySelectorAll('.chip')) c.setAttribute('aria-pressed', String(c === b));
    saveUi((u) => { u.filter[key] = filter; u.scroll[key] = 0; });
    window.scrollTo(0, 0);
    renderRows(false);
  });

  const cardOf = (row) => deck[Number(row.dataset.n) - 1];
  cleanup.push(attachRowGestures(list, '.row', {
    onTap: (row) => { location.hash = `#/${L}/${D}/${row.dataset.n}`; },
    onLongPress: (row) => {
      const c = cardOf(row);
      openSheet({
        title: D === 'kanji' ? `${c.kanji} · ${c.primary}` : `${c.word} · ${c.romaji}`,
        current: store.get(L, D, c.id),
        onPick: (status) => {
          store.set(L, D, c.id, status);
          row.dataset.status = status;
          row.querySelector('.sq').outerHTML = sq(status);
          const n = refreshCounts();
          if (filter !== 'all' && status !== filter) {
            row.classList.add('leaving');
            setTimeout(() => {
              row.remove();
              if (!n[filter]) { empty.hidden = false; empty.textContent = `Nothing under ${STATUS_NAME[filter]} yet.`; }
            }, 250);
          }
        },
        returnFocus: row,
      });
    },
  }));

  let t = null;
  const onScroll = () => {
    clearTimeout(t);
    t = setTimeout(() => saveUi((u) => { u.scroll[key] = Math.round(window.scrollY); }), 150);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanup.push(() => { clearTimeout(t); window.removeEventListener('scroll', onScroll); renderToken++; });
}

// ---------- card page ----------
function statusBar(status) {
  return `<div class="statusbar" role="group" aria-label="Status">${STATUSES.map((s) =>
    `<button type="button" data-status="${s}" aria-pressed="${s === status}">${sq(s)} ${STATUS_NAME[s]}</button>`).join('')}</div>`;
}
const section = (title, inner) => `<section class="s"><h2>${title}</h2>${inner}</section>`;
const tipsSection = (tips) => tips?.length ? section('Tips', `<ul class="tips">${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`) : '';
const wordLine = (w) => `<span class="jp">${esc(w.word)}</span> <span class="kanas">${esc(w.reading)}</span> <span class="rm">${esc(w.romaji)}</span><span class="gloss">${esc(w.meaning)}</span>`;

// Collapsed by default; remembers the last open/closed choice across cards.
function examSection(c) {
  const total = Object.values(c.exam).reduce((a, ws) => a + ws.length, 0);
  const groups = Object.entries(c.exam).map(([lv, ws]) => {
    const items = ws.map((w) => {
      const inner = `<span class="jp">${esc(w.word)}</span> <span class="kanas">${esc(w.reading)}</span> <span class="rm">${esc(w.romaji)}</span><span class="gloss">${esc(w.meaning)}</span>`;
      if (!w.n) return `<li>${inner}</li>`;
      const st = store.get(lv, 'vocab', `${w.word}|${w.reading}`);
      return `<li><a class="exam-link" href="#/${lv}/vocab/${w.n}"><span class="exam-txt">${inner}</span><span class="exam-meta">#${w.n} ${sq(st)}</span></a></li>`;
    }).join('');
    return `<h3>${lv} <span class="count">${ws.length ? `${ws.length} word${ws.length > 1 ? 's' : ''}` : 'none'}</span></h3>
      ${ws.length ? `<ul class="lines" lang="ja">${items}</ul>` : ''}`;
  }).join('');
  const open = ui().examOpen ? ' open' : '';
  return `<details class="exam"${open}>
    <summary><span class="sum-title">All exam words with <span lang="ja">${esc(c.kanji)}</span> (N5–N2)</span><span class="count">${total}</span></summary>
    <div class="exam-body">
    <p class="note">Every word on the JLPT N5–N2 vocabulary lists that uses this kanji, by the level the word is listed at. Tap one to open its Vocabulary card. N5 words have no deck in this app.</p>
    ${groups}
    </div>
  </details>`;
}

function kanjiBody(c, L) {
  const ctx = [c.strokes ? `${c.strokes} strokes` : '', c.grade ? `school grade ${c.grade}` : '', `JLPT ${L}`].filter(Boolean).join(' · ');
  const readings = c.readings.map((r) => `<li><span class="jp">${esc(r.kana)}</span> <span class="rm">${esc(r.romaji)}</span><span class="tag">${r.type}</span>
      ${r.word
        ? `<span class="gloss"><span class="kanas">${esc(r.word)}</span> ${esc(r.wordReading)} <span class="rm">${esc(r.wordRomaji)}</span> — ${esc(r.meaning)}</span>`
        : '<span class="gloss rare">rare, skip for now</span>'}</li>`).join('');
  const pieces = c.components?.length
    ? `<div class="pieces">${c.components.map((p) => `<span class="piece"><b>${esc(p.char)}</b>${esc(p.name)}</span>`).join('')}</div>`
    : '<p>It is a single piece.</p>';
  const also = c.meanings.filter((m) => m !== c.primary);
  return `<div class="big" lang="ja">${esc(c.kanji)}</div>
    <div class="headline">${esc(c.primary)}</div>
    <div class="context">${esc(ctx)}</div>
    ${section('How it is read', `<ul class="lines" lang="ja">${readings}</ul>`)}
    ${section('Pieces you can spot', pieces)}
    ${section('Words you will meet', `<ul class="lines" lang="ja">${c.words.map((w) => `<li>${wordLine(w)}</li>`).join('')}</ul>`)}
    ${examSection(c)}
    ${also.length ? section('Also means', `<p class="also">${esc(also.join(' · '))}</p>`) : ''}
    ${tipsSection(c.tips)}`;
}

function vocabBody(c) {
  const kanaOnly = c.word === c.reading;
  const pieces = !kanaOnly && c.breakdown?.length
    ? section('Pieces', `<div class="pieces">${c.breakdown.map((b) => `<span class="piece"><b>${esc(b.part)}</b>${
        b.reading ? `<span class="pr">${esc(b.reading)} ${esc(b.romaji)}</span> ` : ''}${esc(b.meaning)}</span>`).join('')}</div>`)
    : '';
  const forms = c.forms?.length
    ? section('Forms you will see', `<table class="forms" lang="ja">${c.forms.map((f) =>
        `<tr><td>${esc(f.label)}</td><td><span class="jp">${esc(f.form)}</span><br><span class="kanas">${esc(f.reading)}</span> <span class="rm">${esc(f.romaji)}</span></td></tr>`).join('')}</table>`)
    : '';
  return `<div class="big word" lang="ja">${esc(c.word)}</div>
    <div class="under">${kanaOnly ? '' : `<span class="kana" lang="ja">${esc(c.reading)}</span>`}<span class="rom">${esc(c.romaji)}</span></div>
    ${section('Meaning', `<ul class="meanings">${c.meanings.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`)}
    ${c.type?.length ? section('Word type', `<div class="types">${c.type.map((t) => `<span>${esc(t)}</span>`).join('')}</div>`) : ''}
    ${pieces}${forms}${tipsSection(c.tips)}`;
}

async function viewCard({ L, D, n, stale }) {
  const deck = await loadDeck(L, D);
  if (stale()) return;
  const c = deck[n - 1];
  if (!c) { location.replace(`#/${L}/${D}`); return; }
  const total = deck.length;
  const prev = n > 1 ? `<a href="#/${L}/${D}/${n - 1}">‹ Prev</a>` : '<span aria-disabled="true">‹ Prev</span>';
  const next = n < total ? `<a href="#/${L}/${D}/${n + 1}">Next ›</a>` : '<span aria-disabled="true">Next ›</span>';
  app.innerHTML = `${bar(`#/${L}/${D}`, 'Back to the list', `${L} · ${DECK_NAME[D]}`, `${n} / ${total}`)}
    <div class="nav">${prev}${next}</div>
    ${statusBar(store.get(L, D, c.id))}
    <article>${D === 'kanji' ? kanjiBody(c, L) : vocabBody(c)}</article>
    <div class="nav">${prev}${next}</div>`;
  app.querySelector('.statusbar').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-status]');
    if (!b) return;
    store.set(L, D, c.id, b.dataset.status);
    for (const x of app.querySelectorAll('.statusbar button')) x.setAttribute('aria-pressed', String(x === b));
  });
  app.querySelector('details.exam')?.addEventListener('toggle', (e) => saveUi((u) => { u.examOpen = e.target.open; }));
  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || !document.getElementById('sheet').hidden) return;
    if (e.key === 'ArrowLeft' && n > 1) location.hash = `#/${L}/${D}/${n - 1}`;
    if (e.key === 'ArrowRight' && n < total) location.hash = `#/${L}/${D}/${n + 1}`;
  };
  document.addEventListener('keydown', onKey);
  cleanup.push(() => document.removeEventListener('keydown', onKey));
}

// ---------- settings ----------
async function viewSettings(r) {
  const m = await loadManifest();
  if (r.stale()) return;
  const resets = LEVELS.flatMap((L) => DECKS.map((D) =>
    `<button type="button" class="btn danger" data-reset="${L}.${D}">Reset ${L} ${DECK_NAME[D]}</button>`)).join('');
  app.innerHTML = `${bar('#/', 'Back to levels', 'Settings')}
    <div class="group"><h2>Your progress</h2>
      <p class="note">Statuses live only in this browser. Export a copy to move them to another device or keep a backup.</p>
      <button type="button" class="btn" data-act="export">Export progress</button>
      <button type="button" class="btn" data-act="import">Import progress…</button>
      <input type="file" accept="application/json,.json" hidden>
    </div>
    <div class="group"><h2>Start over</h2>${resets}
      <button type="button" class="btn danger" data-act="reset-all">Reset everything</button>
    </div>
    <div class="group"><h2>About the data</h2>
      <p class="note">Kanji readings, meanings, stroke counts and grades come from <b>KANJIDIC2</b>. Kanji pieces come from
      <b>KRADFILE</b>. Example words, word types and readings come from <b>JMdict</b>. KANJIDIC2, KRADFILE and JMdict are ©
      the Electronic Dictionary Research and Development Group (EDRDG) and used under the
      <a href="https://www.edrdg.org/edrdg/licence.html" rel="noopener">Creative Commons Attribution-ShareAlike</a> licence.
      JLPT level lists follow <b>tanos.co.uk</b> (Jonathan Waller). The data was prepared by the Kanji Commute pipeline;
      romaji, word forms and tips are generated from it by rules.</p>
      <p class="note">Data generated ${esc(m.generated)} · app ${APP_VERSION}</p>
    </div>`;

  app.querySelector('[data-act="export"]').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(store.exportAll(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `jlptprep-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  const input = app.querySelector('input[type=file]');
  app.querySelector('[data-act="import"]').addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const validIds = {};
      for (const L of LEVELS) for (const D of DECKS) validIds[`${L}.${D}`] = new Set((await loadDeck(L, D)).map((c) => c.id));
      const plan = store.planImport(data, validIds);
      const extra = plan.unknown ? ` ${plan.unknown} unknown card(s) will be ignored.` : '';
      if (!confirm(`Import ${plan.done} Done and ${plan.review} Review statuses? Cards not in the file keep their current status.${extra}`)) return;
      store.applyImport(plan);
      alert('Progress imported.');
    } catch (e) {
      alert(e instanceof SyntaxError ? 'That file is not valid JSON.' : e.message);
    }
  });
  app.querySelector('.group:nth-of-type(2)').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'reset-all') {
      if (confirm('Reset every status in every deck back to Pending? This cannot be undone.')) { store.resetAll(); alert('Everything is back to Pending.'); }
      return;
    }
    const [L, D] = b.dataset.reset.split('.');
    if (confirm(`Reset every ${L} ${DECK_NAME[D]} card back to Pending? This cannot be undone.`)) { store.resetDeck(L, D); alert(`${L} ${DECK_NAME[D]} is back to Pending.`); }
  });
}

// ---------- bottom sheet ----------
const sheet = document.getElementById('sheet');
let sheetState = null;
function openSheet({ title, current: cur, onPick, returnFocus }) {
  sheetState = { onPick, returnFocus };
  sheet.querySelector('.sheet-title').textContent = title;
  for (const b of sheet.querySelectorAll('.sheet-btn')) b.setAttribute('aria-current', String(b.dataset.status === cur));
  sheet.hidden = false;
  sheet.querySelector(`.sheet-btn[data-status="${cur}"]`).focus();
}
function closeSheet() {
  if (sheet.hidden) return;
  sheet.hidden = true;
  const f = sheetState?.returnFocus;
  sheetState = null;
  if (f?.isConnected) f.focus({ preventScroll: true });
}
sheet.addEventListener('click', (e) => {
  const pick = e.target.closest('.sheet-btn');
  if (pick) { const cb = sheetState?.onPick; closeSheet(); cb?.(pick.dataset.status); return; }
  if (e.target.closest('[data-close]')) closeSheet();
});
sheet.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  if (sheet.hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
  if (e.key === 'Tab') {
    const f = [...sheet.querySelectorAll('button')];
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }
});

// ---------- router ----------
const VIEWS = { home: viewHome, level: viewLevel, list: viewList, card: viewCard, settings: viewSettings };
let navToken = 0;
async function route() {
  const token = ++navToken;
  for (const f of cleanup.splice(0)) f();
  closeSheet();
  const r = parseRoute();
  if (!r) { location.replace('#/'); return; }
  r.stale = () => token !== navToken;
  current = r;
  if (r.view !== 'list') window.scrollTo(0, 0);
  try {
    await VIEWS[r.view](r);
  } catch (e) {
    if (token !== navToken) return;
    console.error(e);
    app.innerHTML = `${bar('#/', 'Back to levels', 'Could not load')}
      <p class="empty">This page could not load. If you are offline, open the app once with a connection so it can save everything for offline use.</p>`;
  }
}
window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('sw', e)));
}
