// Cross-browser determinism check: serves dist/ and opens tests/browser/determinism.html in each installed
// Playwright browser. Usage: npm run build && npm run test:browsers [chromium firefox webkit]
import * as pw from 'playwright';
import { createServer } from 'vite';

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ['chromium', 'firefox', 'webkit'];
const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const url = `${server.resolvedUrls.local[0]}tests/browser/determinism.html`;

let failed = false;
for (const name of wanted) {
  let browser;
  try {
    browser = await pw[name].launch();
  } catch (err) {
    console.log(`${name}: not installed, skipped (${String(err.message).split('\n')[0]})`);
    continue;
  }
  const page = await browser.newPage();
  await page.goto(url);
  const res = await page.waitForFunction(() => window.__determinism, null, { timeout: 180_000 }).then((h) => h.jsonValue());
  const ok = res.mismatches.length === 0;
  failed ||= !ok;
  console.log(`${name}: ${ok ? 'OK' : 'MISMATCH'} ${res.cases} cases in ${res.ms} ms  (${res.ua})`);
  for (const m of res.mismatches.slice(0, 10)) console.log('   ', m);
  await browser.close();
}
await server.close();
process.exit(failed ? 1 : 0);
