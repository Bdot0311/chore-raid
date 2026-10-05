import type { HitSource, Raid } from './types';
import {
  COMBO_WINDOW_MS,
  HIT_COOLDOWN_MS,
  SCORE_PER_HIT,
  STARTING_LOOT_STARS,
  multiplierFor,
} from './tuning';

export type RaidAction =
  | { type: 'HIT'; source: HitSource }
  | { type: 'UNDO' }
  | { type: 'TICK' };

export type RaidEvent =
  | { type: 'hit'; hp: number; multiplier: number; gained: number }
  | { type: 'ignored'; reason: 'cooldown' | 'not-active' }
  | { type: 'combo-up'; multiplier: number }
  | { type: 'combo-break' }
  | { type: 'undo'; hp: number }
  | { type: 'dead' };

export interface RaidResult {
  raid: Raid;
  events: RaidEvent[];
}

export function createRaid(id: string, bossId: string, maxHp: number, now: number): Raid {
  return {
    id,
    bossId,
    maxHp,
    hp: maxHp,
    status: 'active',
    startedAt: now,
    hits: [],
    score: 0,
    streak: 0,
    bestCombo: 1,
    lootStars: STARTING_LOOT_STARS,
    windups: [],
  };
}

/** The last hit that still counts. */
export function lastLiveHit(raid: Raid) {
  for (let i = raid.hits.length - 1; i >= 0; i--) {
    if (!raid.hits[i].undone) return raid.hits[i];
  }
  return undefined;
}

export function currentMultiplier(raid: Raid): number {
  return multiplierFor(raid.streak);
}

/** 1 → 0 as the combo window drains; 0 when there is no combo. */
export function comboDrain(raid: Raid, now: number): number {
  const last = lastLiveHit(raid);
  if (!last || raid.streak === 0) return 0;
  return Math.max(0, 1 - (now - last.at) / COMBO_WINDOW_MS);
}

/**
 * Pure raid logic. HP is sacred: a HIT removes exactly one HP, an UNDO restores
 * exactly one. Combos only ever change score.
 */
export function raidReducer(raid: Raid, action: RaidAction, now: number): RaidResult {
  if (raid.status !== 'active') {
    return action.type === 'HIT'
      ? { raid, events: [{ type: 'ignored', reason: 'not-active' }] }
      : { raid, events: [] };
  }

  switch (action.type) {
    case 'HIT': {
      // Cooldown counts undone hits too, so a double tap right after an undo is still caught.
      const prev = raid.hits[raid.hits.length - 1];
      if (prev && now - prev.at < HIT_COOLDOWN_MS) {
        return { raid, events: [{ type: 'ignored', reason: 'cooldown' }] };
      }

      const events: RaidEvent[] = [];
      const live = lastLiveHit(raid);
      const comboAlive = live !== undefined && now - live.at <= COMBO_WINDOW_MS;
      const oldMultiplier = comboAlive ? multiplierFor(raid.streak) : 1;
      const streak = comboAlive ? raid.streak + 1 : 1;
      const multiplier = multiplierFor(streak);
      const gained = SCORE_PER_HIT * multiplier;
      const hp = raid.hp - 1;

      if (multiplier > oldMultiplier) events.push({ type: 'combo-up', multiplier });

      let next: Raid = {
        ...raid,
        hp,
        streak,
        score: raid.score + gained,
        bestCombo: Math.max(raid.bestCombo, multiplier),
        hits: [...raid.hits, { at: now, source: action.source, combo: multiplier }],
      };
      events.unshift({ type: 'hit', hp, multiplier, gained });

      if (hp <= 0) {
        next = { ...next, hp: 0, status: 'won', endedAt: now };
        events.push({ type: 'dead' });
      }
      return { raid: next, events };
    }

    case 'UNDO': {
      let index = -1;
      for (let i = raid.hits.length - 1; i >= 0; i--) {
        if (!raid.hits[i].undone) {
          index = i;
          break;
        }
      }
      if (index < 0) return { raid, events: [] };

      const undoneHit = raid.hits[index];
      const hits = raid.hits.slice();
      hits[index] = { ...undoneHit, undone: true };
      const hp = raid.hp + 1;
      return {
        raid: {
          ...raid,
          hits,
          hp,
          streak: 0,
          score: Math.max(0, raid.score - SCORE_PER_HIT * undoneHit.combo),
        },
        events: [{ type: 'undo', hp }],
      };
    }

    case 'TICK': {
      const last = lastLiveHit(raid);
      if (raid.streak > 0 && last && now - last.at > COMBO_WINDOW_MS) {
        const broke = multiplierFor(raid.streak) > 1;
        return {
          raid: { ...raid, streak: 0 },
          events: broke ? [{ type: 'combo-break' }] : [],
        };
      }
      return { raid, events: [] };
    }
  }
}
