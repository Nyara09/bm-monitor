/* Service worker: keeps the app shell and transaction pages available offline.
   Money is never committed offline - forms are queued by offline.js and synced later. */
const VERSION = 'forex-v4';
const SHELL = ['/offline/', '/forex-exchange/', '/mobile-money-transaction/'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/static/')) {
    // Static files: cache first.
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      if (res.ok) caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    })));
    return;
  }
  if (req.mode === 'navigate') {
    // Pages: network first, fall back to the cached copy, then the outbox page.
    event.respondWith(fetch(req).then((res) => {
      if (res.ok && SHELL.includes(url.pathname)) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(url.pathname, copy));
      }
      return res;
    }).catch(() => caches.match(url.pathname).then((hit) => hit || caches.match('/offline/'))));
  }
});
