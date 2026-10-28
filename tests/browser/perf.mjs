// node tests/browser/perf.mjs [cpuSlowdown=4]
import { chromium } from 'playwright';
import { createServer } from 'vite';

const slow = Number(process.argv[2] ?? 4);
const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: slow });
await page.goto(`${server.resolvedUrls.local[0]}tests/browser/perf.html`);
const res = await page.waitForFunction(() => window.__perf, null, { timeout: 300_000 }).then((h) => h.jsonValue());
console.log(`150 balls, ${slow}x CPU slowdown: ms/frame`, res, '(budget 16.7)');
if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
await browser.close();
await server.close();
