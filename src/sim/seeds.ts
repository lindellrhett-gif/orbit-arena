// Seed search (orbit.py's pick_seed): dry-run seeds until the run's length lands inside the target window, so a
// sim is neither over in two seconds nor endless.

import { dryRun, type Sim } from './sim';
import { type Spec, withDefaults } from './spec';

export function isGoodRun(sim: Sim): boolean {
  const r = sim.result;
  if (!r) return false;
  const [lo, hi] = withDefaults(sim.spec).target_seconds;
  if (r.seconds < lo || r.seconds > hi) return false;
  if (r.completed === false) return false;
  return true;
}

/** Returns the first seed at or after `start` whose run fits the spec's target window, plus that run. */
export function pickSeed(spec: Spec, start: number, maxTries = 400): { seed: number; sim: Sim } | null {
  for (let i = 0; i < maxTries; i++) {
    const seed = (start + i) >>> 0;
    const sim = dryRun({ ...spec, seed });
    if (isGoodRun(sim)) return { seed, sim };
  }
  return null;
}

/**
 * On-device search with a time budget (the sandbox, the endless feed): returns the first good seed, or after `ms`
 * the run that came closest to the window.
 */
export function pickSeedWithin(spec: Spec, start: number, ms: number): { seed: number; sim: Sim; fits: boolean } {
  const [lo, hi] = withDefaults(spec).target_seconds;
  const t0 = performance.now();
  let best: { seed: number; sim: Sim; miss: number } | null = null;
  for (let i = 0; i < 400; i++) {
    const seed = (start + i) >>> 0;
    const sim = dryRun({ ...spec, seed });
    if (isGoodRun(sim)) return { seed, sim, fits: true };
    const s = sim.result!.seconds;
    const miss = s < lo ? lo - s : s - hi;
    if (!best || miss < best.miss) best = { seed, sim, miss };
    if (performance.now() - t0 > ms) break;
  }
  return { seed: best!.seed, sim: best!.sim, fits: false };
}
