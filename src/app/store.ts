// Everything the app remembers lives on the device: score, streaks, daily history, saved sims and settings.
// Nothing is sent anywhere.

import type { SkinId, TrailId } from '../render/looks';
import type { Spec } from '../sim/spec';
import { loadValue, saveValue } from './platform';
import { has } from './shop';

export type Stats = {
  points: number;
  picks: number;
  wins: number;
  streak: number;
  best: number;
  /** Daily slots already played, as "YYYY-MM-DD#slot". Only the last few days are kept. */
  daily: string[];
};

/** One day of daily sims: how many were played, called right, and the points earned. */
export type DayLog = { played: number; called: number; points: number };

export type SavedSim = { spec: Spec; savedAt: number };

/** `skin` and `trail` only show while Skins & Trails is owned; otherwise everything draws in the classic look. */
export type Settings = { sound: boolean; reducedMotion: boolean; skin: SkinId; trail: TrailId };

/** Free sandbox slots. Unlimited Slots raises it to MAX_SLOTS; nothing else about the sandbox is limited. */
export const SANDBOX_SLOTS = 5;
/** A ceiling even with Unlimited Slots, so the save stays small. Saved sims above the free limit are kept if the
 * unlock goes away (e.g. the same save opened on the web); only new saves are blocked. */
export const MAX_SLOTS = 200;

export const slotLimit = (): number => (has('slots') ? MAX_SLOTS : SANDBOX_SLOTS);

const KEY = 'orbit-arena:v1';

type Saved = { stats: Stats; settings: Settings; days: Record<string, DayLog>; sims: SavedSim[] };

export const store: Saved = {
  stats: { points: 0, picks: 0, wins: 0, streak: 0, best: 0, daily: [] },
  settings: {
    sound: true,
    reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    skin: 'classic',
    trail: 'classic',
  },
  days: {},
  sims: [],
};

export async function loadStore(): Promise<void> {
  const raw = await loadValue(KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw) as Partial<Saved>;
    Object.assign(store.stats, saved.stats ?? {});
    Object.assign(store.settings, saved.settings ?? {});
    store.days = saved.days ?? {};
    store.sims = Array.isArray(saved.sims) ? saved.sims.slice(0, MAX_SLOTS) : [];
  } catch {
    // Corrupt save: start fresh.
  }
}

export function saveStore(): void {
  store.stats.daily = store.stats.daily.slice(-12);
  const days = Object.keys(store.days).sort();
  for (const d of days.slice(0, Math.max(0, days.length - 90))) delete store.days[d];
  saveValue(KEY, JSON.stringify(store));
}

/** Records a finished daily sim (picked or just watched). */
function logDaily(dailyKey: string, called: boolean, points: number): void {
  if (store.stats.daily.includes(dailyKey)) return;
  store.stats.daily.push(dailyKey);
  const date = dailyKey.split('#')[0];
  const day = (store.days[date] ??= { played: 0, called: 0, points: 0 });
  day.played++;
  if (called) {
    day.called++;
    day.points += points;
  }
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
  if (dailyKey) logDaily(dailyKey, won, points);
  saveStore();
}

export function recordWatch(dailyKey?: string): void {
  if (!dailyKey) return;
  logDaily(dailyKey, false, 0);
  saveStore();
}

export function winRate(): number {
  return store.stats.picks ? Math.round((store.stats.wins / store.stats.picks) * 100) : 0;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Consecutive days (ending today, or yesterday if today isn't finished yet) with all three dailies played. */
export function dailyStreak(today: string): number {
  let day = (store.days[today]?.played ?? 0) >= 3 ? today : addDays(today, -1);
  let n = 0;
  while ((store.days[day]?.played ?? 0) >= 3) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** The last `n` days, newest first, for the daily history strip. */
export function recentDays(today: string, n: number): { date: string; log: DayLog | null }[] {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, -i);
    return { date, log: store.days[date] ?? null };
  });
}

/** Your best daily scores (most called, then most points), for the local leaderboard. */
export function bestDays(n: number): { date: string; log: DayLog }[] {
  return Object.entries(store.days)
    .filter(([, log]) => log.played > 0)
    .sort(([da, a], [db, b]) => b.called - a.called || b.points - a.points || db.localeCompare(da))
    .slice(0, n)
    .map(([date, log]) => ({ date, log }));
}

export function saveSim(spec: Spec): boolean {
  if (store.sims.length >= slotLimit()) return false;
  store.sims.unshift({ spec, savedAt: Date.now() });
  saveStore();
  return true;
}

export function deleteSim(index: number): void {
  store.sims.splice(index, 1);
  saveStore();
}
