// sw.js — precache the app shell AND all six decks, so the app is offline from the first visit
// (PRD §9). Bump CACHE on every deploy (keep equal to APP_VERSION in js/app.js); old caches are
// purged on activate.
const CACHE = 'jlpt-prep-v2';

const ASSETS = [
  './',
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/store.js',
  'js/data.js',
  'js/gesture.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'data/manifest.json',
  'data/N4/kanji.json',
  'data/N4/vocab.json',
  'data/N3/kanji.json',
  'data/N3/vocab.json',
  'data/N2/kanji.json',
  'data/N2/vocab.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for everything same-origin; fall back to the network and cache what we get.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
