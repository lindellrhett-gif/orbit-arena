// Prints how long runs last per kind, to tune the physics: npx vite-node scripts/survey.ts [kind] [n]
import { dryRun } from '../src/sim/sim';
import type { Kind, Spec } from '../src/sim/spec';

const kind = (process.argv[2] ?? 'escape') as Kind;
const n = Number(process.argv[3] ?? 20);
const extra: Partial<Spec> = JSON.parse(process.argv[4] ?? '{}');
const times: number[] = [];
const t0 = performance.now();
for (let seed = 1; seed <= n; seed++) {
  const sim = dryRun({ kind, seed, melody: 'fur_elise', colors: ['red', 'blue', 'green', 'yellow', 'orange', 'purple'], ...extra });
  times.push(sim.result!.seconds);
  console.log(seed, sim.result!.headline, sim.result!.seconds.toFixed(1), 'bounces', sim.result!.bounces, sim.result!.order.join(','));
}
times.sort((a, b) => a - b);
console.log('median', times[Math.floor(n / 2)].toFixed(1), 'min', times[0].toFixed(1), 'max', times[n - 1].toFixed(1),
  'ms/run', ((performance.now() - t0) / n).toFixed(1));
