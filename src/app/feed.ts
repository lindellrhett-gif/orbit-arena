// What to play next: three daily sims (the same for everyone on a given date) and then endless random ones.

import { feedMelodies } from '../audio/melodies';
import { makeRng, hashInt, type Rng } from '../sim/rng';
import { pickSeed, pickSeedWithin } from '../sim/seeds';
import { type Sim, dryRun } from '../sim/sim';
import { COLOR_NAMES, POPULAR_COUNTRIES, type Spec, contestants, defaultTitle, isContest } from '../sim/spec';
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
  switch (kind) {
    case 'escape': {
      const rings = rng.pick([1, 1, 1, 2, 3, 4, 5, 6]);
      const spec: Omit<Spec, 'seed'> = { kind, melody, rings };
      if (rings === 1 && rng.next() < 0.3) spec.grow = rng.pick([0.6, 0.8, 1]);
      return spec;
    }
    case 'grow':
      return { kind, melody, grow: rng.pick([1.8, 2.2, 2.6]) };
    case 'multiply':
      return { kind, melody, cap: rng.pick([100, 100, 120, 150]) };
    case 'blocks':
      return { kind, melody };
    default: {
      const flags = rng.next() < (kind === 'race' ? 0.35 : 0.4);
      const n = kind === 'battle' ? rng.pick([4, 4, 5, 6, 6, 7, 8]) : rng.pick([4, 5, 6, 6, 8]);
      return flags ? { kind, melody, countries: pickCountries(rng, n) } : { kind, melody, colors: pickColors(rng, n) };
    }
  }
}

/**
 * The three daily specs for a date: an escape (the channel's top format), a "pick the winner" kind and a
 * "guess the number" kind, in an order that varies by date.
 */
export function dailySpecs(date: string): Omit<Spec, 'seed'>[] {
  const rng = makeRng(hashInt(`daily:${date}`));
  const month = Number(date.slice(5, 7)) - 1;
  const kinds: Spec['kind'][] = [
    'escape', rng.pick(['battle', 'battle', 'race', 'orbit'] as const), rng.pick(['grow', 'multiply', 'blocks'] as const),
  ];
  return rng.shuffle(kinds).map((k) => randomSpec(rng, k, month));
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
  const kinds: Spec['kind'][] = ['escape', 'escape', 'battle', 'battle', 'race', 'orbit', 'grow', 'multiply', 'blocks'];
  let kind = rng.pick(kinds);
  if (kind === previousKind) kind = rng.pick(kinds);
  const base = randomSpec(rng, kind, new Date().getMonth());
  const found = pickSeedWithin({ ...base, seed: 0 }, rng.int(1_000_000), 600);
  const spec: Spec = { ...base, seed: found.seed };
  return { spec, title: defaultTitle(spec), tag: '', preview: found.sim };
}

export function sharedItem(spec: Spec, tag = 'SHARED SIM'): FeedItem {
  return { spec, title: defaultTitle(spec), tag, preview: dryRun(spec) };
}

// ---- Picks -------------------------------------------------------------------------------------------------

export type PickOption = { key: string; label: string; color: string; flag?: string };

/**
 * For kinds without contestants, viewers guess over or under a line. The line sits 4-14% above or below the real
 * result, on a side chosen by the seed: always a close call, and a fair 50/50.
 */
export type GuessLine = { value: number; line: number; text: string };

export function guessLine(sim: Sim): GuessLine | null {
  const r = sim.result;
  if (!r || isContest(sim.spec.kind)) return null;
  const rng = makeRng(sim.spec.seed, 2);
  const sign = rng.next() < 0.5 ? -1 : 1;
  const offset = rng.range(0.04, 0.14);
  if (sim.spec.kind === 'grow') {
    let line = Math.round(r.bounces * (1 + sign * offset));
    if (line === r.bounces) line += sign;
    return { value: r.bounces, line, text: `${line} BOUNCES` };
  }
  let line = Math.round(r.seconds * (1 + sign * offset) * 10) / 10;
  if (line === r.seconds) line = Math.round((line + sign * 0.1) * 10) / 10;
  return { value: r.seconds, line, text: `${line.toFixed(1)} s` };
}

export function pickPrompt(sim: Sim): string {
  const g = guessLine(sim);
  if (g) {
    switch (sim.spec.kind) {
      case 'escape': return `Escapes in over or under ${g.text}?`;
      case 'grow': return `Fills in over or under ${g.text.toLowerCase()}?`;
      case 'multiply': return `${sim.spec.cap} balls in over or under ${g.text}?`;
      case 'blocks': return `Cleared in over or under ${g.text}?`;
    }
    return `Over or under ${g.text}?`;
  }
  if (sim.spec.countries?.length) return 'Pick a country';
  return sim.spec.kind === 'race' ? 'Pick a marble' : 'Pick a color';
}

/** Pick options; `sim` is a finished dry run of the sim about to play (FeedItem.preview). */
export function pickOptions(sim: Sim): PickOption[] {
  const g = guessLine(sim);
  if (g) {
    return [
      { key: 'under', label: `UNDER ${g.text}`, color: '#22e5ff' },
      { key: 'over', label: `OVER ${g.text}`, color: '#ff4fd8' },
    ];
  }
  return contestants(sim.spec).map((c) => ({ key: c.key, label: c.name, color: c.color, flag: c.flag }));
}

/** The option key that matches how the run actually ended. */
export function winningKey(sim: Sim): string | null {
  const r = sim.result;
  if (!r) return null;
  const g = guessLine(sim);
  if (g) return g.value < g.line ? 'under' : 'over';
  return r.winner >= 0 ? sim.teams[r.winner].key : null;
}

/** Points for a correct pick: more options, more points. Points are only a score; they can't be spent or bought. */
export function pointsFor(sim: Sim): number {
  return isContest(sim.spec.kind) ? 10 * (sim.teams.length - 1) : 20;
}
