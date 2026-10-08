import { LAIR_IDS } from './campaign';
import { regionState } from './reclaim';
import type { Profile, RegionId } from './types';

/**
 * Hero progression: XP from every step, hero levels, weapons that unlock along
 * the way, a daily bounty and a streak. All pure, so it can be tested.
 */

/**
 * Total XP needed to reach `level` (level 1 needs 0). A full quest is worth
 * roughly 300–700 XP, so level 2 comes after the first quest and the last
 * weapon takes a few weeks of real chores.
 */
export function xpForLevel(level: number) {
  return 250 * (level - 1) * level;
}

export function heroLevel(xp: number) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** Progress through the current level, 0–1, for the XP bar. */
export function levelProgress(xp: number) {
  const level = heroLevel(xp);
  const lo = xpForLevel(level);
  const hi = xpForLevel(level + 1);
  return { level, into: xp - lo, needed: hi - lo, pct: (xp - lo) / (hi - lo) };
}

export interface WeaponDef {
  id: string;
  name: string;
  unlockLevel: number;
  /** Tint on the blade and color of its slash trails. */
  tint: number;
  trail: number;
  blurb: string;
}

export const WEAPONS: WeaponDef[] = [
  { id: 'broomblade', name: 'The Broomblade', unlockLevel: 1, tint: 0xffffff, trail: 0xffffff, blurb: 'Found in the hall closet. Sweeps and slays.' },
  { id: 'frost', name: 'Frostbristle', unlockLevel: 3, tint: 0xb8e6ff, trail: 0x7dd3fc, blurb: 'Leaves a trail of ice. Keeps the dishes cold.' },
  { id: 'ember', name: 'Emberbroom', unlockLevel: 5, tint: 0xffc2a0, trail: 0xff7a3d, blurb: 'Burns through clutter. Smells faintly of toast.' },
  { id: 'royal', name: 'The Royal Mop', unlockLevel: 8, tint: 0xffe28a, trail: 0xffc94d, blurb: 'Fit for whoever takes the crown.' },
];

export function weapon(id: string) {
  return WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];
}

/** The local date as YYYY-MM-DD. */
export function dayKey(now: number) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** Counts a day of play: consecutive days grow the streak, a gap resets it. */
export function touchStreak(streak: Profile['streak'], now: number): Profile['streak'] {
  const today = dayKey(now);
  if (streak.lastDate === today) return streak;
  const gap = streak.lastDate ? daysBetween(streak.lastDate, today) : Infinity;
  return { days: gap === 1 ? streak.days + 1 : 1, lastDate: today };
}

/**
 * Today's bounty region: double XP there. Rotates daily through the lairs the
 * minions have retaken, or through every lair when none have fallen.
 */
export function dailyBounty(now: number, freedAt: Profile['regionFreedAt'] = {}): Exclude<RegionId, 'throne'> {
  const retaken = LAIR_IDS.filter((id) => regionState(id, freedAt[id], now) === 'retaken');
  const pool = retaken.length ? retaken : LAIR_IDS;
  const day = Math.floor(Date.parse(dayKey(now)) / 86_400_000);
  return pool[((day % pool.length) + pool.length) % pool.length];
}
