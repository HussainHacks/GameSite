import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import server from '../server.js';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const cdpPort = 9265;
const userDataDir = path.join(path.resolve(), '.tmp_chrome_qa');

async function runBrowserTests() {
  console.log('== Running Headless Chrome Browser Integration Test Suite ==');

  const address = server.address();
  const port = address ? address.port : 3000;
  console.log(`Target server port: ${port}`);

  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--disable-gpu',
    '--window-size=1280,800'
  ]);

  await new Promise(r => setTimeout(r, 1500));

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
    const vRes = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
    const { webSocketDebuggerUrl } = await vRes.json();
    const ws = new WebSocket(webSocketDebuggerUrl);

    let msgId = 1;
    const send = (method, params = {}) => new Promise((resolve) => {
      const id = msgId++;
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await new Promise(r => ws.onopen = r);

    // Create browser tab
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

    const sessionSend = (method, params = {}) => new Promise((resolve) => {
      const id = msgId++;
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

    await sessionSend('Page.enable');
    await sessionSend('Runtime.enable');

    const evalJs = async (expr) => {
      const res = await sessionSend('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      });
      if (res && res.exceptionDetails) {
        console.warn('JS Eval Exception Details:', res.exceptionDetails.text);
      }
      return res && res.result ? res.result.value : null;
    };

    // 1. Initial Page Load Test
    console.log('\n--- Test 1: Initial Page Load ---');
    await sessionSend('Page.navigate', { url: `http://127.0.0.1:${port}/` });
    await new Promise(r => setTimeout(r, 1000));
    // Clear any previous session state to guarantee clean test environment
    await evalJs(`localStorage.clear(); sessionStorage.clear();`);
    await sessionSend('Page.reload');
    await new Promise(r => setTimeout(r, 1000));

    const cardCount = await evalJs(`document.querySelectorAll('.game-card').length`);
    assert('Renders 16 game cards on home page', cardCount === 16);

    const titleText = await evalJs(`document.title`);
    assert('Title contains NEON ARCADE', titleText.includes('NEON ARCADE'));

    const brandGameCount = await evalJs(`document.getElementById('headerGameCount')?.textContent`);
    assert('Header displays accurate 16 games', brandGameCount === '16');

    // 2. Responsive Viewports & Zero Horizontal Overflow Test
    console.log('\n--- Test 2: Responsive Viewports (Zero Overflow) ---');
    const viewports = [320, 375, 390, 768, 1024, 1440];
    for (const w of viewports) {
      await sessionSend('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 800,
        deviceScaleFactor: 1,
        mobile: w <= 768
      });
      await new Promise(r => setTimeout(r, 200));

      const overflowCheck = await evalJs(`({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth
      })`);

      assert(`Viewport ${w}px: innerWidth is exactly ${w}`, overflowCheck.innerWidth === w);
      assert(`Viewport ${w}px: no horizontal overflow (scrollWidth <= ${w})`, overflowCheck.scrollWidth <= w && overflowCheck.bodyScrollWidth <= w);
    }

    // 3. Search & Filter Tests
    console.log('\n--- Test 3: Search & Category Filters ---');
    // Search for "snake"
    await evalJs(`
      const input = document.getElementById('searchInput');
      input.value = 'snake';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    `);
    await new Promise(r => setTimeout(r, 300));
    const searchCards = await evalJs(`document.querySelectorAll('.game-card').length`);
    assert('Searching "snake" returns exactly 1 card', searchCards === 1);

    // Clear search
    await evalJs(`document.getElementById('searchClearBtn').click();`);
    await new Promise(r => setTimeout(r, 300));
    const resetCards = await evalJs(`document.querySelectorAll('.game-card').length`);
    assert('Clearing search restores 16 cards', resetCards === 16);

    // Filter "puzzle"
    await evalJs(`document.querySelector('[data-cat="puzzle"]').click();`);
    await new Promise(r => setTimeout(r, 300));
    const puzzleCards = await evalJs(`document.querySelectorAll('.game-card').length`);
    assert('Puzzle category displays 5 games', puzzleCards === 5);

    // Reset to "all"
    await evalJs(`document.querySelector('[data-cat="all"]').click();`);
    await new Promise(r => setTimeout(r, 300));

    // 4. Favorites & Persistence Test
    console.log('\n--- Test 4: Favorites Persistence ---');
    await evalJs(`document.querySelector('.game-card[data-id="neon-snake"] .card-fav-btn').click();`);
    await new Promise(r => setTimeout(r, 200));
    const favCount = await evalJs(`document.getElementById('favCountBadge')?.textContent`);
    assert('Favorite badge increments to 1', favCount === '1');

    await evalJs(`document.querySelector('[data-cat="favorites"]').click();`);
    await new Promise(r => setTimeout(r, 200));
    const favCards = await evalJs(`document.querySelectorAll('.game-card').length`);
    assert('Favorites filter displays 1 game (neon-snake)', favCards === 1);

    // Reset to all
    await evalJs(`document.querySelector('[data-cat="all"]').click();`);
    await new Promise(r => setTimeout(r, 200));

    // 5. Game Launch, Loading, Player, and History URL Test
    console.log('\n--- Test 5: Game Launch, Routing & Player Modal ---');
    // Launch Cyber Snake
    await evalJs(`document.querySelector('.game-card[data-id="neon-snake"]').click();`);
    await new Promise(r => setTimeout(r, 500));

    const isModalActive = await evalJs(`document.getElementById('gameModal').classList.contains('active')`);
    assert('Modal opens with active class', isModalActive === true);

    const bodyLocked = await evalJs(`document.body.classList.contains('modal-open')`);
    assert('Body scroll is locked', bodyLocked === true);

    const gameUrl = await evalJs(`window.location.pathname`);
    assert('URL updates to /game/neon-snake', gameUrl === '/game/neon-snake');

    const iframeSrc = await evalJs(`document.getElementById('modalIframe').src`);
    assert('Iframe loads local snake index.html', iframeSrc.includes('/games/snake/index.html'));

    const playsTracked = await evalJs(`JSON.parse(localStorage.getItem('neon_arcade_plays') || '{}')['neon-snake']`);
    assert('Play count incremented in storage for neon-snake', playsTracked >= 1);

    // Close game via back button
    await evalJs(`document.getElementById('modalBackBtn').click();`);
    await new Promise(r => setTimeout(r, 300));

    const isModalClosed = await evalJs(`!document.getElementById('gameModal').classList.contains('active')`);
    assert('Modal closes cleanly', isModalClosed === true);

    const restoredUrl = await evalJs(`window.location.pathname`);
    assert('URL resets to / on modal close', restoredUrl === '/');

    // 6. Direct Game URL Navigation & Browser Refresh Test
    console.log('\n--- Test 6: Direct Game URL Navigation ---');
    await sessionSend('Page.navigate', { url: `http://127.0.0.1:${port}/game/solitaire` });
    await new Promise(r => setTimeout(r, 1200));

    const directModalActive = await evalJs(`document.getElementById('gameModal').classList.contains('active')`);
    assert('Direct visit to /game/solitaire auto-launches player', directModalActive === true);

    const directTitle = await evalJs(`document.getElementById('modalGameTitle').textContent`);
    assert('Player displays Klondike Solitaire', directTitle.includes('Solitaire'));

    // Browser back button
    await evalJs(`window.history.back();`);
    await new Promise(r => setTimeout(r, 500));

    const backModalClosed = await evalJs(`!document.getElementById('gameModal').classList.contains('active')`);
    assert('Browser Back button closes modal', backModalClosed === true);

    // 7. Storage Crash Immunity Test
    console.log('\n--- Test 7: Storage Crash Immunity ---');
    await evalJs(`(() => {
      try {
        if (window.safeStorage) {
          window.safeStorage.setItem = () => { throw new Error('Simulated QuotaExceededError'); };
          window.safeStorage.getItem = () => { throw new Error('Simulated SecurityError'); };
        }
        return true;
      } catch (e) {
        return false;
      }
    })()`);

    // Launch Cyber Runner under broken storage
    const storageTestResult = await evalJs(`(() => {
      try {
        const card = document.querySelector('.game-card[data-id="cyber-runner"]');
        if (card) card.click();
        return true;
      } catch (err) {
        return err.message;
      }
    })()`);
    assert('Application launches game safely when storage throws', storageTestResult === true);

    const runnerModalActive = await evalJs(`document.getElementById('gameModal').classList.contains('active')`);
    assert('Cyber Runner modal active despite storage error', runnerModalActive === true);

    ws.close();
  } catch (err) {
    console.error('Browser test failure:', err);
    failed++;
  } finally {
    console.log(`\nBrowser Integration Results: ${passed} passed, ${failed} failed.`);
    chrome.kill();
    server.close(() => {
      process.exit(failed > 0 ? 1 : 0);
    });
  }
}

runBrowserTests();
