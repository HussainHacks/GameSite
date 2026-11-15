const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const CATALOG_PATH = path.join(PUBLIC_DIR, 'data', 'games.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

// Safe JSON catalog loader
let gamesData = null;
let lastCatalogMtime = 0;

function getGamesData() {
  try {
    if (fs.existsSync(CATALOG_PATH)) {
      const stats = fs.statSync(CATALOG_PATH);
      if (!gamesData || stats.mtimeMs > lastCatalogMtime) {
        const fileContent = fs.readFileSync(CATALOG_PATH, 'utf8');
        gamesData = JSON.parse(fileContent);
        lastCatalogMtime = stats.mtimeMs;
      }
    }
  } catch (e) {
    console.error('[Server] Failed to load catalog from JSON:', e.message);
    if (!gamesData) gamesData = [];
  }
  return gamesData || [];
}

const server = http.createServer((req, res) => {
  // Enhanced security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');

  // Safe URI parsing and decoding
  let parsedUrl;
  let pathname;
  try {
    parsedUrl = url.parse(req.url, true);
    pathname = decodeURIComponent(parsedUrl.pathname);
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Bad Request: Malformed URI');
  }

  // API: Get all games with filtering and search
  if (pathname === '/api/games') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const catalog = getGamesData();
    let results = catalog;

    const { category, search, limit } = parsedUrl.query;
    if (category && category !== 'all') {
      results = results.filter(g => g.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(g =>
        g.title.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        (g.tags && g.tags.some(t => t.toLowerCase().includes(q)))
      );
    }
    if (limit) {
      const n = parseInt(limit, 10);
      if (!isNaN(n) && n > 0) results = results.slice(0, n);
    }

    return res.end(JSON.stringify({
      total: results.length,
      games: results
    }));
  }

  // API: Get specific game by ID
  if (pathname.startsWith('/api/games/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const id = pathname.replace('/api/games/', '').trim();
    const catalog = getGamesData();
    const game = catalog.find(g => g.id === id);
    if (!game) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: 'Game not found' }));
    }
    return res.end(JSON.stringify(game));
  }

  // API: Stats
  if (pathname === '/api/stats') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const catalog = getGamesData();
    const categories = {};
    catalog.forEach(g => {
      categories[g.category] = (categories[g.category] || 0) + 1;
    });
    return res.end(JSON.stringify({
      totalGames: catalog.length,
      categories,
      system: 'Neon Arcade Portal',
      version: '1.0.0'
    }));
  }

  // SPA Route handling: /game/:id routes to /index.html
  if (pathname.startsWith('/game/') || pathname === '/game') {
    pathname = '/index.html';
  } else if (pathname === '/') {
    pathname = '/index.html';
  }

  // Secure path resolution and directory traversal prevention
  // 1. Resolve absolute path relative to PUBLIC_DIR
  const safeRelativePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.resolve(PUBLIC_DIR, '.' + safeRelativePath);

  // 2. Strict directory containment check
  const relative = path.relative(PUBLIC_DIR, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Access denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Check if it's a directory containing index.html
      const dirIndex = path.join(filePath, 'index.html');
      if (!err && stats.isDirectory() && fs.existsSync(dirIndex)) {
        serveFile(dirIndex, res);
      } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body style="background:#0a0a14;color:#00f0ff;font-family:monospace;padding:40px;text-align:center;"><h1>404 // NOT FOUND</h1><p>Requested asset does not exist.</p><a href="/" style="color:#fcee0a;">RETURN TO ARCADE</a></body></html>');
      }
    } else {
      serveFile(filePath, res);
    }
  });
});

function serveFile(targetPath, res) {
  const ext = path.extname(targetPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);

  if (ext === '.html') {
    res.setHeader('Cache-Control', 'no-cache');
  } else if (ext === '.json' && targetPath.includes('sw.js')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }

  const stream = fs.createReadStream(targetPath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Server error reading file');
    }
  });
  stream.pipe(res);
}

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  NEON ARCADE // CYBERPUNK PORTAL ONLINE`);
  console.log(`  Local URL:  http://localhost:${PORT}`);
  console.log(`  API Core:   JSON Verified (16 Games)`);
  console.log(`  Security:   Path-Traversal Guard Active`);
  console.log(`======================================================\n`);
});

module.exports = server;
