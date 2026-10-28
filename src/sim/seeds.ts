// Seed search (orbit.py's pick_seed): dry-run seeds until the run's length lands inside the target window, so a
// sim is neither over in two seconds nor endless.

import { dryRun, type Sim } from './sim';
import { type Spec, withDefaults } from './spec';

export function isGoodRun(sim: Sim): boolean {
  const r = sim.result;
  if (!r) return false;
  const [lo, hi] = withDefaults(sim.spec).target_seconds;
  if (r.seconds < lo || r.seconds > hi) return false;
  if (sim.spec.kind === 'escape' && !r.escaped) return false;
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
