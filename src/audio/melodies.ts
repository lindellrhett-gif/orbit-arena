// Public-domain melodies as MIDI note numbers. Each wall bounce plays the next note; the tune loops.
// The note lists are the channel renderer's (MELODIES in scripts/orbit.py), so a sim sounds the same in the app and
// on the channel. Never add modern songs, film or game themes here, even "just the notes".

import type { MelodyId } from '../sim/spec';

export type Melody = { name: string; notes: number[] };

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
};

/** Melodies the feed draws from; Jingle Bells only in December (channel rule). */
export function feedMelodies(month: number): (keyof typeof MELODIES)[] {
  const all = Object.keys(MELODIES) as (keyof typeof MELODIES)[];
  return month === 11 ? all : all.filter((m) => m !== 'jingle_bells');
}
