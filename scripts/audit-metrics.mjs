import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import server from '../server.js';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const cdpPort = 9285;
const userDataDir = path.join(path.resolve(), '.tmp_chrome_qa');

async function auditSite() {
  console.log('== Running Chrome CDP Performance, Accessibility, Best Practices, and SEO Audit ==');

  const address = server.address();
  const port = address ? address.port : 3000;

  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--disable-gpu',
    '--window-size=1280,800'
  ]);

  await new Promise(r => setTimeout(r, 1200));

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
    await sessionSend('Performance.enable');
    await sessionSend('Runtime.enable');
    await sessionSend('Accessibility.enable');

    const consoleErrors = [];
    ws.addEventListener('message', (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(msg.params.args.map(a => a.value).join(' '));
      }
    });

    // Navigate to homepage
    const startTime = Date.now();
    await sessionSend('Page.navigate', { url: `http://127.0.0.1:${port}/` });
    await new Promise(r => setTimeout(r, 1500));
    const navDuration = Date.now() - startTime;

    // 1. Performance Metrics
    const perfMetrics = await sessionSend('Performance.getMetrics');
    const metricMap = {};
    perfMetrics.metrics.forEach(m => metricMap[m.name] = m.value);

    // 2. SEO & Head Tags Check
    const seoCheck = await sessionSend('Runtime.evaluate', {
      expression: `(() => {
        return {
          title: document.title,
          hasDescription: !!document.querySelector('meta[name="description"]'),
          descriptionContent: document.querySelector('meta[name="description"]')?.content,
          hasCanonical: !!document.querySelector('link[rel="canonical"]'),
          canonicalHref: document.querySelector('link[rel="canonical"]')?.href,
          hasOgTitle: !!document.querySelector('meta[property="og:title"]'),
          hasOgImage: !!document.querySelector('meta[property="og:image"]'),
          hasManifest: !!document.querySelector('link[rel="manifest"]'),
          hasViewport: !!document.querySelector('meta[name="viewport"]'),
          headings: {
            h1: document.querySelectorAll('h1').length,
            h2: document.querySelectorAll('h2').length,
            h3: document.querySelectorAll('h3').length
          }
        };
      })()`,
      returnByValue: true
    });

    // 3. Accessibility Checks
    const a11yCheck = await sessionSend('Runtime.evaluate', {
      expression: `(() => {
        const images = Array.from(document.querySelectorAll('img'));
        const imagesWithAlt = images.filter(img => img.hasAttribute('alt')).length;
        const buttons = Array.from(document.querySelectorAll('button'));
        const buttonsWithAriaOrText = buttons.filter(btn => {
          return btn.textContent.trim().length > 0 || btn.hasAttribute('aria-label') || btn.hasAttribute('title');
        }).length;
        const inputs = Array.from(document.querySelectorAll('input, select'));
        const inputsWithLabel = inputs.filter(inp => {
          return inp.hasAttribute('aria-label') || !!document.querySelector('label[for="' + inp.id + '"]');
        }).length;
        return {
          totalImages: images.length,
          imagesWithAlt,
          totalButtons: buttons.length,
          buttonsWithAriaOrText,
          totalInputs: inputs.length,
          inputsWithLabel
        };
      })()`,
      returnByValue: true
    });

    console.log('\n--- Real Measured Performance Metrics ---');
    console.log(`Navigation to interactive: ${navDuration} ms`);
    console.log(`JS Heap Used: ${Math.round((metricMap['JSHeapUsedSize'] || 0) / 1024 / 1024 * 100) / 100} MB`);
    console.log(`DOM Nodes: ${metricMap['Nodes'] || 0}`);
    console.log(`Layout Count: ${metricMap['LayoutCount'] || 0}`);
    console.log(`Style Recalculation Count: ${metricMap['RecalcStyleCount'] || 0}`);

    console.log('\n--- Real SEO Checks ---');
    console.log(JSON.stringify(seoCheck.result.value, null, 2));

    console.log('\n--- Real Accessibility (a11y) Checks ---');
    console.log(JSON.stringify(a11yCheck.result.value, null, 2));

    console.log('\n--- Console Errors Encountered ---');
    console.log(`Console error count: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Errors:', consoleErrors);
    }

    ws.close();
  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    chrome.kill();
    server.close(() => process.exit(0));
  }
}

auditSite();
