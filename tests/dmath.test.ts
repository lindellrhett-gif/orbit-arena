import { describe, expect, it } from 'vitest';
import { datan2, dcos, dsin, wrapAngle } from '../src/sim/dmath';
import { makeRng, fnv1a } from '../src/sim/rng';

describe('dmath', () => {
  it('matches Math within 1e-14 across a wide range', () => {
    const rng = makeRng(42);
    for (let i = 0; i < 20000; i++) {
      const x = rng.range(-50, 50);
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(1e-14);
      expect(Math.abs(dcos(x) - Math.cos(x))).toBeLessThan(1e-14);
      const y = rng.range(-500, 500);
      const z = rng.range(-500, 500);
      expect(Math.abs(datan2(y, z) - Math.atan2(y, z))).toBeLessThan(1e-14);
    }
  });
  it('handles atan2 axes', () => {
    expect(datan2(0, 1)).toBe(0);
    expect(datan2(1, 0)).toBeCloseTo(Math.PI / 2, 15);
    expect(datan2(-1, 0)).toBeCloseTo(-Math.PI / 2, 15);
    expect(datan2(0, -1)).toBeCloseTo(Math.PI, 15);
  });
  it('wraps angles', () => {
    expect(wrapAngle(7)).toBeCloseTo(7 - 2 * Math.PI, 15);
    expect(wrapAngle(-4)).toBeCloseTo(-4 + 2 * Math.PI, 15);
  });
});

describe('rng', () => {
  it('is reproducible and seed-sensitive', () => {
    const a = makeRng(7), b = makeRng(7), c = makeRng(8);
    const sa = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(sa);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(sa);
  });
  it('keeps separate streams independent', () => {
    expect(makeRng(7, 0).next()).not.toBe(makeRng(7, 1).next());
  });
  it('stays in range and is roughly uniform', () => {
    const r = makeRng(1);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 100000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      buckets[Math.floor(v * 10)]++;
    }
    for (const b of buckets) expect(Math.abs(b - 10000)).toBeLessThan(500);
  });
  it('hashes', () => {
    expect(fnv1a('')).toBe('811c9dc5');
    expect(fnv1a('a')).toBe('e40c292c');
  });
});
