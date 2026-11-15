import http from 'http';
import server from '../server.js';

function makeRequest(path, options = {}) {
  const address = server.address();
  const port = address ? address.port : 3000;
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: port,
      path,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: data
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function runSecurityTests() {
  console.log('== Running Server Security & API Tests ==');

  let passed = 0;
  let failed = 0;

  function assert(name, condition) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  try {
    // 1. Directory Traversal tests
    const trav1 = await makeRequest('/../package.json');
    assert('Blocks /../package.json with 403 or 404 (no file leak)', trav1.statusCode === 403 || trav1.statusCode === 404);
    assert('Traversal 1 does not leak package.json', !trav1.body.includes('"name": "cyberpunk-gamesite"'));

    const trav2 = await makeRequest('/%2e%2e/server.js');
    assert('Blocks /%2e%2e/server.js with 403 or 404', trav2.statusCode === 403 || trav2.statusCode === 404);
    assert('Traversal 2 does not leak server.js', !trav2.body.includes('require(\'http\')'));

    const trav3 = await makeRequest('/../../public-evil/test');
    assert('Blocks sibling path traversal', trav3.statusCode === 403 || trav3.statusCode === 404);

    const missing404 = await makeRequest('/nonexistent-page');
    assert('Returns 404 for unknown extensionless route', missing404.statusCode === 404);

    // 2. Malformed URI tests
    const malformed = await makeRequest('/%ff%fe%fd');
    assert('Handles malformed URI gracefully with 400 Bad Request', malformed.statusCode === 400);

    const malformed2 = await makeRequest('/test%');
    assert('Handles trailing percent malformed URI with 400 Bad Request', malformed2.statusCode === 400);

    // 3. Security Headers tests
    const home = await makeRequest('/');
    assert('Returns X-Content-Type-Options: nosniff', home.headers['x-content-type-options'] === 'nosniff');
    assert('Returns X-Frame-Options: SAMEORIGIN', home.headers['x-frame-options'] === 'SAMEORIGIN');
    assert('Returns Referrer-Policy', !!home.headers['referrer-policy']);

    // 4. API Endpoints tests
    const apiGames = await makeRequest('/api/games');
    assert('GET /api/games returns 200', apiGames.statusCode === 200);
    const catalog = JSON.parse(apiGames.body);
    assert('Catalog has total 16 games', catalog.total === 16 && catalog.games.length === 16);

    const apiFilter = await makeRequest('/api/games?category=arcade');
    assert('Filter category=arcade works', apiFilter.statusCode === 200);
    const arcadeGames = JSON.parse(apiFilter.body);
    assert('Category arcade has 5 games', arcadeGames.total === 5);

    const apiSearch = await makeRequest('/api/games?search=snake');
    const searchRes = JSON.parse(apiSearch.body);
    assert('Search query works', searchRes.total >= 1 && searchRes.games[0].id === 'neon-snake');

    const apiSingle = await makeRequest('/api/games/neon-snake');
    assert('GET /api/games/neon-snake returns 200', apiSingle.statusCode === 200);
    const snake = JSON.parse(apiSingle.body);
    assert('Single game ID matches', snake.id === 'neon-snake');

    const api404 = await makeRequest('/api/games/nonexistent-game-id');
    assert('GET /api/games/nonexistent returns 404', api404.statusCode === 404);

    const apiStats = await makeRequest('/api/stats');
    assert('GET /api/stats returns 200', apiStats.statusCode === 200);
    const stats = JSON.parse(apiStats.body);
    assert('Stats reports totalGames: 16', stats.totalGames === 16);

    // 5. SPA Routing tests
    const spaGame = await makeRequest('/game/neon-snake');
    assert('GET /game/neon-snake returns 200 with index.html', spaGame.statusCode === 200 && spaGame.body.includes('NEON ARCADE'));

    const spaDirect = await makeRequest('/game/solitaire');
    assert('GET /game/solitaire returns 200 with index.html', spaDirect.statusCode === 200 && spaDirect.body.includes('NEON ARCADE'));

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    server.close(() => {
      process.exit(failed > 0 ? 1 : 0);
    });
  }
}

runSecurityTests();
