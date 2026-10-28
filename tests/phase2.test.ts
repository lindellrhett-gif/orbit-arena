import { beforeEach, describe, expect, it } from 'vitest';
import { tidySpec } from '../src/app/builder';
import { bestDays, dailyStreak, recordPick, recordWatch, store } from '../src/app/store';
import { cleanCredit, specToYaml } from '../src/app/submit';
import { pickSeedWithin } from '../src/sim/seeds';
import { BlocksSim, GrowSim, MultiplySim, OrbitSim, createSim, dryRun } from '../src/sim/sim';
import type { Spec } from '../src/sim/spec';

describe('new kinds', () => {
  it('grow fills the ring', () => {
    const sim = dryRun({ kind: 'grow', seed: 3, melody: 'canon' }) as GrowSim;
    expect(sim.result!.completed).toBe(true);
    expect(sim.result!.headline).toMatch(/^\d+ BOUNCES!$/);
  });
  it('multiply stops at the cap', () => {
    const sim = dryRun({ kind: 'multiply', seed: 3, melody: 'canon', cap: 50 }) as MultiplySim;
    expect(sim.balls.length).toBe(50);
    expect(sim.result!.headline).toBe('50 BALLS!');
  });
  it('orbit ends with one survivor', () => {
    const sim = dryRun({ kind: 'orbit', seed: 3, melody: 'canon', colors: ['red', 'blue', 'green', 'yellow'] }) as OrbitSim;
    expect(sim.balls.filter((b) => b.live).length).toBe(1);
    expect(sim.result!.order.length).toBe(4);
  });
  it('blocks clears about 200 blocks and splits up to 6 balls', () => {
    const sim = createSim({ kind: 'blocks', seed: 3, melody: 'canon' }) as BlocksSim;
    expect(sim.blocks.length).toBeGreaterThan(150);
    expect(sim.blocks.length).toBeLessThan(260);
    while (!sim.result) sim.stepFrame();
    expect(sim.result.completed).toBe(true);
    expect(sim.left).toBe(0);
    expect(sim.balls.length).toBeLessThanOrEqual(6);
    expect(sim.balls.length).toBeGreaterThan(1);
  });
  it('the time-budgeted seed search returns a fitting run when one exists', () => {
    const found = pickSeedWithin({ kind: 'blocks', seed: 0, melody: 'canon' }, 100, 2000);
    expect(found.fits).toBe(true);
    expect(found.sim.result!.seconds).toBeGreaterThanOrEqual(20);
  });
});

describe('submit', () => {
  it('cleans credit names', () => {
    expect(cleanCredit('  Ana <script>  ')).toBe('Ana script');
    expect(cleanCredit('@orbit_fan.99')).toBe('@orbit_fan.99');
    expect(cleanCredit('x'.repeat(40)).length).toBe(24);
    expect(cleanCredit('José 🚀')).toBe('José');
  });
  it('writes an orbit.py-style spec without the app seed', () => {
    const spec: Spec = { kind: 'battle', seed: 129, melody: 'canon', colors: ['red', 'blue'], gap_deg: 30 };
    const yaml = specToYaml(spec, 'Ana', 'https://example.com/?k=battle');
    expect(yaml).toContain('kind: battle');
    expect(yaml).toContain('colors: [red, blue]');
    expect(yaml).toContain('gap_deg: 30');
    expect(yaml).toContain('target_seconds: [20, 60]');
    expect(yaml).toContain('credit: "Ana"');
    expect(yaml).not.toMatch(/^seed:/m);
  });
});

describe('builder', () => {
  it('drops fields the kind does not use', () => {
    const t = tidySpec({ kind: 'blocks', seed: 1, melody: 'canon', rings: 5, cap: 90, colors: ['red', 'blue'], spin: 20 });
    expect(t).toEqual({ kind: 'blocks', seed: 1, melody: 'canon', spin: 20 });
  });
});

describe('daily log', () => {
  beforeEach(() => {
    store.stats = { points: 0, picks: 0, wins: 0, streak: 0, best: 0, daily: [] };
    store.days = {};
  });
  it('counts each daily once and tracks the day streak', () => {
    for (const d of ['2026-11-01', '2026-11-02']) {
      recordPick(true, 20, `${d}#0`);
      recordPick(false, 20, `${d}#1`);
      recordWatch(`${d}#2`);
      recordWatch(`${d}#2`);
    }
    expect(store.days['2026-11-02']).toEqual({ played: 3, called: 1, points: 20 });
    expect(dailyStreak('2026-11-02')).toBe(2);
    expect(dailyStreak('2026-11-03')).toBe(2);
    expect(dailyStreak('2026-11-04')).toBe(0);
    expect(bestDays(5).length).toBe(2);
  });
});
