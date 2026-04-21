/* ============================================================
   EGYPT IGCSE 2026 — sw.js  (Service Worker)
   Caches all assets on install so the app works fully offline.
   Cache-first strategy: serve from cache, update in background.
============================================================ */

const CACHE  = 'igcse-2026-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/favicon.svg',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

/* ── INSTALL: cache all assets ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

/* ── ACTIVATE: delete old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ── FETCH: cache-first, network fallback ── */
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // serve from cache immediately, update cache in background
        fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE).then(cache => cache.put(event.request, response));
            }
          })
          .catch(() => {});
        return cached;
      }
      // not in cache — try network
      return fetch(event.request).catch(() => caches.match('/index.html'));
    })
  );
});
