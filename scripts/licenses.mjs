// Writes public/licenses.html: the notices that open-source licenses ask us to ship with the game and the iOS app.
// Run after changing dependencies (root or mobile/): npm run licenses
// It lists the game's own third-party parts (flags, font, offline cache, trig code), then every production
// dependency of the iOS app grouped by license, with each package's copyright lines and each license's full text.
// Copyleft licenses are printed to the console so they get a human look.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pre = (s) => `<pre>${esc(s.trim())}</pre>`;

function licenseText(dir) {
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  return file ? readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n') : '';
}

function noticeText(dir) {
  const file = readdirSync(dir).find((f) => /^notice(\.(md|txt))?$/i.test(f));
  return file ? readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n') : '';
}

function spdx(pkg) {
  const l = pkg.license ?? pkg.licenses?.[0]?.type ?? pkg.licenses?.[0] ?? 'UNKNOWN';
  return typeof l === 'string' ? l : l.type ?? 'UNKNOWN';
}

const FDLIBM = `Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.

Developed at SunPro, a Sun Microsystems, Inc. business.
Permission to use, copy, modify, and distribute this
software is freely granted, provided that this notice
is preserved.`;

// ---- the game itself (web app, also bundled into the iOS app)
const game = [
  ['Country flags: flag-icons', 'MIT', licenseText(join(root, 'node_modules/flag-icons'))],
  ['Font: Saira Semi Condensed (via @fontsource)', 'SIL Open Font License 1.1', licenseText(join(root, 'node_modules/@fontsource/saira-semi-condensed'))],
  ['Offline support: Workbox (website only)', 'MIT', licenseText(join(root, 'node_modules/workbox-core'))],
  ['Deterministic trig: kernels and constants from fdlibm', 'fdlibm (Sun Microsystems)', FDLIBM],
];
for (const [name, , text] of game) if (!text.trim()) throw new Error(`No license text found for ${name}`);

// ---- every production dependency of the iOS app
const listing = execSync('npm ls --omit=dev --all --parseable --long', { cwd: join(root, 'mobile'), encoding: 'utf8', maxBuffer: 64 << 20 })
  .split(/\r?\n/)
  .slice(1)
  .filter(Boolean);
const seen = new Set();
const groups = new Map();
for (const line of listing) {
  const cut = line.lastIndexOf(':');
  const dir = line.slice(0, cut);
  const id = line.slice(cut + 1);
  if (seen.has(id) || !existsSync(join(dir, 'package.json'))) continue;
  seen.add(id);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const license = spdx(pkg);
  const text = licenseText(dir);
  const copyright = [...new Set(text.split('\n').map((l) => l.trim()).filter((l) => /^(copyright|\(c\)|©)/i.test(l)))];
  if (!groups.has(license)) groups.set(license, []);
  groups.get(license).push({ id, text, copyright, notice: noticeText(dir) });
}

const COPYLEFT = /(^|[^L])GPL|LGPL|AGPL|MPL|EPL|CDDL|CC-BY-SA|EUPL/i;
const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [license, pkgs] of sorted) {
  const flag = COPYLEFT.test(license) ? '  <-- copyleft, check' : '';
  console.log(`${String(pkgs.length).padStart(4)}  ${license}${flag}`);
}

const appSections = sorted.map(([license, pkgs]) => {
  pkgs.sort((a, b) => a.id.localeCompare(b.id));
  const items = pkgs
    .map((p) => `<li><b>${esc(p.id)}</b>${p.copyright.length ? `<br><span class="dim">${esc(p.copyright.join(' · '))}</span>` : ''}</li>`)
    .join('\n');
  // Standard licenses: one copy of the terms (each package's own copyright line is listed above). Anything else, or
  // a package with a NOTICE file, gets its own full text.
  const standard = /^(MIT|ISC|BSD-2-Clause|BSD-3-Clause|0BSD|Apache-2\.0)$/.test(license);
  const sample = pkgs.find((p) => p.text.trim());
  const texts = standard
    ? (sample ? pre(sample.text) : '')
    : pkgs.filter((p) => p.text.trim()).map((p) => `<h4>${esc(p.id)}</h4>${pre(p.text)}`).join('\n');
  const notices = pkgs.filter((p) => p.notice.trim()).map((p) => `<h4>NOTICE: ${esc(p.id)}</h4>${pre(p.notice)}`).join('\n');
  return `<h3>${esc(license)} (${pkgs.length})</h3>
<details><summary>Packages</summary><ul>${items}</ul></details>
<details><summary>License text</summary>${texts}${notices}</details>`;
});

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Orbit Arena · Open-source licenses</title>
    <style>
      body { background: #07080e; color: #eceeff; font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 24px 18px 48px; }
      main { max-width: 760px; margin: 0 auto; }
      h1 { font-size: 28px; margin: 0 0 4px; }
      h2 { font-size: 20px; margin-top: 32px; }
      h3 { font-size: 17px; margin: 22px 0 6px; }
      h4 { font-size: 14px; margin: 14px 0 4px; }
      a { color: #38bdf8; }
      .dim { color: rgba(236, 238, 255, 0.6); font-size: 13px; }
      pre { white-space: pre-wrap; font: 12px/1.45 ui-monospace, Menlo, monospace; background: #05060b; padding: 10px; border-radius: 10px; color: #c9cdf5; }
      summary { cursor: pointer; color: #38bdf8; margin: 4px 0; }
      ul { padding-left: 18px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Open-source licenses</h1>
      <p class="dim">Generated by scripts/licenses.mjs. Orbit Arena's own code, look and name are not covered by these licenses.</p>
      <p>
        Orbit Arena is built with open-source software and assets. Their licenses ask us to share their notices, which
        are below. The melodies are public-domain compositions, synthesized in the app. National flags are public domain;
        the drawings of them come from flag-icons.
      </p>
      <h2>In the game</h2>
      ${game.map(([name, license, text]) => `<h3>${esc(name)}</h3><p class="dim">${esc(license)}</p>${pre(text)}`).join('\n      ')}
      <h2>In the iOS app</h2>
      <p class="dim">
        Every package the iOS app depends on (${seen.size} in all), grouped by license. Some are only used to build the
        app, for example lightningcss, node-forge, caniuse-lite and argparse; they're listed to be complete. Where a
        package offers a choice of licenses, we use the permissive one (node-forge: BSD-3-Clause).
      </p>
      ${appSections.join('\n      ')}
      <p><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a> · <a href="./">Back to Orbit Arena</a></p>
    </main>
  </body>
</html>
`;
writeFileSync(join(root, 'public/licenses.html'), html);
console.log(`public/licenses.html: ${seen.size} iOS packages, ${(html.length / 1024).toFixed(0)} KB`);
