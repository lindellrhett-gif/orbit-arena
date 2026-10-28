import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DETERMINISM_CASES, fingerprintCase } from './determinism-cases';

const SNAP = new URL('./determinism.snap.json', import.meta.url);

describe('determinism', () => {
  const actual: Record<string, string> = {};
  for (const c of DETERMINISM_CASES) actual[c.name] = fingerprintCase(c);

  if (process.env.UPDATE_SNAPSHOTS || !existsSync(SNAP)) {
    writeFileSync(SNAP, JSON.stringify(actual, null, 1) + '\n');
  }
  const stored = JSON.parse(readFileSync(SNAP, 'utf8')) as Record<string, string>;

  it('covers every case', () => {
    expect(Object.keys(stored).sort()).toEqual(Object.keys(actual).sort());
  });
  for (const c of DETERMINISM_CASES) {
    it(c.name, () => expect(actual[c.name]).toBe(stored[c.name]));
  }
  it('runs the same twice in one process', () => {
    const c = DETERMINISM_CASES[5];
    expect(fingerprintCase(c)).toBe(actual[c.name]);
  });
});
