// Pre-computes the daily sims' seeds so phones never search for them: npm run daily [startDate] [days]
// Re-run whenever the physics changes (the determinism snapshots will have changed too).
import { writeFileSync } from 'node:fs';
import { dailySeedStart, dailySpecs } from '../src/app/feed';
import { pickSeed } from '../src/sim/seeds';

const start = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const days = Number(process.argv[3] ?? 430);
const out: Record<string, number[]> = {};
const d = new Date(`${start}T12:00:00Z`);
const t0 = Date.now();
for (let i = 0; i < days; i++) {
  const key = d.toISOString().slice(0, 10);
  out[key] = dailySpecs(key).map((spec, slot) => {
    const found = pickSeed({ ...spec, seed: 0 }, dailySeedStart(key, slot));
    if (!found) throw new Error(`no good seed for ${key} slot ${slot} (${JSON.stringify(spec)})`);
    return found.seed;
  });
  d.setUTCDate(d.getUTCDate() + 1);
}
writeFileSync(new URL('../src/data/daily.json', import.meta.url), JSON.stringify(out) + '\n');
console.log(`${days} days from ${start} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
