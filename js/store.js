// store.js — card status storage (PRD §7). The only module that touches localStorage.
// Each deck's blob is parsed once, held in memory, and written through on every change (§7.2).
export const LEVELS = ['N4', 'N3', 'N2'];
export const DECKS = ['kanji', 'vocab'];
export const STATUSES = ['pending', 'review', 'done'];
const PREFIX = 'jlptprep.v1.status.';
const UI_KEY = 'jlptprep.v1.ui';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

function safeStorage() {
  try {
    const s = globalThis.localStorage;
    const probe = '__jlptprep_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return memoryStorage();
  }
}

export function createStore(storage = safeStorage(), now = () => new Date().toISOString()) {
  const blobs = new Map();
  const deckKey = (level, deck) => `${level}.${deck}`;

  function blob(level, deck) {
    const k = deckKey(level, deck);
    if (!blobs.has(k)) {
      let b = null;
      try {
        const raw = storage.getItem(PREFIX + k);
        b = raw ? JSON.parse(raw) : null;
      } catch (e) {
        console.warn('jlptprep: corrupt status blob, starting empty', k, e);
      }
      if (!b || typeof b !== 'object' || typeof b.ids !== 'object' || b.ids === null) b = { ids: {}, updatedAt: null };
      blobs.set(k, b);
    }
    return blobs.get(k);
  }

  function persist(level, deck) {
    const b = blob(level, deck);
    b.updatedAt = now();
    try {
      if (Object.keys(b.ids).length) storage.setItem(PREFIX + deckKey(level, deck), JSON.stringify(b));
      else storage.removeItem(PREFIX + deckKey(level, deck));
    } catch (e) {
      console.warn('jlptprep: could not save', e);
    }
  }

  const store = {
    get(level, deck, id) {
      return blob(level, deck).ids[id] || 'pending';
    },
    set(level, deck, id, status) {
      if (!STATUSES.includes(status)) throw new Error(`bad status ${status}`);
      const ids = blob(level, deck).ids;
      if (status === 'pending') delete ids[id];
      else ids[id] = status;
      persist(level, deck);
    },
    /** @returns {{done, review, pending, total, complete}} (§7.5: derived, never stored) */
    counts(level, deck, total) {
      let done = 0, review = 0;
      for (const v of Object.values(blob(level, deck).ids)) {
        if (v === 'done') done++;
        else if (v === 'review') review++;
      }
      return { done, review, pending: total - done - review, total, complete: total > 0 && done === total };
    },
    resetDeck(level, deck) {
      blob(level, deck).ids = {};
      persist(level, deck);
    },
    resetAll() {
      for (const L of LEVELS) for (const d of DECKS) store.resetDeck(L, d);
    },
    exportAll() {
      const status = {};
      for (const L of LEVELS) for (const d of DECKS) status[deckKey(L, d)] = structuredClone(blob(L, d));
      return { app: 'jlptprep', version: 1, exportedAt: now(), status };
    },
    /**
     * Validate an export and summarise what a merge would do, without changing anything.
     * @param validIds optional {"N3.vocab": Set<id>} — unknown ids are dropped.
     */
    planImport(data, validIds = null) {
      if (!data || data.app !== 'jlptprep' || data.version !== 1 || typeof data.status !== 'object' || !data.status)
        throw new Error('This file is not a JLPT Prep progress export.');
      const plan = [];
      let review = 0, done = 0, unknown = 0;
      for (const L of LEVELS) for (const d of DECKS) {
        const ids = data.status[deckKey(L, d)]?.ids || {};
        for (const [id, v] of Object.entries(ids)) {
          if (v !== 'done' && v !== 'review') continue;
          if (validIds && !validIds[deckKey(L, d)]?.has(id)) { unknown++; continue; }
          plan.push([L, d, id, v]);
          if (v === 'done') done++; else review++;
        }
      }
      return { plan, review, done, unknown };
    },
    /** Merge (§5.7 FR-19): imported review/done overwrite; imported absence never clears. */
    applyImport({ plan }) {
      const touched = new Set();
      for (const [L, d, id, v] of plan) {
        blob(L, d).ids[id] = v;
        touched.add(deckKey(L, d));
      }
      for (const k of touched) { const [L, d] = k.split('.'); persist(L, d); }
    },
    ui: {
      read() {
        try {
          const u = JSON.parse(storage.getItem(UI_KEY) || '{}');
          return { ...u, filter: u.filter || {}, scroll: u.scroll || {} };
        } catch { return { filter: {}, scroll: {} }; }
      },
      write(u) {
        try { storage.setItem(UI_KEY, JSON.stringify(u)); } catch { /* best-effort */ }
      },
    },
  };
  return store;
}
