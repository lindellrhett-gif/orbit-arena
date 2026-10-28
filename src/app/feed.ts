// What to play next: three daily sims (the same for everyone on a given date) and then endless random ones.

import { feedMelodies } from '../audio/melodies';
import { makeRng, hashInt, type Rng } from '../sim/rng';
import { pickSeed } from '../sim/seeds';
import { type Sim, dryRun } from '../sim/sim';
import { COLOR_NAMES, POPULAR_COUNTRIES, type Spec, contestants, defaultTitle, withDefaults } from '../sim/spec';
import dailySeeds from '../data/daily.json';

export type FeedItem = {
  spec: Spec;
  title: string;
  /** "DAILY 1/3", "SHARED SIM" or "" */
  tag: string;
  dailyKey?: string;
  /** The dry run, so the result is known before playback (and pick options can be built). */
  preview: Sim;
};

const DAILY = dailySeeds as Record<string, number[]>;

export function dateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pickColors(rng: Rng, n: number): string[] {
  return rng.shuffle(COLOR_NAMES.filter((c) => c !== 'white')).slice(0, n);
}

function pickCountries(rng: Rng, n: number): string[] {
  return rng.shuffle([...POPULAR_COUNTRIES]).slice(0, n);
}

/** Builds a random spec (without a seed) from an RNG. Daily sims use a date-seeded RNG, the endless feed a random one. */
export function randomSpec(rng: Rng, kind: Spec['kind'], month: number): Omit<Spec, 'seed'> {
  const melody = rng.pick(feedMelodies(month));
  if (kind === 'escape') {
    const rings = rng.pick([1, 1, 1, 2, 3, 4, 5, 6]);
    const spec: Omit<Spec, 'seed'> = { kind, melody, rings };
    if (rings === 1 && rng.next() < 0.3) spec.grow = rng.pick([0.6, 0.8, 1]);
    return spec;
  }
  const flags = rng.next() < (kind === 'battle' ? 0.4 : 0.35);
  const n = kind === 'battle' ? rng.pick([4, 4, 5, 6, 6, 7, 8]) : rng.pick([4, 5, 6, 6, 8]);
  return flags ? { kind, melody, countries: pickCountries(rng, n) } : { kind, melody, colors: pickColors(rng, n) };
}

/** The three daily specs for a date, in order: escape, battle, race (rotated by date so the order varies). */
export function dailySpecs(date: string): Omit<Spec, 'seed'>[] {
  const rng = makeRng(hashInt(`daily:${date}`));
  const month = Number(date.slice(5, 7)) - 1;
  const kinds: Spec['kind'][] = ['escape', 'battle', 'race'];
  const shift = hashInt(date) % 3;
  const ordered = [...kinds.slice(shift), ...kinds.slice(0, shift)];
  return ordered.map((k) => randomSpec(rng, k, month));
}

/** Seed search start for a daily slot, so the search is the same on every device and in the build script. */
export function dailySeedStart(date: string, slot: number): number {
  return hashInt(`seed:${date}:${slot}`) % 1_000_000;
}

export function dailyItems(date: string): FeedItem[] {
  const specs = dailySpecs(date);
  const stored = DAILY[date];
  return specs.map((base, slot) => {
    let spec: Spec;
    let preview: Sim;
    if (stored) {
      spec = { ...base, seed: stored[slot] };
      preview = dryRun(spec);
    } else {
      const found = pickSeed({ ...base, seed: 0 }, dailySeedStart(date, slot));
      spec = { ...base, seed: found ? found.seed : dailySeedStart(date, slot) };
      preview = found ? found.sim : dryRun(spec);
    }
    return { spec, title: defaultTitle(spec), tag: `DAILY ${slot + 1}/3`, dailyKey: `${date}#${slot}`, preview };
  });
}

/** Random sims for the endless feed. The UI layer may use Math.random; the sim itself never does. */
export function randomItem(previousKind?: Spec['kind']): FeedItem {
  const rng = makeRng(Math.floor(Math.random() * 2 ** 31));
  const kinds: Spec['kind'][] = ['escape', 'battle', 'battle', 'race'];
  let kind = rng.pick(kinds);
  if (kind === previousKind) kind = rng.pick(kinds);
  const base = randomSpec(rng, kind, new Date().getMonth());
  const found = pickSeed({ ...base, seed: 0 }, rng.int(1_000_000), 60);
  const spec: Spec = { ...base, seed: found ? found.seed : rng.int(1_000_000) };
  return { spec, title: defaultTitle(spec), tag: '', preview: found ? found.sim : dryRun(spec) };
}

export function sharedItem(spec: Spec): FeedItem {
  return { spec, title: defaultTitle(spec), tag: 'SHARED SIM', preview: dryRun(spec) };
}

// ---- Picks -------------------------------------------------------------------------------------------------

export type PickOption = { key: string; label: string; color: string; flag?: string };

export function pickPrompt(spec: Spec): string {
  if (spec.kind === 'escape') return 'Guess the escape time';
  if (spec.countries?.length) return 'Pick a country';
  return spec.kind === 'race' ? 'Pick a marble' : 'Pick a color';
}

/** Escape time buckets split the spec's target window into thirds. */
export function escapeBuckets(spec: Spec): [number, number] {
  const [lo, hi] = withDefaults(spec).target_seconds;
  const a = Math.round(lo + (hi - lo) / 3);
  const b = Math.round(lo + ((hi - lo) * 2) / 3);
  return [a, b];
}

export function pickOptions(spec: Spec): PickOption[] {
  if (spec.kind === 'escape') {
    const [a, b] = escapeBuckets(spec);
    return [
      { key: 'fast', label: `UNDER ${a} s`, color: '#22e5ff' },
      { key: 'mid', label: `${a}–${b} s`, color: '#a259ff' },
      { key: 'slow', label: `OVER ${b} s`, color: '#ff4fd8' },
    ];
  }
  return contestants(spec).map((c) => ({ key: c.key, label: c.name, color: c.color, flag: c.flag }));
}

/** The option key that matches how the run actually ended. */
export function winningKey(sim: Sim): string | null {
  const r = sim.result;
  if (!r) return null;
  if (sim.spec.kind === 'escape') {
    if (!r.escaped) return null;
    const [a, b] = escapeBuckets(sim.spec);
    return r.seconds < a ? 'fast' : r.seconds <= b ? 'mid' : 'slow';
  }
  return r.winner >= 0 ? sim.teams[r.winner].key : null;
}

/** Points for a correct pick: more options, more points. Points are only a score; they can't be spent or bought. */
export function pointsFor(spec: Spec): number {
  return 10 * (pickOptions(spec).length - 1);
}
