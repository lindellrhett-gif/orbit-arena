// Everything the app remembers lives on the device: score, streak and settings. Nothing is sent anywhere.

import { loadValue, saveValue } from './platform';

export type Stats = {
  points: number;
  picks: number;
  wins: number;
  streak: number;
  best: number;
  /** Daily slots already played, as "YYYY-MM-DD#slot". Only the last few days are kept. */
  daily: string[];
};

export type Settings = { sound: boolean; reducedMotion: boolean };

const KEY = 'orbit-arena:v1';

type Saved = { stats: Stats; settings: Settings };

export const store: Saved = {
  stats: { points: 0, picks: 0, wins: 0, streak: 0, best: 0, daily: [] },
  settings: {
    sound: true,
    reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  },
};

export async function loadStore(): Promise<void> {
  const raw = await loadValue(KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw) as Partial<Saved>;
    Object.assign(store.stats, saved.stats ?? {});
    Object.assign(store.settings, saved.settings ?? {});
  } catch {
    // Corrupt save: start fresh.
  }
}

export function saveStore(): void {
  store.stats.daily = store.stats.daily.slice(-12);
  saveValue(KEY, JSON.stringify(store));
}

export function recordPick(won: boolean, points: number, dailyKey?: string): void {
  const s = store.stats;
  s.picks++;
  if (won) {
    s.wins++;
    s.streak++;
    s.points += points;
    if (s.streak > s.best) s.best = s.streak;
  } else {
    s.streak = 0;
  }
  if (dailyKey && !s.daily.includes(dailyKey)) s.daily.push(dailyKey);
  saveStore();
}

export function winRate(): number {
  return store.stats.picks ? Math.round((store.stats.wins / store.stats.picks) * 100) : 0;
}
