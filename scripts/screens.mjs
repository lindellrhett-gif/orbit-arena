// Takes phone-sized screenshots of the built app for reports: npm run build && node scripts/screens.mjs [outDir]
// Opens share links for each kind, makes a pick, and captures the pick sheet, mid-run and result.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { preview } from 'vite';

const out = process.argv[2] ?? 'screens';
mkdirSync(out, { recursive: true });
const server = await preview({ preview: { port: 4179 }, logLevel: 'error' });
const base = server.resolvedUrls.local[0];

const runs = [
  ['escape', 'k=escape&s=SEED&m=fur_elise', 'Under'],
  ['escape6', 'k=escape&s=SEED&m=mountain_king&rings=6', 'Under'],
  ['battle', 'k=battle&s=SEED&m=canon&colors=red,blue,green,yellow,orange,purple', 'RED'],
  ['countries', 'k=battle&s=SEED&m=nachtmusik&countries=us,br,jp,de,in,mx', 'USA'],
  ['race', 'k=race&s=SEED&m=greensleeves&colors=red,blue,green,yellow,orange,purple', 'RED'],
];
const seeds = JSON.parse(process.env.SEEDS ?? '{}');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
for (const [name, query, pick] of runs) {
  await page.goto(`${base}?${query.replace('SEED', String(seeds[name] ?? 7))}`);
  await page.waitForSelector('#pick:not([hidden])');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}-1-pick.png` });
  await page.locator('.opt', { hasText: new RegExp(pick, 'i') }).first().click();
  await page.waitForTimeout(Number(process.env.MID ?? 6000));
  await page.screenshot({ path: `${out}/${name}-2-play.png` });
  await page.waitForSelector('#result:not([hidden])', { timeout: 120_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}-3-result.png` });
}
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(base);
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/desktop.png` });
await browser.close();
server.httpServer.close();
console.log('screens in', out);
