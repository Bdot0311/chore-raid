import type { HitSource, Raid, Windup } from './types';
import {
  COMBO_WINDOW_MS,
  HIT_COOLDOWN_MS,
  MAX_LOOT_STARS,
  SCORE_PER_HIT,
  STARTING_LOOT_STARS,
  WINDUP_BONUS_PER_ITEM,
  WINDUP_LAST_ITEMS,
  WINDUP_MAX_TARGET,
  WINDUP_MIN_MAX_HP,
  WINDUP_MS_PER_ITEM,
  WINDUP_SPACING_MAX,
  WINDUP_SPACING_MIN,
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
  | { type: 'windup-start'; target: number; deadline: number }
  | { type: 'windup-progress'; progress: number; target: number }
  | { type: 'windup-beaten'; bonus: number; lootStars: number }
  | { type: 'windup-missed'; lootStars: number }
  | { type: 'dead' };

export interface RaidResult {
  raid: Raid;
  events: RaidEvent[];
}

/**
 * Rolls the HP values where wind-ups start: one every 25–35% of the pile,
 * never inside the last few items, and far enough apart that they never overlap.
 */
export function planWindups(maxHp: number, rand: () => number = Math.random): number[] {
  if (maxHp < WINDUP_MIN_MAX_HP) return [];
  const at: number[] = [];
  let hp = maxHp;
  for (;;) {
    const spacing = WINDUP_SPACING_MIN + rand() * (WINDUP_SPACING_MAX - WINDUP_SPACING_MIN);
    const step = Math.max(WINDUP_MAX_TARGET + 1, Math.round(maxHp * spacing));
    hp -= step;
    if (hp <= WINDUP_LAST_ITEMS) break;
    at.push(hp);
  }
  return at;
}

export function createRaid(
  id: string,
  bossId: string,
  maxHp: number,
  now: number,
  rand: () => number = Math.random,
): Raid {
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
    windupAtHp: planWindups(maxHp, rand),
  };
}

/** The last hit that still counts. */
export function lastLiveHit(raid: Raid) {
  for (let i = raid.hits.length - 1; i >= 0; i--) {
    if (!raid.hits[i].undone) return raid.hits[i];
  }
  return undefined;
}

export function activeWindup(raid: Raid): Windup | undefined {
  const last = raid.windups.at(-1);
  return last && last.beaten === undefined ? last : undefined;
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

function replaceLastWindup(raid: Raid, windup: Windup): Windup[] {
  return [...raid.windups.slice(0, -1), windup];
}

/**
 * Pure raid logic. HP is sacred: a HIT removes exactly one HP, an UNDO restores
 * exactly one. Combos and wind-ups only ever change score and Loot Stars.
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

      events.push({ type: 'hit', hp, multiplier, gained });
      if (multiplier > oldMultiplier) events.push({ type: 'combo-up', multiplier });

      let next: Raid = {
        ...raid,
        hp,
        streak,
        score: raid.score + gained,
        bestCombo: Math.max(raid.bestCombo, multiplier),
        hits: [...raid.hits, { at: now, source: action.source, combo: multiplier }],
      };

      const windup = activeWindup(raid);
      if (windup && now <= windup.deadline) {
        const progress = windup.progress + 1;
        if (progress >= windup.target) {
          const bonus = WINDUP_BONUS_PER_ITEM * windup.target;
          const lootStars = Math.min(MAX_LOOT_STARS, next.lootStars + 1);
          next = {
            ...next,
            score: next.score + bonus,
            lootStars,
            windups: replaceLastWindup(raid, { ...windup, progress, beaten: true, resolvedAt: now }),
          };
          events.push({ type: 'windup-beaten', bonus, lootStars });
        } else {
          next = { ...next, windups: replaceLastWindup(raid, { ...windup, progress }) };
          events.push({ type: 'windup-progress', progress, target: windup.target });
        }
      } else if (!windup && hp > WINDUP_LAST_ITEMS && raid.windupAtHp?.includes(hp)) {
        const target = Math.min(WINDUP_MAX_TARGET, hp - 1);
        const deadline = now + WINDUP_MS_PER_ITEM * target;
        next = { ...next, windups: [...raid.windups, { startedAt: now, deadline, target, progress: 0 }] };
        events.push({ type: 'windup-start', target, deadline });
      }

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
      let windups = raid.windups;
      const windup = activeWindup(raid);
      if (windup && undoneHit.at > windup.startedAt && windup.progress > 0) {
        windups = replaceLastWindup(raid, { ...windup, progress: windup.progress - 1 });
      }
      return {
        raid: {
          ...raid,
          hits,
          hp,
          windups,
          streak: 0,
          score: Math.max(0, raid.score - SCORE_PER_HIT * undoneHit.combo),
        },
        events: [{ type: 'undo', hp }],
      };
    }

    case 'TICK': {
      let next = raid;
      const events: RaidEvent[] = [];

      const last = lastLiveHit(raid);
      if (raid.streak > 0 && last && now - last.at > COMBO_WINDOW_MS) {
        if (multiplierFor(raid.streak) > 1) events.push({ type: 'combo-break' });
        next = { ...next, streak: 0 };
      }

      const windup = activeWindup(raid);
      if (windup && now > windup.deadline) {
        const lootStars = Math.max(0, raid.lootStars - 1);
        next = {
          ...next,
          lootStars,
          windups: replaceLastWindup(raid, { ...windup, beaten: false, resolvedAt: now }),
        };
        events.push({ type: 'windup-missed', lootStars });
      }

      return { raid: next, events };
    }
  }
}
