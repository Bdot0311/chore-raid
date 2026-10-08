import { describe, expect, it } from 'vitest';
import { LAIR_IDS } from './campaign';
import { backIn, freedLines, say } from './narration';
import { dailyBounty } from './progression';
import {
  freedMode,
  kingReturned,
  markFreed,
  messLevel,
  reclaimTargets,
  regionState,
  reign,
  retakenLairs,
  REGROW_DAYS,
  throneOpen,
} from './reclaim';
import { DEFAULT_PROFILE, migrateProfile } from './store';
import type { Profile } from './types';

const DAY = 86_400_000;
const T0 = new Date(2026, 9, 1, 12).getTime();

/** A profile with every lair freed at T0 and the King toppled `defeats` times. */
function allFreed(defeats: number): Profile {
  let p: Profile = { ...DEFAULT_PROFILE };
  for (const id of LAIR_IDS) p = markFreed(p, id, T0);
  for (let i = 0; i < defeats; i++) p = markFreed(p, 'throne', T0);
  return p;
}

describe('the mess comes back', () => {
  it('regrows at the pace of the real chore', () => {
    expect(REGROW_DAYS).toEqual({ dishes: 1, laundry: 4, clutter: 3, floors: 5, trash: 4, bathroom: 7, bedroom: 7 });
    expect(messLevel('dishes', T0, T0)).toBe(0);
    expect(messLevel('dishes', T0, T0 + DAY / 2)).toBeCloseTo(0.5);
    expect(messLevel('dishes', T0, T0 + 3 * DAY)).toBe(1);
    expect(messLevel('bathroom', T0, T0 + 3.5 * DAY)).toBeCloseTo(0.5);
    // A clock that went backwards never makes negative mess.
    expect(messLevel('laundry', T0, T0 - DAY)).toBe(0);
    // Never freed is as messy as it gets; the throne never regrows on its own.
    expect(messLevel('laundry', undefined, T0)).toBe(1);
    expect(messLevel('throne', T0, T0 + 99 * DAY)).toBe(0);
  });

  it('goes from free to creeping to retaken', () => {
    expect(regionState('laundry', undefined, T0)).toBe('never');
    expect(regionState('laundry', T0, T0 + DAY)).toBe('free');
    expect(regionState('laundry', T0, T0 + 2 * DAY)).toBe('creeping');
    expect(regionState('laundry', T0, T0 + 4 * DAY - 1)).toBe('creeping');
    expect(regionState('laundry', T0, T0 + 4 * DAY)).toBe('retaken');
  });

  it('winning a lair again resets its timer and keeps it cleared once', () => {
    const p = markFreed(markFreed({ ...DEFAULT_PROFILE }, 'dishes', T0), 'dishes', T0 + 5 * DAY);
    expect(p.regionsCleared).toEqual(['dishes']);
    expect(p.regionFreedAt.dishes).toBe(T0 + 5 * DAY);
    expect(regionState('dishes', p.regionFreedAt.dishes, T0 + 5 * DAY)).toBe('free');
    expect(p.kingDefeats).toBe(0);
  });

  it('lists retaken lairs first, longest-lost first, then the creeping ones', () => {
    const p = allFreed(0);
    // Day 4.5: dishes (1 day), clutter (3) and laundry/trash (4) are retaken;
    // floors (5 days, 90%) creeps ahead of the bathroom and bedroom (7 days, 64%).
    const now = T0 + 4.5 * DAY;
    expect(retakenLairs(p, now)).toEqual(['dishes', 'clutter', 'laundry', 'trash']);
    const targets = reclaimTargets(p, now);
    expect(targets.slice(0, 4).every((t) => t.state === 'retaken')).toBe(true);
    expect(targets.slice(4)).toEqual([
      { id: 'floors', state: 'creeping' },
      { id: 'bathroom', state: 'creeping' },
      { id: 'bedroom', state: 'creeping' },
    ]);
    // Day 2: dishes is retaken, clutter (67%), laundry and trash (50%) creep; the rest are free.
    expect(reclaimTargets(p, T0 + 2 * DAY).map((t) => t.id)).toEqual(['dishes', 'clutter', 'laundry', 'trash']);
  });
});

describe('the throne and the King’s return', () => {
  it('first opens when all seven lairs are freed', () => {
    const six = LAIR_IDS.slice(0, 6).reduce((p, id) => markFreed(p, id, T0), { ...DEFAULT_PROFILE } as Profile);
    expect(throneOpen(six, T0)).toBe(false);
    const seven = markFreed(six, LAIR_IDS[6], T0);
    expect(throneOpen(seven, T0)).toBe(true);
    // Before the first win it stays open however messy things get again.
    expect(throneOpen(seven, T0 + 30 * DAY)).toBe(true);
    expect(reign(seven)).toBe(1);
  });

  it('closes once the King falls, and reopens when three lairs are retaken', () => {
    const p = allFreed(1);
    expect(p.kingDefeats).toBe(1);
    expect(reign(p)).toBe(2);
    expect(throneOpen(p, T0)).toBe(false);
    // Day 3: dishes and clutter are retaken. Two is not enough.
    expect(retakenLairs(p, T0 + 3 * DAY)).toHaveLength(2);
    expect(kingReturned(p, T0 + 3 * DAY)).toBe(false);
    // Day 4: laundry and trash fall too.
    expect(kingReturned(p, T0 + 4 * DAY)).toBe(true);
    expect(throneOpen(p, T0 + 4 * DAY)).toBe(true);
  });

  it('winning back lairs sends the King away again, and each win counts a reign', () => {
    const now = T0 + 4 * DAY;
    let p = allFreed(1);
    p = markFreed(p, 'dishes', now);
    p = markFreed(p, 'clutter', now);
    expect(retakenLairs(p, now)).toHaveLength(2);
    expect(throneOpen(p, now)).toBe(false);

    const back = markFreed(allFreed(1), 'throne', now);
    expect(back.kingDefeats).toBe(2);
    expect(reign(back)).toBe(3);
    expect(throneOpen(back, now)).toBe(true);
  });

  it('picks the right story beat after a win', () => {
    const one = markFreed({ ...DEFAULT_PROFILE }, 'laundry', T0);
    expect(freedMode('laundry', one, T0)).toEqual({ mode: 'remaining', remaining: 6 });
    expect(freedMode('trash', allFreed(0), T0).mode).toBe('throne-first');
    expect(freedMode('throne', allFreed(1), T0).mode).toBe('ending');
    expect(freedMode('dishes', allFreed(1), T0 + DAY / 2).mode).toBe('reclaimed');
    // Four lairs lost, one won back: three still lost, so the King stays.
    const p = markFreed(allFreed(1), 'dishes', T0 + 4 * DAY);
    expect(freedMode('dishes', p, T0 + 4 * DAY).mode).toBe('throne-again');
  });
});

describe('the bounty and the map', () => {
  it('prefers retaken lairs for the bounty', () => {
    const p = allFreed(0);
    const now = T0 + 3 * DAY;
    // Day 3: only dishes and clutter are retaken.
    expect(['dishes', 'clutter']).toContain(dailyBounty(now, p.regionFreedAt));
    expect(['dishes', 'clutter']).toContain(dailyBounty(now + DAY / 2, p.regionFreedAt));
    const days = [0, 1, 2].map((d) => dailyBounty(now + d * DAY, markFreed(p, 'dishes', now + d * DAY).regionFreedAt));
    expect(days.every((id) => id !== 'dishes')).toBe(true);
  });

  it('rotates through all seven lairs when none are retaken', () => {
    const seen = new Set(Array.from({ length: 7 }, (_, d) => dailyBounty(T0 + d * DAY)));
    expect(seen.size).toBe(7);
  });

  it('tells the map who is back', () => {
    expect(backIn('laundry')).toBe('The Sock Goblins are back in the Laundry Lair.');
    const base = { cleared: 7, throneOpen: false, kingBack: false, retaken: [] };
    expect(say.map({ ...base, retaken: ['dishes'] })).toBe('Back at the map. The Grease Gremlins are back in the Sink Caverns. Go and remind them.');
    expect(say.map({ ...base, retaken: ['dishes', 'laundry', 'trash'], kingBack: true })).toMatch(/^The Mess King is back/);
    expect(freedLines('The Sink Caverns', 'reclaimed', 0, 'Ada').text).toMatch(/Ada\.$/);
  });
});

describe('profile migration', () => {
  it('fills in the reclaim fields from older saves', () => {
    const old = { ...DEFAULT_PROFILE, regionsCleared: ['laundry', 'dishes', 'clutter', 'throne'] } as Partial<Profile>;
    delete old.regionFreedAt;
    delete old.kingDefeats;
    const p = migrateProfile(old, T0);
    expect(p.regionFreedAt).toEqual({ laundry: T0, dishes: T0, clutter: T0, throne: T0 });
    expect(p.kingDefeats).toBe(1);
    expect(regionState('dishes', p.regionFreedAt.dishes, T0)).toBe('free');
  });

  it('keeps what newer saves have, and starts fresh with nothing', () => {
    const saved = { ...DEFAULT_PROFILE, regionsCleared: ['laundry'], regionFreedAt: { laundry: 5 }, kingDefeats: 2 };
    expect(migrateProfile(saved, T0)).toMatchObject({ regionFreedAt: { laundry: 5 }, kingDefeats: 2 });
    expect(migrateProfile(undefined, T0)).toMatchObject({ regionFreedAt: {}, kingDefeats: 0, regionsCleared: [] });
  });
});
