// Rasterizes the square flag-icons SVGs to 128x128 PNGs in public/flags and writes src/data/countries.json
// (the codes from the channel's codes.json that have a flag). Run once after upgrading flag-icons: npm run flags
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const svgDir = join(root, 'node_modules/flag-icons/flags/1x1');
const outDir = join(root, 'public/flags');
mkdirSync(outDir, { recursive: true });

const codes = JSON.parse(readFileSync(join(root, 'src/data/codes.json'), 'utf8'));
const available = {};
for (const [code, name] of Object.entries(codes)) {
  if (existsSync(join(svgDir, `${code}.svg`))) available[code] = name;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 128, height: 128 } });
for (const code of Object.keys(available)) {
  const svg = readFileSync(join(svgDir, `${code}.svg`), 'utf8');
  const html = `<html><body style="margin:0"><div style="width:128px;height:128px">${svg.replace('<svg', '<svg width="128" height="128"')}</div></body></html>`;
  await page.setContent(html);
  await page.screenshot({ path: join(outDir, `${code}.png`), clip: { x: 0, y: 0, width: 128, height: 128 } });
}
await browser.close();

writeFileSync(join(root, 'src/data/countries.json'), JSON.stringify(available, null, 1) + '\n');
console.log(`${Object.keys(available).length} flags written; missing:`,
  Object.keys(codes).filter((c) => !(c in available)).join(' '));
