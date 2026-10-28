// Shared by the Vitest run (Node/V8) and the browser run (Chromium, Firefox, WebKit) so both hash the same runs.
import { createSim } from '../src/sim/sim';
import type { Spec } from '../src/sim/spec';

export type Case = { name: string; spec: Spec };

const kinds: Omit<Spec, 'seed'>[] = [
  { kind: 'escape', melody: 'fur_elise' },
  { kind: 'escape', melody: 'canon', rings: 6 },
  { kind: 'escape', melody: 'twinkle', grow: 0.8 },
  { kind: 'battle', melody: 'ode_to_joy', colors: ['red', 'blue', 'green', 'yellow', 'orange', 'purple'] },
  { kind: 'battle', melody: 'nachtmusik', countries: ['us', 'br', 'jp', 'de', 'in', 'mx'] },
  { kind: 'race', melody: 'greensleeves', colors: ['red', 'blue', 'green', 'yellow', 'orange', 'purple'] },
];

export const DETERMINISM_CASES: Case[] = kinds.flatMap((k, ki) =>
  Array.from({ length: 20 }, (_, i) => {
    const spec = { ...k, seed: i + 1 } as Spec;
    return { name: `${k.kind}-${ki}-seed${i + 1}`, spec };
  }),
);

/** Runs a case for up to 30 seconds of sim time (or to its result plus one second) and hashes the state. */
export function fingerprintCase(c: Case): string {
  const sim = createSim(c.spec);
  let after = 0;
  while (sim.frame < 30 * 60 && after < 60) {
    sim.stepFrame();
    if (sim.result) after++;
  }
  return sim.fingerprint();
}
