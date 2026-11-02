// Public-domain melodies as MIDI note numbers. Each wall bounce plays the next note; the tune loops.
// The note lists are the channel renderer's (MELODIES in scripts/orbit.py), so a sim sounds the same in the app and
// on the channel. Never add modern songs, film or game themes here, even "just the notes".

import type { MelodyId } from '../sim/spec';

/** `pack`: part of the Melody Pack unlock. Shared sims play any melody; the pack only gates choosing one. */
export type Melody = { name: string; notes: number[]; pack?: true };

export const MELODIES: Record<MelodyId, Melody> = {
  fur_elise: {
    name: 'Für Elise',
    notes: [
      76, 75, 76, 75, 76, 71, 74, 72, 69, 60, 64, 69, 71, 64, 68, 71, 72, 64, 76, 75, 76, 75, 76, 71, 74, 72, 69,
      60, 64, 69, 71, 64, 72, 71, 69,
    ],
  },
  ode_to_joy: {
    name: 'Ode to Joy',
    notes: [
      76, 76, 77, 79, 79, 77, 76, 74, 72, 72, 74, 76, 76, 74, 74, 76, 76, 77, 79, 79, 77, 76, 74, 72, 72, 74,
      76, 74, 72, 72,
    ],
  },
  mountain_king: {
    name: 'In the Hall of the Mountain King',
    notes: [71, 73, 74, 76, 78, 74, 78, 77, 73, 77, 76, 72, 76, 71, 73, 74, 76, 78, 74, 78, 83, 81, 78, 74, 78, 81],
  },
  twinkle: {
    name: 'Twinkle Twinkle Little Star',
    notes: [72, 72, 79, 79, 81, 81, 79, 77, 77, 76, 76, 74, 74, 72, 79, 79, 77, 77, 76, 76, 74, 79, 79, 77, 77, 76, 76, 74],
  },
  canon: {
    name: 'Canon in D',
    notes: [
      78, 76, 74, 73, 71, 69, 71, 73, 74, 73, 71, 69, 67, 66, 67, 64, 74, 66, 69, 67, 66, 62, 66, 64, 62, 59, 62, 69,
      67, 71, 69, 67,
    ],
  },
  nachtmusik: {
    name: 'Eine kleine Nachtmusik',
    notes: [67, 62, 67, 62, 67, 62, 67, 71, 74, 72, 69, 72, 69, 72, 69, 66, 69, 62],
  },
  turkish_march: {
    name: 'Rondo alla Turca',
    notes: [71, 69, 68, 69, 72, 74, 72, 71, 72, 76, 77, 76, 75, 76, 83, 81, 80, 81, 83, 81, 80, 81, 84],
  },
  greensleeves: {
    name: 'Greensleeves',
    notes: [
      69, 72, 74, 76, 77, 76, 74, 71, 67, 69, 71, 72, 69, 69, 68, 69, 71, 68, 64, 69, 72, 74, 76, 77, 76, 74,
      71, 67, 69, 71, 72, 71, 69, 68, 66, 68, 69, 69,
    ],
  },
  jingle_bells: {
    name: 'Jingle Bells',
    notes: [76, 76, 76, 76, 76, 76, 76, 79, 72, 74, 76, 77, 77, 77, 77, 77, 76, 76, 76, 76, 74, 74, 76, 74, 79],
  },
  // Melody Pack. Not in orbit.py's MELODIES, so submitted specs fall back to one of the channel's (see submit.ts).
  minuet_g: {
    name: 'Minuet in G',
    pack: true,
    notes: [
      74, 67, 69, 71, 72, 74, 67, 67, 76, 72, 74, 76, 78, 79, 67, 67, 72, 74, 72, 71, 69, 71, 72, 71, 69, 67,
      66, 67, 69, 71, 67, 69, 74, 67, 69, 71, 72, 74, 67, 67, 76, 72, 74, 76, 78, 79, 67, 67, 72, 74, 72, 71, 69,
      71, 72, 71, 69, 67, 69, 71, 69, 67, 66, 67,
    ],
  },
  morning_mood: {
    name: 'Morning Mood',
    pack: true,
    notes: [79, 76, 74, 72, 74, 76, 79, 76, 74, 72, 74, 76, 74, 76, 79, 76, 79, 81, 76, 81, 79, 76, 74, 72],
  },
  blue_danube: {
    name: 'The Blue Danube',
    pack: true,
    notes: [
      62, 62, 66, 69, 69, 81, 81, 78, 78, 62, 62, 66, 69, 69, 81, 81, 79, 79, 61, 61, 64, 71, 71, 83, 83, 79, 79,
      61, 61, 64, 71, 71, 83, 83, 78, 78,
    ],
  },
  new_world: {
    name: 'New World Symphony (Largo)',
    pack: true,
    notes: [76, 79, 79, 76, 74, 72, 74, 76, 79, 76, 74, 76, 79, 79, 76, 74, 72, 74, 76, 74, 72, 72],
  },
  fifth_symphony: {
    name: 'Symphony No. 5 (Beethoven)',
    pack: true,
    notes: [67, 67, 67, 63, 65, 65, 65, 62, 67, 67, 67, 63, 68, 68, 68, 67, 75, 75, 75, 72],
  },
  symphony_40: {
    name: 'Symphony No. 40 (Mozart)',
    pack: true,
    notes: [
      75, 74, 74, 75, 74, 74, 75, 74, 74, 82, 82, 81, 79, 79, 77, 75, 75, 74, 72, 72, 74, 72, 72, 74, 72, 72,
      74, 72, 72, 81, 81, 79, 78, 78, 75, 74, 74, 72, 70, 70,
    ],
  },
  frere_jacques: {
    name: 'Frère Jacques',
    pack: true,
    notes: [
      72, 74, 76, 72, 72, 74, 76, 72, 76, 77, 79, 76, 77, 79, 79, 81, 79, 77, 76, 72, 79, 81, 79, 77, 76, 72,
      72, 67, 72, 72, 67, 72,
    ],
  },
  london_bridge: {
    name: 'London Bridge',
    pack: true,
    notes: [79, 81, 79, 77, 76, 77, 79, 74, 76, 77, 76, 77, 79, 79, 81, 79, 77, 76, 77, 79, 74, 79, 76, 72],
  },
};

/**
 * Melodies the random feed draws from; Jingle Bells only in December (channel rule). Melody Pack tunes join the
 * random feed for owners, but never the daily sims, which must be the same for everyone (and must not shift: the
 * date's RNG picks by position, so the base list keeps its order).
 */
export function feedMelodies(month: number, withPack = false): (keyof typeof MELODIES)[] {
  const all = (Object.keys(MELODIES) as (keyof typeof MELODIES)[]).filter((m) => withPack || !MELODIES[m].pack);
  return month === 11 ? all : all.filter((m) => m !== 'jingle_bells');
}
