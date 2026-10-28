// Seeded random numbers. Never use Math.random in the simulation.

export type Rng = {
  /** Float in [0, 1). */
  next(): number;
  /** Float in [a, b). */
  range(a: number, b: number): number;
  /** Integer in [0, n). */
  int(n: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: T[]): T[];
};

/** sfc32, seeded through splitmix32 so nearby seeds give unrelated streams. */
export function makeRng(seed: number, stream = 0): Rng {
  let s = (seed ^ Math.imul(stream + 1, 0x9e3779b9)) >>> 0;
  const split = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  let a = split(), b = split(), c = split(), d = split();
  const u32 = () => {
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    return t;
  };
  for (let i = 0; i < 12; i++) u32();
  const rng: Rng = {
    next: () => u32() / 4294967296,
    range: (lo, hi) => lo + (hi - lo) * rng.next(),
    int: (n) => Math.floor(rng.next() * n),
    pick: (items) => items[rng.int(items.length)],
    shuffle: (items) => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        const tmp = items[i];
        items[i] = items[j];
        items[j] = tmp;
      }
      return items;
    },
  };
  return rng;
}

/** FNV-1a 32-bit hash of a string, as 8 hex chars. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Stable integer from a string (used to turn a date into a seed). */
export function hashInt(text: string): number {
  return parseInt(fnv1a(text), 16);
}
