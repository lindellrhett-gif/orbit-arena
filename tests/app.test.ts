import { describe, expect, it } from 'vitest';
import { dailySpecs, escapeBuckets, pickOptions, winningKey } from '../src/app/feed';
import daily from '../src/data/daily.json';
import { isGoodRun } from '../src/sim/seeds';
import { dryRun } from '../src/sim/sim';
import { type Spec, paramsToSpec, specToParams } from '../src/sim/spec';

describe('share links', () => {
  const specs: Spec[] = [
    { kind: 'escape', seed: 12345, melody: 'canon', rings: 6, gap_deg: 30, spin: 75 },
    { kind: 'escape', seed: 1, melody: 'twinkle', grow: 1.5 },
    { kind: 'battle', seed: 99, melody: 'fur_elise', colors: ['red', 'blue', 'cyan'] },
    { kind: 'race', seed: 7, melody: 'greensleeves', countries: ['us', 'br', 'gb-sct'], title: 'Who wins?' },
  ];
  for (const spec of specs) {
    it(`round-trips ${spec.kind}`, () => {
      const url = new URL(`https://example.com/?${specToParams(spec)}`);
      expect(paramsToSpec(url.searchParams)).toEqual(spec);
    });
  }
  it('reproduces the same run from a link', () => {
    const spec = specs[2];
    const again = paramsToSpec(new URLSearchParams(specToParams(spec).toString()))!;
    expect(dryRun(again).fingerprint()).toBe(dryRun(spec).fingerprint());
  });
  it('rejects junk and clamps values', () => {
    expect(paramsToSpec(new URLSearchParams('k=nope&s=1'))).toBeNull();
    expect(paramsToSpec(new URLSearchParams('k=battle'))).toBeNull();
    const s = paramsToSpec(new URLSearchParams('k=escape&s=3&rings=99&m=jaws'))!;
    expect(s.rings).toBe(8);
    expect(s.melody).toBe('fur_elise');
    const b = paramsToSpec(new URLSearchParams('k=battle&s=3&colors=red,notacolor'))!;
    expect(b.colors).toEqual(['red', 'blue', 'green', 'yellow']);
  });
});

describe('daily sims', () => {
  it('are the same for a date everywhere', () => {
    expect(dailySpecs('2026-11-02')).toEqual(dailySpecs('2026-11-02'));
    expect(dailySpecs('2026-11-02')).not.toEqual(dailySpecs('2026-11-03'));
  });
  it('have one of each launch kind', () => {
    expect(dailySpecs('2026-12-01').map((s) => s.kind).sort()).toEqual(['battle', 'escape', 'race']);
  });
  it('stored seeds still give good runs with the current physics', () => {
    const dates = Object.keys(daily as Record<string, number[]>).slice(0, 5);
    expect(dates.length).toBeGreaterThan(0);
    for (const date of dates) {
      dailySpecs(date).forEach((spec, slot) => {
        const seed = (daily as Record<string, number[]>)[date][slot];
        expect(isGoodRun(dryRun({ ...spec, seed })), `${date} slot ${slot}`).toBe(true);
      });
    }
  });
});

describe('picks', () => {
  it('escape buckets cover the target window', () => {
    const spec: Spec = { kind: 'escape', seed: 1, melody: 'canon' };
    const [a, b] = escapeBuckets(spec);
    expect(a).toBeGreaterThan(15);
    expect(b).toBeLessThan(40);
    expect(pickOptions(spec).map((o) => o.key)).toEqual(['fast', 'mid', 'slow']);
  });
  it('the winning key is one of the options', () => {
    for (const spec of [
      { kind: 'battle', seed: 4, melody: 'canon', countries: ['us', 'br', 'jp', 'de'] },
      { kind: 'race', seed: 4, melody: 'canon', colors: ['red', 'blue', 'green', 'yellow'] },
      { kind: 'escape', seed: 4, melody: 'canon' },
    ] as Spec[]) {
      const sim = dryRun(spec);
      const key = winningKey(sim);
      if (spec.kind === 'escape' && !sim.result!.escaped) continue;
      expect(pickOptions(spec).map((o) => o.key)).toContain(key);
    }
  });
});
