// Every sim kind, plus helpers to create and dry-run one from a spec.

import { Sim } from './base';
import { BattleSim } from './kinds/battle';
import { BlocksSim } from './kinds/blocks';
import { EscapeSim } from './kinds/escape';
import { GrowSim } from './kinds/grow';
import { MultiplySim } from './kinds/multiply';
import { OrbitSim } from './kinds/orbit';
import { RaceSim } from './kinds/race';
import type { Spec } from './spec';

export * from './base';
export { BattleSim, BlocksSim, EscapeSim, GrowSim, MultiplySim, OrbitSim, RaceSim };
export { FINISH_Y, FLOOR_Y, RACE_LEFT, RACE_RIGHT, RACE_TOP, RAMP_TOP } from './kinds/race';
export { HOLE_R } from './kinds/orbit';

export function createSim(spec: Spec): Sim {
  switch (spec.kind) {
    case 'escape': return new EscapeSim(spec);
    case 'battle': return new BattleSim(spec);
    case 'grow': return new GrowSim(spec);
    case 'multiply': return new MultiplySim(spec);
    case 'race': return new RaceSim(spec);
    case 'orbit': return new OrbitSim(spec);
    case 'blocks': return new BlocksSim(spec);
  }
}

/** Runs a sim headless until it has a result (or hits its time limit). */
export function dryRun(spec: Spec): Sim {
  const sim = createSim(spec);
  while (!sim.result) sim.stepFrame();
  return sim;
}
