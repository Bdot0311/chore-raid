import { LAIR_IDS, throneUnlocked } from './campaign';
import type { Profile, RegionId } from './types';

/**
 * The mess comes back. Real chores do, so a freed lair is slowly retaken by
 * its minions, at the pace the real chore piles up again: the sink fills in a
 * day, the bathroom takes a week. Once three lairs have fallen, the Mess King
 * climbs back onto his throne. All pure, so it can be tested.
 */

const DAY = 86_400_000;

type LairId = Exclude<RegionId, 'throne'>;

/** Days from freed to fully retaken, per lair. */
export const REGROW_DAYS: Record<LairId, number> = {
  dishes: 1,
  laundry: 4,
  clutter: 3,
  floors: 5,
  trash: 4,
  bathroom: 7,
  bedroom: 7,
};

/** Mess at which a freed lair shows it is creeping back. */
export const CREEPING_AT = 0.5;
/** Retaken lairs it takes for the Mess King to return to his throne. */
export const KING_RETURNS_AT = 3;

export type RegionState = 'never' | 'free' | 'creeping' | 'retaken';

/** How far the mess has grown back since the region was freed: 0 (spotless) to 1 (retaken). */
export function messLevel(regionId: RegionId, freedAt: number | undefined, now: number): number {
  if (freedAt === undefined) return 1;
  // The throne does not regrow; the King comes back through the lairs instead.
  if (regionId === 'throne') return 0;
  return Math.min(1, Math.max(0, (now - freedAt) / (REGROW_DAYS[regionId] * DAY)));
}

export function regionState(regionId: RegionId, freedAt: number | undefined, now: number): RegionState {
  if (freedAt === undefined) return 'never';
  const mess = messLevel(regionId, freedAt, now);
  return mess >= 1 ? 'retaken' : mess >= CREEPING_AT ? 'creeping' : 'free';
}

/** The parts of the profile that say who holds what. */
type Holdings = Pick<Profile, 'regionsCleared' | 'regionFreedAt' | 'kingDefeats'>;

export const lairState = (p: Holdings, id: RegionId, now: number) => regionState(id, p.regionFreedAt[id], now);

/** Freed lairs the minions have taken back, the longest-lost first. */
export function retakenLairs(p: Holdings, now: number): LairId[] {
  return LAIR_IDS.filter((id) => lairState(p, id, now) === 'retaken').sort(
    (a, b) => p.regionFreedAt[a] + REGROW_DAYS[a] * DAY - (p.regionFreedAt[b] + REGROW_DAYS[b] * DAY),
  );
}

/** What to fight next: retaken lairs first, then the ones creeping back, messiest first. */
export function reclaimTargets(p: Holdings, now: number): { id: LairId; state: 'retaken' | 'creeping' }[] {
  const creeping = LAIR_IDS.filter((id) => lairState(p, id, now) === 'creeping').sort(
    (a, b) => messLevel(b, p.regionFreedAt[b], now) - messLevel(a, p.regionFreedAt[a], now),
  );
  return [
    ...retakenLairs(p, now).map((id) => ({ id, state: 'retaken' as const })),
    ...creeping.map((id) => ({ id, state: 'creeping' as const })),
  ];
}

/** The King has been toppled before, and enough lairs have fallen for him to come back. */
export function kingReturned(p: Holdings, now: number) {
  return p.kingDefeats > 0 && retakenLairs(p, now).length >= KING_RETURNS_AT;
}

/** First time: every lair freed once. After that: whenever the King has returned. */
export function throneOpen(p: Holdings, now: number) {
  return p.kingDefeats === 0 ? throneUnlocked(p.regionsCleared) : kingReturned(p, now);
}

/** The reign of the King on (or coming back to) the throne: 1 until he is first toppled. */
export const reign = (p: Holdings) => p.kingDefeats + 1;

/** A region's quest is won: its regrow timer restarts, and the King counts his defeats. */
export function markFreed<P extends Holdings>(p: P, regionId: RegionId, now: number): P {
  return {
    ...p,
    regionsCleared: p.regionsCleared.includes(regionId) ? p.regionsCleared : [...p.regionsCleared, regionId],
    regionFreedAt: { ...p.regionFreedAt, [regionId]: now },
    kingDefeats: regionId === 'throne' ? p.kingDefeats + 1 : p.kingDefeats,
  };
}

export type FreedMode = 'ending' | 'throne-first' | 'throne-again' | 'remaining' | 'reclaimed';

/**
 * Which story beat follows a region's win, given the profile after the win:
 * the ending, the throne opening, lairs still to free, or a lair simply taken back.
 */
export function freedMode(regionId: RegionId, p: Holdings, now: number): { mode: FreedMode; remaining: number } {
  const remaining = LAIR_IDS.filter((id) => !p.regionsCleared.includes(id)).length;
  if (regionId === 'throne') return { mode: 'ending', remaining };
  if (throneOpen(p, now)) return { mode: p.kingDefeats === 0 ? 'throne-first' : 'throne-again', remaining };
  return { mode: remaining > 0 ? 'remaining' : 'reclaimed', remaining };
}
