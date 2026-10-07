import { createDuel, INTERRUPT_BONUS, PACE } from './duel';
import { describe, expect, it } from 'vitest';
import { activeWindup, createRaid, planWindups, raidReducer, type RaidAction } from './raidReducer';
import { COMBO_WINDOW_MS, HIT_COOLDOWN_MS, STARTING_LOOT_STARS, WINDUP_MS_PER_ITEM } from './tuning';
import type { Raid } from './types';

const HIT: RaidAction = { type: 'HIT', source: 'tap' };

function hitN(raid: Raid, n: number, start: number, gap = 1000) {
  let r = raid;
  let t = start;
  for (let i = 0; i < n; i++) {
    r = raidReducer(r, HIT, t).raid;
    t += gap;
  }
  return { raid: r, t };
}

describe('raidReducer', () => {
  it('removes exactly one HP per hit, whatever the combo', () => {
    const { raid } = hitN(createRaid('r', 'laundry', 20, 0), 12, 0);
    expect(raid.hp).toBe(8);
    expect(raid.bestCombo).toBe(4);
  });

  it('kills the boss on exactly the last item', () => {
    let raid = createRaid('r', 'laundry', 3, 0);
    raid = hitN(raid, 2, 0).raid;
    expect(raid.status).toBe('active');
    const res = raidReducer(raid, HIT, 5000);
    expect(res.raid.hp).toBe(0);
    expect(res.raid.status).toBe('won');
    expect(res.raid.endedAt).toBe(5000);
    expect(res.events.map((e) => e.type)).toContain('dead');
  });

  it('ignores hits inside the cooldown', () => {
    let raid = raidReducer(createRaid('r', 'laundry', 5, 0), HIT, 1000).raid;
    const res = raidReducer(raid, HIT, 1000 + HIT_COOLDOWN_MS - 1);
    expect(res.raid).toBe(raid);
    expect(res.events).toEqual([{ type: 'ignored', reason: 'cooldown' }]);
    raid = raidReducer(raid, HIT, 1000 + HIT_COOLDOWN_MS).raid;
    expect(raid.hp).toBe(3);
  });

  it('ignores hits after the boss is dead', () => {
    const { raid } = hitN(createRaid('r', 'laundry', 1, 0), 1, 0);
    const res = raidReducer(raid, HIT, 99_999);
    expect(res.raid.hp).toBe(0);
    expect(res.events[0]).toEqual({ type: 'ignored', reason: 'not-active' });
  });

  it('climbs combo tiers at 3, 6 and 10 hits', () => {
    let raid = createRaid('r', 'laundry', 50, 0);
    const ups: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = raidReducer(raid, HIT, i * 1000);
      raid = res.raid;
      for (const e of res.events) if (e.type === 'combo-up') ups.push(e.multiplier);
    }
    expect(ups).toEqual([2, 3, 4]);
    // Hits 1-2 at 1×, 3-5 at 2×, 6-9 at 3×, 10 at 4×.
    expect(raid.score).toBe(20 + 60 + 120 + 40);
  });

  it('resets the combo when the window lapses', () => {
    let { raid, t } = hitN(createRaid('r', 'laundry', 50, 0), 5, 0);
    const tick = raidReducer(raid, { type: 'TICK' }, t + COMBO_WINDOW_MS + 1);
    expect(tick.events).toEqual([{ type: 'combo-break' }]);
    raid = raidReducer(tick.raid, HIT, t + COMBO_WINDOW_MS + 2).raid;
    expect(raid.streak).toBe(1);
    expect(raid.hits.at(-1)!.combo).toBe(1);
  });

  it('a late hit starts a fresh streak even without a TICK', () => {
    const { raid, t } = hitN(createRaid('r', 'laundry', 50, 0), 5, 0);
    const res = raidReducer(raid, HIT, t + COMBO_WINDOW_MS + 5000);
    expect(res.raid.streak).toBe(1);
    expect(res.events.find((e) => e.type === 'combo-up')).toBeUndefined();
  });

  it('undo restores one HP, refunds the score and breaks the combo', () => {
    const { raid, t } = hitN(createRaid('r', 'laundry', 10, 0), 4, 0);
    expect(raid.hp).toBe(6);
    const res = raidReducer(raid, { type: 'UNDO' }, t);
    expect(res.raid.hp).toBe(7);
    expect(res.raid.streak).toBe(0);
    expect(res.raid.score).toBe(raid.score - 20);
    expect(res.raid.hits.filter((h) => !h.undone)).toHaveLength(3);
    // Undo twice walks back further.
    const again = raidReducer(res.raid, { type: 'UNDO' }, t);
    expect(again.raid.hp).toBe(8);
  });

  it('undo with no hits is a no-op', () => {
    const raid = createRaid('r', 'laundry', 10, 0);
    expect(raidReducer(raid, { type: 'UNDO' }, 0).raid).toBe(raid);
  });
});

describe('wind-ups', () => {
  const half = () => 0.5;

  it('plans wind-ups every 25-35% and never in the last 3 items', () => {
    expect(planWindups(4)).toEqual([]);
    expect(planWindups(20, half)).toEqual([14, 8]);
    for (let n = 5; n < 200; n++) {
      const at = planWindups(n);
      for (const hp of at) expect(hp).toBeGreaterThan(3);
      for (let i = 1; i < at.length; i++) expect(at[i - 1] - at[i]).toBeGreaterThanOrEqual(4);
    }
  });

  it('starts a wind-up at the planned HP and pays out when beaten in time', () => {
    const { raid: r, t } = hitN(createRaid('r', 'dishes', 20, 0, half), 6, 0);
    expect(r.hp).toBe(14);
    const w = activeWindup(r)!;
    expect(w.target).toBe(3);
    expect(w.deadline).toBe(5000 + 3 * WINDUP_MS_PER_ITEM);
    const scoreBefore = r.score;
    const { raid } = hitN(r, 3, t, 5000);
    expect(activeWindup(raid)).toBeUndefined();
    expect(raid.windups[0].beaten).toBe(true);
    expect(raid.lootStars).toBe(STARTING_LOOT_STARS + 1);
    expect(raid.score).toBeGreaterThan(scoreBefore + 150);
    expect(raid.hp).toBe(11);
  });

  it('a missed wind-up costs a Loot Star but never HP', () => {
    const { raid } = hitN(createRaid('r', 'dishes', 20, 0, half), 6, 0);
    const res = raidReducer(raid, { type: 'TICK' }, 5000 + 3 * WINDUP_MS_PER_ITEM + 1);
    expect(res.events).toContainEqual({ type: 'windup-missed', lootStars: STARTING_LOOT_STARS - 1 });
    expect(res.raid.hp).toBe(14);
    expect(res.raid.windups[0].beaten).toBe(false);
  });

  it('undo inside a wind-up takes back its progress', () => {
    let { raid, t } = hitN(createRaid('r', 'dishes', 20, 0, half), 7, 0);
    expect(activeWindup(raid)!.progress).toBe(1);
    raid = raidReducer(raid, { type: 'UNDO' }, t).raid;
    expect(activeWindup(raid)!.progress).toBe(0);
  });
});

describe('the enemy fights back', () => {
  const pace = PACE.bossFight;
  const fresh = () => createRaid('r', 'laundry', 4, 0, () => 0.5, createDuel(0, pace));
  const first = createDuel(0, pace).nextAttackAt;

  it('charges and lands a blow on the hero, never touching the boss HP', () => {
    let raid = fresh();
    let res = raidReducer(raid, { type: 'TICK' }, first - pace.chargeMs);
    expect(res.events).toContainEqual({ type: 'enemy-charge', landsAt: first });
    raid = res.raid;
    res = raidReducer(raid, { type: 'TICK' }, first);
    expect(res.events).toContainEqual({ type: 'hero-struck', damage: pace.damage, heroHp: 100 - pace.damage, big: false });
    expect(res.raid.hp).toBe(4);
  });

  it('a hit during the charge interrupts it for bonus score', () => {
    const res = raidReducer(fresh(), { type: 'HIT', source: 'tap' }, first - 1000);
    expect(res.events).toContainEqual({ type: 'interrupt', bonus: INTERRUPT_BONUS });
    expect(res.raid.duel!.nextAttackAt).toBe(first - 1000 + pace.intervalMs);
  });

  it('a knockdown costs a Loot Star', () => {
    const raid = { ...fresh(), duel: { ...createDuel(0, pace), heroHp: 5 } };
    const res = raidReducer(raid, { type: 'TICK' }, first);
    expect(res.events).toContainEqual({ type: 'knockdown', lootStars: raid.lootStars - 1 });
    expect(res.raid.duel!.heroHp).toBe(100);
  });
});
