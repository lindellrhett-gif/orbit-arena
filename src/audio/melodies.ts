// Public-domain melodies as MIDI note numbers. Each wall bounce plays the next note; the tune loops.
// Never add modern songs, film or game themes here, even "just the notes".

import type { MelodyId } from '../sim/spec';

export type Melody = { name: string; notes: number[] };

export const MELODIES: Record<MelodyId, Melody> = {
  fur_elise: {
    name: 'Für Elise',
    notes: [
      76, 75, 76, 75, 76, 71, 74, 72, 69, 60, 64, 69, 71, 64, 68, 71, 72, 64,
      76, 75, 76, 75, 76, 71, 74, 72, 69, 60, 64, 69, 71, 64, 72, 71, 69,
      71, 72, 74, 76, 67, 77, 76, 74, 65, 76, 74, 72, 64, 74, 72, 71,
    ],
  },
  ode_to_joy: {
    name: 'Ode to Joy',
    notes: [
      64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62,
      64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 62, 60, 60,
      62, 62, 64, 60, 62, 64, 65, 64, 60, 62, 64, 65, 64, 62, 60, 62, 55,
      64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 62, 60, 60,
    ].map((n) => n + 12),
  },
  mountain_king: {
    name: 'In the Hall of the Mountain King',
    notes: [
      57, 59, 60, 62, 64, 60, 64, 63, 59, 63, 62, 58, 62, 57, 59, 60, 62, 64, 60, 64, 69, 67, 64, 60, 64, 67,
      64, 66, 67, 69, 71, 67, 71, 70, 66, 70, 69, 65, 69, 64, 66, 67, 69, 71, 67, 71, 76, 74, 71, 67, 71, 74,
    ].map((n) => n + 12),
  },
  twinkle: {
    name: 'Twinkle Twinkle Little Star',
    notes: [
      60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60, 67, 67, 65, 65, 64, 64, 62,
      67, 67, 65, 65, 64, 64, 62, 60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60,
    ].map((n) => n + 12),
  },
  canon: {
    name: 'Canon in D',
    notes: [
      78, 76, 74, 73, 71, 69, 71, 73, 74, 73, 71, 69, 67, 66, 67, 64,
      62, 66, 69, 67, 66, 62, 66, 64, 62, 59, 62, 69, 67, 71, 69, 67,
      66, 62, 64, 73, 74, 78, 81, 69, 71, 67, 69, 66, 62, 74, 74, 73,
    ],
  },
  nachtmusik: {
    name: 'Eine kleine Nachtmusik',
    notes: [
      67, 62, 67, 62, 67, 62, 67, 71, 74, 72, 69, 72, 69, 72, 69, 66, 69, 62,
      67, 67, 71, 69, 67, 67, 66, 66, 69, 72, 66, 69, 67, 67, 71, 69, 67, 67, 66, 66, 69, 72, 66, 69, 67,
    ].map((n) => n + 5),
  },
  turkish_march: {
    name: 'Rondo alla Turca',
    notes: [
      71, 69, 68, 69, 72, 74, 72, 71, 72, 76, 77, 76, 75, 76, 83, 81, 80, 81, 83, 81, 80, 81, 84,
      81, 84, 83, 81, 79, 81, 83, 81, 79, 81, 83, 81, 79, 78, 76,
    ],
  },
  greensleeves: {
    name: 'Greensleeves',
    notes: [
      69, 72, 74, 76, 77, 76, 74, 71, 67, 69, 71, 72, 69, 69, 68, 69, 71, 68, 64,
      69, 72, 74, 76, 77, 76, 74, 71, 67, 69, 71, 72, 71, 69, 68, 66, 68, 69, 69,
    ],
  },
  jingle_bells: {
    name: 'Jingle Bells',
    notes: [
      64, 64, 64, 64, 64, 64, 64, 67, 60, 62, 64, 65, 65, 65, 65, 65, 64, 64, 64, 64, 62, 62, 64, 62, 67,
      64, 64, 64, 64, 64, 64, 64, 67, 60, 62, 64, 65, 65, 65, 65, 65, 64, 64, 64, 67, 67, 65, 62, 60,
    ].map((n) => n + 12),
  },
};

/** Melodies the feed draws from; Jingle Bells only in December (channel rule). */
export function feedMelodies(month: number): (keyof typeof MELODIES)[] {
  const all = Object.keys(MELODIES) as (keyof typeof MELODIES)[];
  return month === 11 ? all : all.filter((m) => m !== 'jingle_bells');
}
