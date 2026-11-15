const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

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
};

// Lazy load games data for the API
let gamesData = null;
function getGamesData() {
  if (!gamesData) {
    try {
      const dataFilePath = path.join(PUBLIC_DIR, 'js', 'games-data.js');
      if (fs.existsSync(dataFilePath)) {
        const fileContent = fs.readFileSync(dataFilePath, 'utf8');
        // Extract the JSON-like array from window.GAMES_CATALOG = [...]
        const match = fileContent.match(/window\.GAMES_CATALOG\s*=\s*(\[[\s\S]*?\]);\s*$/m) ||
                      fileContent.match(/(?:const|var|let)?\s*GAMES_CATALOG\s*=\s*(\[[\s\S]*?\]);/m);
        if (match) {
          // Use Function constructor in sandbox to parse clean array
          gamesData = new Function(`return ${match[1]}`)();
        }
      }
    } catch (e) {
      console.error('Failed to parse games data for API:', e.message);
      gamesData = [];
    }
  }
  return gamesData || [];
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Common security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // API Endpoints
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
      system: 'Cyberpunk Game Portal',
      version: '1.0.0'
    }));
  }

  // Normalize static file path
  if (pathname === '/') {
    pathname = '/index.html';
  }

  let filePath = path.join(PUBLIC_DIR, pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    return res.end('Access denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Check if it's a directory containing index.html
      const dirIndex = path.join(filePath, 'index.html');
      if (!err && stats.isDirectory() && fs.existsSync(dirIndex)) {
        filePath = dirIndex;
      } else {
        // Fallback for SPA routing if requested file doesn't have an extension
        if (!path.extname(filePath)) {
          filePath = path.join(PUBLIC_DIR, 'index.html');
        } else {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.end('<h1>404 Not Found</h1>');
        }
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    // Cache control: HTML fresh, assets cached
    if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', (streamErr) => {
      res.statusCode = 500;
      res.end('Server error reading file');
    });
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  CYBERPUNK GAMING PORTAL IS ONLINE`);
  console.log(`  Local URL:  http://localhost:${PORT}`);
  console.log(`  Mobile PWA: Ready`);
  console.log(`======================================================\n`);
});
