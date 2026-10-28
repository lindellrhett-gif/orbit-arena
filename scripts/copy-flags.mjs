// Packs the square flag-icons SVGs into one 16x16 sprite sheet (96 px cells) at src/assets/flags/atlas.webp and
// writes src/data/countries.json (codes from the channel's codes.json that have a flag) and flag-index.json.
// Run once after upgrading flag-icons: npm run flags
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const CELL = 96;
const COLS = 16;
const root = new URL('..', import.meta.url).pathname;
const svgDir = join(root, 'node_modules/flag-icons/flags/1x1');
const codes = JSON.parse(readFileSync(join(root, 'src/data/codes.json'), 'utf8'));
const available = {};
for (const [code, name] of Object.entries(codes)) {
  if (existsSync(join(svgDir, `${code}.svg`))) available[code] = name;
}
const list = Object.keys(available);
const rows = Math.ceil(list.length / COLS);
const cells = list
  .map((code) => {
    const svg = readFileSync(join(svgDir, `${code}.svg`), 'utf8').replace('<svg', `<svg width="${CELL}" height="${CELL}"`);
    return `<div style="width:${CELL}px;height:${CELL}px;overflow:hidden">${svg}</div>`;
  })
  .join('');
const html = `<html><body style="margin:0"><div style="display:grid;grid-template-columns:repeat(${COLS},${CELL}px)">${cells}</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: COLS * CELL, height: rows * CELL } });
await page.setContent(html);
const png = join(root, 'src/assets/flags/atlas.png');
await page.screenshot({ path: png, clip: { x: 0, y: 0, width: COLS * CELL, height: rows * CELL } });
await browser.close();
execFileSync('convert', [png, '-quality', '90', join(root, 'src/assets/flags/atlas.webp')]);
unlinkSync(png);

writeFileSync(join(root, 'src/data/countries.json'), JSON.stringify(available, null, 1) + '\n');
writeFileSync(join(root, 'src/data/flag-index.json'), JSON.stringify({ cell: CELL, cols: COLS, rows, codes: list }) + '\n');
console.log(`${list.length} flags packed (${COLS}x${rows})`);
