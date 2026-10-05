import { describe, expect, it } from 'vitest';
import { createRaid, raidReducer, type RaidAction } from './raidReducer';
import { COMBO_WINDOW_MS, HIT_COOLDOWN_MS } from './tuning';
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
