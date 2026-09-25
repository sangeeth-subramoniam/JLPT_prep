// data.js — manifest + deck loading, cached in memory.
let manifestP = null;
const decks = new Map();

export function loadManifest() {
  if (!manifestP) manifestP = fetch('data/manifest.json').then((r) => {
    if (!r.ok) throw new Error(`manifest ${r.status}`);
    return r.json();
  }).catch((e) => { manifestP = null; throw e; });
  return manifestP;
}

export async function loadDeck(level, deck) {
  const key = `${level}.${deck}`;
  if (!decks.has(key)) {
    const p = loadManifest().then(async (m) => {
      const entry = m.decks[level]?.[deck];
      if (!entry) throw new Error(`no deck ${key}`);
      const r = await fetch(`data/${entry.file}`);
      if (!r.ok) throw new Error(`${entry.file} ${r.status}`);
      return r.json();
    });
    decks.set(key, p);
    p.catch(() => decks.delete(key));
  }
  return decks.get(key);
}
