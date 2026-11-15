const CACHE_NAME = 'neon-arcade-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/cyberpunk.css',
  '/css/gamepad.css',
  '/js/games-data.js',
  '/js/gamepad.js',
  '/js/app.js',
  '/assets/icons/icon-192.svg',
  '/assets/icons/icon-512.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
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
  // Network first for API, cache first for static assets
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((res) => {
        return res || fetch(e.request).then((fetchRes) => {
          // Cache successful responses for local assets
          if (fetchRes.status === 200 && e.request.url.startsWith(self.location.origin)) {
            const clone = fetchRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return fetchRes;
        });
      }).catch(() => caches.match('/index.html'))
    );
  }
});
