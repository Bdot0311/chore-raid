/**
 * The enemy fights back. On a steady rhythm it charges up a blow (with a
 * warning the player can see and hear) and then lands it on the hero. The
 * only way to strike first is to finish the next real item or step, which
 * interrupts the charge and resets the rhythm.
 *
 * This never touches the enemy's HP: that still moves only when real work is
 * done. What is at stake is the hero's health, and with it the bonuses: a
 * knocked-down hero loses a Loot Star and the FLAWLESS reward, then gets up
 * and carries on. Pure functions, like the raid reducer.
 */

export interface DuelPace {
  /** Time from the hero's last strike (or the enemy's last blow) to the next blow. */
  intervalMs: number;
  /** How long the warning shows before the blow lands. */
  chargeMs: number;
  damage: number;
}

export interface Duel {
  heroHp: number;
  heroMax: number;
  /** When the enemy's next blow lands; the charge starts chargeMs before. */
  nextAttackAt: number;
  /** The nextAttackAt whose charge has been announced, so it is announced once. */
  announced?: number;
  /** Blows taken this level (FLAWLESS means none). */
  hitsTaken: number;
  knockdowns: number;
  pace: DuelPace;
}

export type DuelEvent =
  | { type: 'charge'; landsAt: number }
  | { type: 'struck'; damage: number; heroHp: number }
  | { type: 'knockdown' }
  | { type: 'interrupt' };

export const HERO_MAX_HP = 100;

/** Real chores set the pace: a step takes minutes, a folded shirt seconds. */
export const PACE = {
  /** Quick steps (gather the load): a blow every ~45 s if you dawdle. */
  task: { intervalMs: 45_000, chargeMs: 12_000, damage: 15 },
  /** Counting fights against a minion. */
  minionFight: { intervalMs: 28_000, chargeMs: 9_000, damage: 12 },
  /** Boss fights hit harder and more often. */
  bossFight: { intervalMs: 24_000, chargeMs: 8_000, damage: 20 },
} satisfies Record<string, DuelPace>;

/** A missed wind-up lands as a heavy blow. */
export const WINDUP_MISS_DAMAGE = 25;
/** Score for striking while the enemy is charging. */
export const INTERRUPT_BONUS = 25;
/** XP for clearing a level without taking a single blow. */
export const FLAWLESS_XP = 50;
/** After a machine cycle ends, the enemy wakes up this long later and charges. */
export const WAKE_GRACE_MS = 10_000;

export function createDuel(now: number, pace: DuelPace, heroHp = HERO_MAX_HP): Duel {
  return { heroHp, heroMax: HERO_MAX_HP, nextAttackAt: now + pace.intervalMs, hitsTaken: 0, knockdowns: 0, pace };
}

/** A new step or fight: same health, new rhythm, a full interval to start. */
export function withPace(duel: Duel | undefined, pace: DuelPace, now: number): Duel {
  if (!duel) return createDuel(now, pace);
  return { ...duel, pace, nextAttackAt: now + pace.intervalMs, announced: undefined };
}

export function isCharging(duel: Duel, now: number) {
  return now >= duel.nextAttackAt - duel.pace.chargeMs && now < duel.nextAttackAt;
}

/** 1 when the charge starts, 0 when the blow lands. */
export function chargeLeft(duel: Duel, now: number) {
  if (!isCharging(duel, now)) return 0;
  return (duel.nextAttackAt - now) / duel.pace.chargeMs;
}

/** The hero finished an item or step. Mid-charge, that interrupts the blow. */
export function strike(duel: Duel, now: number): { duel: Duel; events: DuelEvent[] } {
  const events: DuelEvent[] = isCharging(duel, now) ? [{ type: 'interrupt' }] : [];
  return { duel: { ...duel, nextAttackAt: now + duel.pace.intervalMs, announced: undefined }, events };
}

/** Holds the enemy back (a machine cycle, a wind-up) until a moment, then a full charge. */
export function holdUntil(duel: Duel, until: number): Duel {
  const at = until + duel.pace.chargeMs;
  return at > duel.nextAttackAt ? { ...duel, nextAttackAt: at, announced: undefined } : duel;
}

/** A blow lands. At zero health the hero is knocked down and gets back up at full. */
export function hurt(duel: Duel, damage: number): { duel: Duel; events: DuelEvent[] } {
  const heroHp = duel.heroHp - damage;
  if (heroHp > 0) {
    return { duel: { ...duel, heroHp, hitsTaken: duel.hitsTaken + 1 }, events: [{ type: 'struck', damage, heroHp }] };
  }
  return {
    duel: { ...duel, heroHp: duel.heroMax, hitsTaken: duel.hitsTaken + 1, knockdowns: duel.knockdowns + 1 },
    events: [{ type: 'struck', damage, heroHp: 0 }, { type: 'knockdown' }],
  };
}

/**
 * Advances the rhythm. After a long absence (phone in a pocket) only one blow
 * lands, never a backlog, and the rhythm restarts from now.
 */
export function tick(duel: Duel, now: number): { duel: Duel; events: DuelEvent[] } {
  if (now >= duel.nextAttackAt) {
    const res = hurt(duel, duel.pace.damage);
    return { duel: { ...res.duel, nextAttackAt: now + duel.pace.intervalMs, announced: undefined }, events: res.events };
  }
  if (isCharging(duel, now) && duel.announced !== duel.nextAttackAt) {
    return { duel: { ...duel, announced: duel.nextAttackAt }, events: [{ type: 'charge', landsAt: duel.nextAttackAt }] };
  }
  return { duel, events: [] };
}

/** A level is cleared: full health, and the FLAWLESS count starts over. */
export function rest(duel: Duel | undefined): Duel | undefined {
  return duel && { ...duel, heroHp: duel.heroMax, hitsTaken: 0 };
}
