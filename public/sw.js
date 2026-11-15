const CACHE_NAME = 'neon-arcade-v5';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/cyberpunk.css?v=5',
  '/css/gamepad.css?v=5',
  '/js/games-data.js?v=5',
  '/js/gamepad.js?v=5',
  '/js/app.js?v=5',
  '/assets/icons/icon-192.svg',
  '/assets/icons/icon-512.svg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Network first for API, HTML navigation, and JS data.
  // cache: no-store bypasses the browser HTTP cache, which otherwise
  // serves a day old copy of the catalog to returning visitors.
  if (
    e.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/api/')
  ) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then((fetchRes) => {
          if (fetchRes.status === 200 && url.origin === self.location.origin) {
            const clone = fetchRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return fetchRes;
        })
        .catch(() => caches.match(e.request).then((res) => res || caches.match('/index.html')))
    );
    return;
  }

  // Cache first with network fallback for images, CSS, fonts, audio
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((fetchRes) => {
        if (fetchRes.status === 200 && url.origin === self.location.origin) {
          const clone = fetchRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return fetchRes;
      });
    }).catch(() => caches.match('/index.html'))
  );
});
