// A sim is fully described by its spec. Field names follow the orbit.py YAML specs so specs can travel between
// the app and the channel's renderer.

import countryNames from '../data/countries.json';

export type Kind = 'escape' | 'battle' | 'grow' | 'multiply' | 'race' | 'orbit' | 'blocks';
export const KINDS: Kind[] = ['escape', 'battle', 'grow', 'multiply', 'race', 'orbit', 'blocks'];

/** Kinds where viewers pick a contestant; the others are guessed by time. */
export const CONTEST_KINDS: Kind[] = ['battle', 'race', 'orbit'];
export const isContest = (kind: Kind): boolean => CONTEST_KINDS.includes(kind);

export const MELODY_IDS = [
  'fur_elise', 'ode_to_joy', 'mountain_king', 'twinkle', 'canon', 'nachtmusik', 'turkish_march', 'greensleeves',
  'jingle_bells',
] as const;
export type MelodyId = (typeof MELODY_IDS)[number];

export type Spec = {
  kind: Kind;
  seed: number;
  melody: MelodyId;
  title?: string;
  /** escape */
  rings?: number;
  gap_deg?: number;
  /** Ring spin in degrees per second. */
  spin?: number;
  /** escape / grow: pixels the ball grows per bounce (0 = off for escape). */
  grow?: number;
  /** multiply: stop at this many balls. */
  cap?: number;
  /** Gravity multiplier (1 = normal). */
  gravity?: number;
  /** Ball size multiplier (1 = normal). */
  size?: number;
  /** battle / race / orbit contestants: color names, or ISO country codes. */
  colors?: string[];
  countries?: string[];
  /** Seed search window in seconds. */
  target_seconds?: [number, number];
};

export const COLORS: Record<string, string> = {
  red: '#ff3b4e',
  blue: '#3b82ff',
  green: '#2ee66b',
  yellow: '#ffd23b',
  orange: '#ff8a1f',
  purple: '#a259ff',
  pink: '#ff4fd8',
  cyan: '#22e5ff',
  lime: '#b6ff2e',
  white: '#f2f4ff',
};
export const COLOR_NAMES = Object.keys(COLORS);

const COUNTRY_TINTS = ['#ff3b4e', '#3b82ff', '#2ee66b', '#ffd23b', '#ff8a1f', '#a259ff', '#ff4fd8', '#22e5ff'];

export const COUNTRIES = countryNames as Record<string, string>;

/** Countries that random battles and races draw from (large audiences, recognizable flags). */
export const POPULAR_COUNTRIES = [
  'us', 'br', 'mx', 'gb', 'ca', 'de', 'fr', 'it', 'es', 'pt', 'nl', 'pl', 'tr', 'in', 'pk', 'bd', 'id', 'ph', 'vn',
  'th', 'jp', 'kr', 'cn', 'au', 'nz', 'ar', 'co', 'cl', 'pe', 'ng', 'eg', 'za', 'ke', 'ma', 'sa', 'ae', 'se', 'no',
  'ua', 'ie',
];

export type Contestant = { key: string; name: string; color: string; flag?: string };

export function contestants(spec: Spec): Contestant[] {
  if (!isContest(spec.kind)) return [{ key: 'ball', name: 'BALL', color: '#ffffff' }];
  if (spec.countries?.length) {
    return spec.countries.map((code, i) => ({
      key: code,
      name: shortCountryName(code).toUpperCase(),
      color: COUNTRY_TINTS[i % COUNTRY_TINTS.length],
      flag: code,
    }));
  }
  const colors = spec.colors?.length ? spec.colors : ['red', 'blue', 'green', 'yellow'];
  return colors.map((c) => ({ key: c, name: c.toUpperCase(), color: COLORS[c] ?? '#ffffff' }));
}

const SHORT_NAMES: Record<string, string> = {
  us: 'USA', gb: 'UK', ae: 'UAE', kr: 'Korea', kp: 'N. Korea', cd: 'DR Congo', cg: 'Congo', cf: 'C. African Rep.',
  ba: 'Bosnia', do: 'Dominican Rep.', va: 'Vatican', ci: 'Ivory Coast', sz: 'Eswatini', tt: 'Trinidad',
  vc: 'St Vincent', kn: 'St Kitts', ag: 'Antigua', st: 'São Tomé',
};

export function shortCountryName(code: string): string {
  return SHORT_NAMES[code] ?? COUNTRIES[code] ?? code.toUpperCase();
}

/** Run-length windows for the seed search (the channel playbook's target lengths). */
export const TARGET_SECONDS: Record<Kind, [number, number]> = {
  escape: [15, 40],
  battle: [20, 60],
  grow: [15, 35],
  multiply: [20, 40],
  race: [25, 45],
  orbit: [20, 50],
  blocks: [20, 50],
};

export function withDefaults(spec: Spec): Required<Omit<Spec, 'title' | 'colors' | 'countries'>> & Spec {
  const base = {
    rings: 1,
    gap_deg: spec.kind === 'battle' ? 28 : (spec.rings ?? 1) > 1 ? 30 : spec.grow ? 24 : 18,
    spin: spec.kind === 'battle' ? 40 : 60,
    grow: spec.kind === 'grow' ? 2.2 : 0,
    cap: 100,
    gravity: 1,
    size: 1,
    target_seconds: TARGET_SECONDS[spec.kind],
  };
  return { ...base, ...stripUndefined(spec) } as Required<Omit<Spec, 'title' | 'colors' | 'countries'>> & Spec;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

export function defaultTitle(spec: Spec): string {
  if (spec.title) return spec.title;
  const n = contestants(spec).length;
  switch (spec.kind) {
    case 'escape': {
      const rings = spec.rings ?? 1;
      if (spec.grow) return 'It grows every bounce.\nWill it escape?';
      return rings > 1 ? `Can it escape all ${rings} rings?` : 'Will the ball escape?';
    }
    case 'battle':
      return spec.countries?.length ? 'Which country wins?' : `${n} colors. 1 winner.`;
    case 'race':
      return spec.countries?.length ? 'Country marble race!' : 'Marble race: who wins?';
    case 'grow':
      return 'It grows every bounce.\nHow long to fill it?';
    case 'multiply':
      return 'Every bounce adds a ball';
    case 'orbit':
      return spec.countries?.length ? 'Which country survives\nthe black hole?' : 'Who survives\nthe black hole?';
    case 'blocks':
      return 'Can it break every block?';
  }
}

// ---- Share links -------------------------------------------------------------------------------------------

/** Physics version. Bump when a change would alter existing runs so old links can say so. */
export const ENGINE_VERSION = 1;

export function specToParams(spec: Spec): URLSearchParams {
  const p = new URLSearchParams();
  p.set('v', String(ENGINE_VERSION));
  p.set('k', spec.kind);
  p.set('s', String(spec.seed));
  p.set('m', spec.melody);
  if (spec.kind === 'escape' && spec.rings !== undefined) p.set('rings', String(spec.rings));
  if (spec.grow) p.set('grow', String(spec.grow));
  if (spec.kind === 'multiply' && spec.cap !== undefined) p.set('cap', String(spec.cap));
  if (spec.gap_deg !== undefined) p.set('gap', String(spec.gap_deg));
  if (spec.spin !== undefined) p.set('spin', String(spec.spin));
  if (spec.gravity !== undefined && spec.gravity !== 1) p.set('g', String(spec.gravity));
  if (spec.size !== undefined && spec.size !== 1) p.set('size', String(spec.size));
  if (spec.countries?.length) p.set('countries', spec.countries.join(','));
  else if (spec.colors?.length) p.set('colors', spec.colors.join(','));
  // No free-text title in links: the app never shows text typed by one person to another.
  return p;
}

const num = (v: string | null, lo: number, hi: number): number | undefined => {
  if (v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(hi, Math.max(lo, n));
};

/** Parses a share link. Returns null when the link doesn't describe a valid sim. */
export function paramsToSpec(p: URLSearchParams): Spec | null {
  const kind = p.get('k') as Kind | null;
  if (!kind || !KINDS.includes(kind)) return null;
  const seed = num(p.get('s'), 0, 2 ** 31);
  if (seed === undefined) return null;
  const melody = (MELODY_IDS as readonly string[]).includes(p.get('m') ?? '') ? (p.get('m') as MelodyId) : 'fur_elise';
  const spec: Spec = { kind, seed: Math.floor(seed), melody };
  const rings = num(p.get('rings'), 1, 8);
  if (kind === 'escape' && rings !== undefined) spec.rings = Math.floor(rings);
  const grow = num(p.get('grow'), 0, 6);
  if ((kind === 'escape' || kind === 'grow') && grow) spec.grow = grow;
  const cap = num(p.get('cap'), 10, 250);
  if (kind === 'multiply' && cap !== undefined) spec.cap = Math.floor(cap);
  const gap = num(p.get('gap'), 10, 120);
  if (gap !== undefined) spec.gap_deg = gap;
  const spin = num(p.get('spin'), -360, 360);
  if (spin !== undefined) spec.spin = spin;
  const gravity = num(p.get('g'), 0, 2.5);
  if (gravity !== undefined) spec.gravity = gravity;
  const size = num(p.get('size'), 0.5, 1.8);
  if (size !== undefined) spec.size = size;
  if (isContest(kind)) {
    const countries = (p.get('countries') ?? '').split(',').filter((c) => c in COUNTRIES).slice(0, 12);
    const colors = (p.get('colors') ?? '').split(',').filter((c) => c in COLORS).slice(0, 10);
    if (countries.length >= 2) spec.countries = countries;
    else if (colors.length >= 2) spec.colors = colors;
    else spec.colors = ['red', 'blue', 'green', 'yellow'];
  }
  return spec;
}
