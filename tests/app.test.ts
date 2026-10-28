import { describe, expect, it } from 'vitest';
import { dailySpecs, guessLine, pickOptions, pointsFor, winningKey } from '../src/app/feed';
import daily from '../src/data/daily.json';
import { isGoodRun } from '../src/sim/seeds';
import { dryRun } from '../src/sim/sim';
import { type Spec, paramsToSpec, specToParams } from '../src/sim/spec';

describe('share links', () => {
  const specs: Spec[] = [
    { kind: 'escape', seed: 12345, melody: 'canon', rings: 6, gap_deg: 30, spin: 75 },
    { kind: 'escape', seed: 1, melody: 'twinkle', grow: 1.5 },
    { kind: 'battle', seed: 99, melody: 'fur_elise', colors: ['red', 'blue', 'cyan'] },
    { kind: 'race', seed: 7, melody: 'greensleeves', countries: ['us', 'br', 'gb-sct'] },
    { kind: 'grow', seed: 3, melody: 'canon', grow: 2.6, gravity: 0.5 },
    { kind: 'multiply', seed: 4, melody: 'twinkle', cap: 150, size: 1.2 },
    { kind: 'orbit', seed: 5, melody: 'nachtmusik', colors: ['red', 'blue', 'lime'] },
    { kind: 'blocks', seed: 6, melody: 'turkish_march', spin: 30 },
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
  it('never carries free text', () => {
    const p = new URLSearchParams('k=battle&s=1&t=hello%20world&colors=red,blue');
    expect(paramsToSpec(p)?.title).toBeUndefined();
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
  it('have an escape, a pick-the-winner kind and a guess kind', () => {
    for (const date of ['2026-12-01', '2026-12-02', '2027-01-15']) {
      const kinds = dailySpecs(date).map((s) => s.kind);
      expect(kinds).toContain('escape');
      expect(kinds.some((k) => ['battle', 'race', 'orbit'].includes(k))).toBe(true);
      expect(kinds.some((k) => ['grow', 'multiply', 'blocks'].includes(k))).toBe(true);
    }
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
  const timeKinds: Spec[] = [
    { kind: 'escape', seed: 0, melody: 'canon' },
    { kind: 'grow', seed: 0, melody: 'canon' },
    { kind: 'blocks', seed: 0, melody: 'canon' },
  ];
  it('over/under lines are close to the result and split about 50/50', () => {
    for (const base of timeKinds) {
      let over = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const sim = dryRun({ ...base, seed });
        const g = guessLine(sim)!;
        expect(g.line).not.toBe(g.value);
        expect(Math.abs(g.line - g.value) / g.value).toBeLessThan(0.16);
        if (winningKey(sim) === 'over') over++;
      }
      expect(over).toBeGreaterThan(8);
      expect(over).toBeLessThan(32);
    }
  });
  it('time kinds get two options, contest kinds one per contestant', () => {
    expect(pickOptions(dryRun({ kind: 'grow', seed: 2, melody: 'canon' })).map((o) => o.key)).toEqual(['under', 'over']);
    const battle = dryRun({ kind: 'battle', seed: 2, melody: 'canon', colors: ['red', 'blue', 'green'] });
    expect(pickOptions(battle).map((o) => o.key)).toEqual(['red', 'blue', 'green']);
    expect(pointsFor(battle)).toBe(20);
  });
  it('the winning key is one of the options', () => {
    for (const spec of [
      { kind: 'battle', seed: 4, melody: 'canon', countries: ['us', 'br', 'jp', 'de'] },
      { kind: 'race', seed: 4, melody: 'canon', colors: ['red', 'blue', 'green', 'yellow'] },
      { kind: 'orbit', seed: 4, melody: 'canon', colors: ['red', 'blue', 'green', 'yellow'] },
      { kind: 'escape', seed: 4, melody: 'canon' },
      { kind: 'multiply', seed: 4, melody: 'canon', cap: 40 },
    ] as Spec[]) {
      const sim = dryRun(spec);
      expect(pickOptions(sim).map((o) => o.key)).toContain(winningKey(sim));
    }
  });
});
