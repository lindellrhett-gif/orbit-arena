// App Store screenshots at the 6.9-inch size (1320x2868): npm run build && node scripts/store-screens.mjs [outDir]
// A 440x956 phone at 3x with the iPhone's safe areas added by hand (Chromium has no notch). The Extras shot runs
// the page as the iOS app does, with example prices, so the cards show prices rather than "iOS app".
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { preview } from 'vite';

const out = process.argv[2] ?? 'screens/store';
mkdirSync(out, { recursive: true });
const server = await preview({ preview: { port: 4180 }, logLevel: 'error' });
const base = server.resolvedUrls.local[0];
const SAFE = '#app { padding-top: 62px !important; padding-bottom: 34px !important; } .panel { padding-top: 74px !important; }';
const PRICES = { everything: '$3.99', hd: '$1.99', skins: '$1.99', melodies: '$0.99', slots: '$0.99' };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

async function open(query, { native = false } = {}) {
  const page = await context.newPage();
  if (native) {
    await page.addInitScript(() => {
      window.__ORBIT_NATIVE__ = { saved: {}, owned: [] };
      window.ReactNativeWebView = { postMessage() {} };
    });
  }
  await page.goto(`${base}${query ? `?${query}` : ''}`);
  await page.addStyleTag({ content: SAFE });
  return page;
}

const shots = [
  ['1-pick', 'v=1&k=battle&s=7&m=canon&colors=red,blue,green,yellow,orange,purple', async (p) => {
    await p.waitForSelector('#pick:not([hidden])');
    await p.waitForTimeout(500);
  }],
  ['2-race', 'v=1&k=race&s=7&m=greensleeves&colors=red,blue,green,yellow,orange,purple', async (p) => {
    await p.waitForSelector('#pick:not([hidden])');
    await p.locator('.opt', { hasText: /BLUE/ }).first().click();
    await p.waitForTimeout(9000);
  }],
  ['3-escape', 'v=1&k=escape&s=7&m=mountain_king&rings=6', async (p) => {
    await p.waitForSelector('#pick:not([hidden])');
    await p.locator('.opt', { hasText: /Under/i }).first().click();
    await p.waitForTimeout(5000);
  }],
  ['4-result', 'v=1&k=battle&s=7&m=nachtmusik&countries=us,br,jp,de,in,mx', async (p) => {
    await p.waitForSelector('#pick:not([hidden])');
    await p.locator('.opt').first().click();
    await p.waitForSelector('#result:not([hidden])', { timeout: 120_000 });
    await p.waitForTimeout(500);
  }],
  ['5-build', '', async (p) => {
    await p.waitForTimeout(1500);
    await p.click('#build-btn');
    await p.waitForTimeout(500);
  }],
  ['6-extras', '', async (p) => {
    await p.waitForTimeout(1500);
    await p.evaluate((prices) => window.__orbitFromNative?.({ type: 'iap-state', ready: true, owned: [], prices }), PRICES);
    await p.click('#menu-btn');
    await p.waitForTimeout(300);
    await p.click('#extras-btn');
    await p.waitForTimeout(600);
    await p.locator('#shop .chip-btn', { hasText: 'Planet' }).click();
    await p.locator('#shop .chip-btn', { hasText: 'Comet' }).click();
    await p.waitForTimeout(2500);
  }, true],
];

for (const [name, query, act, native] of shots) {
  const page = await open(query, { native });
  await act(page);
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.close();
  console.log(`${out}/${name}.png`);
}
await browser.close();
server.httpServer.close();
