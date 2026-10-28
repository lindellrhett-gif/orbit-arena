// Runs every determinism case in the browser and compares against the snapshots recorded under Node. Opened by
// tests/browser/determinism.mjs in Chromium, Firefox and WebKit (Safari's engine).
import snapshots from '../determinism.snap.json';
import { DETERMINISM_CASES, fingerprintCase } from '../determinism-cases';

const stored = snapshots as Record<string, string>;
const mismatches: string[] = [];
const t0 = performance.now();
for (const c of DETERMINISM_CASES) {
  const got = fingerprintCase(c);
  if (got !== stored[c.name]) mismatches.push(`${c.name}: ${got} != ${stored[c.name]}`);
}
const summary = {
  cases: DETERMINISM_CASES.length,
  mismatches,
  ms: Math.round(performance.now() - t0),
  ua: navigator.userAgent,
};
document.getElementById('out')!.textContent = JSON.stringify(summary, null, 2);
(window as unknown as { __determinism: typeof summary }).__determinism = summary;
