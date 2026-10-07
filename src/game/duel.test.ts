import { describe, expect, it } from 'vitest';
import { createDuel, holdUntil, hurt, isCharging, PACE, rest, strike, tick, withPace } from './duel';

const pace = PACE.bossFight;
/** When the opening blow of a fresh duel lands. */
const first = createDuel(0, pace).nextAttackAt;

describe('duel', () => {
  it('charges, announces once, then lands a blow', () => {
    let d = createDuel(0, pace);
    expect(tick(d, 1000).events).toEqual([]);
    const chargeAt = first - pace.chargeMs;
    let r = tick(d, chargeAt);
    expect(r.events).toEqual([{ type: 'charge', landsAt: first }]);
    d = r.duel;
    expect(tick(d, chargeAt + 100).events).toEqual([]);
    r = tick(d, first);
    expect(r.events).toEqual([{ type: 'struck', damage: pace.damage, heroHp: 100 - pace.damage }]);
    expect(r.duel.hitsTaken).toBe(1);
    expect(r.duel.nextAttackAt).toBe(first + pace.intervalMs);
  });

  it('finishing an item mid-charge interrupts the blow', () => {
    const d = createDuel(0, pace);
    const at = first - 1000;
    expect(isCharging(d, at)).toBe(true);
    const r = strike(d, at);
    expect(r.events).toEqual([{ type: 'interrupt' }]);
    expect(r.duel.nextAttackAt).toBe(at + pace.intervalMs);
    expect(r.duel.heroHp).toBe(100);
  });

  it('finishing an item early resets the rhythm without an interrupt', () => {
    const r = strike(createDuel(0, pace), 1000);
    expect(r.events).toEqual([]);
    expect(r.duel.nextAttackAt).toBe(1000 + pace.intervalMs);
  });

  it('lands only one blow after a long absence', () => {
    const r = tick(createDuel(0, pace), 10 * 60_000);
    expect(r.events.filter((e) => e.type === 'struck')).toHaveLength(1);
    expect(r.duel.nextAttackAt).toBe(10 * 60_000 + pace.intervalMs);
  });

  it('knocks the hero down at zero and back up at full health', () => {
    let d = createDuel(0, pace, 30);
    const r = hurt(d, 40);
    expect(r.events).toEqual([{ type: 'struck', damage: 40, heroHp: 0 }, { type: 'knockdown' }]);
    d = r.duel;
    expect(d.heroHp).toBe(d.heroMax);
    expect(d.knockdowns).toBe(1);
  });

  it('holds the enemy back during a machine cycle', () => {
    const d = holdUntil(createDuel(0, PACE.task), 30 * 60_000);
    expect(isCharging(d, 29 * 60_000)).toBe(false);
    expect(d.nextAttackAt).toBe(30 * 60_000 + PACE.task.chargeMs);
  });

  it('keeps health across steps and heals on rest', () => {
    const hurtDuel = hurt(createDuel(0, PACE.task), 40).duel;
    const next = withPace(hurtDuel, PACE.bossFight, 1000);
    expect(next.heroHp).toBe(60);
    expect(next.pace).toBe(PACE.bossFight);
    expect(rest(next)).toMatchObject({ heroHp: 100, hitsTaken: 0 });
  });
});
