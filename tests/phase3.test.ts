import { beforeEach, describe, expect, it } from 'vitest';
import { MELODIES, feedMelodies } from '../src/audio/melodies';
import { dailySpecs } from '../src/app/feed';
import { has, owns, shop } from '../src/app/shop';
import { MAX_SLOTS, SANDBOX_SLOTS, saveSim, slotLimit, store } from '../src/app/store';
import { specToYaml } from '../src/app/submit';
import { cleanLook } from '../src/render/looks';
import { MELODY_IDS, type Spec, paramsToSpec, specToParams } from '../src/sim/spec';

const BASE = ['fur_elise', 'ode_to_joy', 'mountain_king', 'twinkle', 'canon', 'nachtmusik', 'turkish_march', 'greensleeves'];

describe('melody pack', () => {
  it('keeps the base feed list (and so every daily sim) unchanged', () => {
    expect(feedMelodies(5)).toEqual(BASE);
    expect(feedMelodies(11)).toEqual([...BASE, 'jingle_bells']);
    for (const date of ['2026-11-01', '2026-12-24', '2027-03-15']) {
      for (const spec of dailySpecs(date)) expect(MELODIES[spec.melody].pack).toBeUndefined();
    }
  });
  it('adds the pack to the random feed only for owners', () => {
    const withPack = feedMelodies(5, true);
    expect(withPack.slice(0, BASE.length)).toEqual(BASE);
    expect(withPack.filter((m) => MELODIES[m].pack)).toHaveLength(8);
  });
  it('has a melody for every id, all in a playable range', () => {
    expect(Object.keys(MELODIES).sort()).toEqual([...MELODY_IDS].sort());
    for (const m of Object.values(MELODIES)) {
      expect(m.notes.length).toBeGreaterThanOrEqual(16);
      for (const n of m.notes) expect(n >= 55 && n <= 88).toBe(true);
    }
  });
  it('survives a share link round trip', () => {
    const spec: Spec = { kind: 'escape', seed: 3, melody: 'blue_danube' };
    expect(paramsToSpec(specToParams(spec))?.melody).toBe('blue_danube');
  });
  it("falls back to one of orbit.py's melodies in submitted specs", () => {
    const yaml = specToYaml({ kind: 'escape', seed: 3, melody: 'morning_mood' }, '', 'x');
    expect(yaml).toContain('melody: fur_elise\n');
    expect(yaml).toContain('# app melody: morning_mood');
    expect(specToYaml({ kind: 'escape', seed: 3, melody: 'canon' }, '', 'x')).toContain('melody: canon\n');
  });
});

describe('unlocks', () => {
  beforeEach(() => {
    shop.owned.clear();
    store.sims = [];
  });
  it('Everything unlocks all four extras', () => {
    expect(has('hd')).toBe(false);
    shop.owned.add('everything');
    for (const u of ['hd', 'skins', 'melodies', 'slots'] as const) expect(has(u)).toBe(true);
    expect(owns('everything')).toBe(true);
  });
  it('a single unlock is just that one', () => {
    shop.owned.add('hd');
    expect(has('hd')).toBe(true);
    expect(has('skins')).toBe(false);
    expect(owns('everything')).toBe(false);
  });
  it('limits saved sims to the free slots unless Unlimited Slots is owned', () => {
    const spec: Spec = { kind: 'grow', seed: 1, melody: 'canon' };
    for (let i = 0; i < SANDBOX_SLOTS; i++) expect(saveSim(spec)).toBe(true);
    expect(saveSim(spec)).toBe(false);
    shop.owned.add('slots');
    expect(slotLimit()).toBe(MAX_SLOTS);
    expect(saveSim(spec)).toBe(true);
    expect(store.sims).toHaveLength(SANDBOX_SLOTS + 1);
  });
  it('falls back to the classic look for unknown skins and trails', () => {
    expect(cleanLook('planet', 'comet')).toEqual({ skin: 'planet', trail: 'comet' });
    expect(cleanLook('gold', 'laser')).toEqual({ skin: 'classic', trail: 'classic' });
  });
});
