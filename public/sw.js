const CACHE_NAME = 'neon-arcade-v6';

// Shell and critical assets to pre-cache
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/cyberpunk.css?v=6',
  '/css/gamepad.css?v=6',
  '/js/storage-guard.js?v=6',
  '/js/games-data.js?v=6',
  '/js/gamepad.js?v=6',
  '/js/app.js?v=6',
  '/data/games.json',
  '/assets/icons/icon-192.svg',
  '/assets/icons/icon-512.svg',
  '/assets/thumbs/fallback.svg',
  // Thumbnails
  '/assets/thumbs/neon-snake.webp',
  '/assets/thumbs/neon-tetris.webp',
  '/assets/thumbs/space-invaders.webp',
  '/assets/thumbs/cyber-breakout.webp',
  '/assets/thumbs/pong-cyber.webp',
  '/assets/thumbs/2048-cyber.webp',
  '/assets/thumbs/hextris-cyber.webp',
  '/assets/thumbs/neon-minesweeper.webp',
  '/assets/thumbs/memory-matrix.webp',
  '/assets/thumbs/wordle-cyber.webp',
  '/assets/thumbs/cyber-runner.webp',
  '/assets/thumbs/clumsy-bird.webp',
  '/assets/thumbs/flappy-cyber.webp',
  '/assets/thumbs/tic-tac-toe-cyber.webp',
  '/assets/thumbs/solitaire.webp',
  '/assets/thumbs/mahjong.webp',
  // 14 Local Games Entrypoints
  '/games/snake/index.html',
  '/games/neon-tetris/index.html',
  '/games/space-invaders/index.html',
  '/games/breakout/index.html',
  '/games/pong-cyber/index.html',
  '/games/2048/index.html',
  '/games/hextris/index.html',
  '/games/minesweeper/index.html',
  '/games/memory-matrix/index.html',
  '/games/cyber-runner/index.html',
  '/games/flappy-cyber/index.html',
  '/games/tic-tac-toe/index.html',
  '/games/solitaire/index.html',
  '/games/mahjong/index.html'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch((err) => {
      console.warn('[SW] Cache prefetch partial failure:', err);
    })
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

  // Network-first for shell code, data, and SPA navigations
  if (
    e.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.startsWith('/game/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/data/') ||
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
        .catch(() => {
          // If offline navigation, serve cached index.html
          return caches.match(e.request).then((res) => {
            if (res) return res;
            if (e.request.mode === 'navigate' || url.pathname.startsWith('/game/')) {
              return caches.match('/index.html');
            }
            return new Response('Offline', { status: 503, statusText: 'Offline' });
          });
        })
    );
    return;
  }

  // Cache-first for static game files, images, thumbnails, fonts, media
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
    }).catch(() => {
      // NEVER substitute /index.html for failed sub-resources or game assets!
      if (url.pathname.endsWith('.html') && url.pathname.startsWith('/games/')) {
        return new Response(
          '<!DOCTYPE html><html><body style="background:#0a0a14;color:#ff007f;font-family:monospace;padding:24px;text-align:center;"><h2>OFFLINE // CORE NOT CACHED</h2><p>Connect to the network to download this core.</p></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
      return new Response('Resource unavailable offline', { status: 503, statusText: 'Offline' });
    })
  );
});
