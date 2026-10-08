import { describe, expect, it } from 'vitest';
import {
  createQuest,
  currentStep,
  enemy,
  LAIR_IDS,
  levelName,
  questReducer,
  REGIONS,
  throneUnlocked,
  XP_LEVEL_CLEAR,
  XP_QUEST_CLEAR,
  type QuestAction,
} from './campaign';
import { dailyBounty, heroLevel, levelProgress, touchStreak, xpForLevel } from './progression';
import type { Quest } from './types';

function play(q: Quest, until: (q: Quest) => boolean) {
  let quest = q;
  const events: string[] = [];
  let t = 0;
  for (let guard = 0; guard < 200 && !until(quest); guard++) {
    const step = currentStep(quest);
    let action: QuestAction;
    if (step.kind === 'fight') {
      if (!quest.raidId) action = { type: 'START_FIGHT', raidId: `raid-${guard}` };
      else action = { type: 'WIN_FIGHT', items: 5, boss: step.enemyId === 'laundry' };
    } else if (step.kind === 'timer' && !quest.timerEndsAt) {
      action = { type: 'START_TIMER', minutes: 45 };
    } else {
      action = { type: 'COMPLETE_STEP' };
    }
    const res = questReducer(quest, action, (t += 1000));
    quest = res.quest;
    events.push(...res.events.map((e) => e.type));
  }
  return { quest, events };
}

describe('campaign quests', () => {
  it('walks every step of every load, and the boss only appears on the last load', () => {
    const q = createQuest('q', 'laundry', 3, [], 0);
    const enemies: string[] = [];
    let quest = q;
    const res = play(quest, (x) => {
      if (x.status === 'active') enemies.push(`${x.level}:${currentStep(x).enemyId}`);
      return x.status !== 'active';
    });
    quest = res.quest;
    expect(quest.status).toBe('won');
    expect(res.events.filter((e) => e === 'level-clear')).toHaveLength(3);
    expect(res.events.filter((e) => e === 'quest-clear')).toHaveLength(1);
    expect(enemies.some((e) => e.startsWith('0:laundry'))).toBe(false);
    expect(enemies.some((e) => e.startsWith('2:laundry'))).toBe(true);
    expect(quest.items).toBe(15);
    expect(quest.bossRaidId).toBeDefined();
  });

  it('fight steps cannot be skipped with COMPLETE_STEP', () => {
    let quest = createQuest('q', 'dishes', 1, [], 0);
    quest = play(quest, (x) => currentStep(x).kind === 'fight').quest;
    const res = questReducer(quest, { type: 'COMPLETE_STEP' }, 1);
    expect(res.quest).toBe(quest);
  });

  it('timers record when the cycle ends and clear when the step completes', () => {
    let quest = createQuest('q', 'laundry', 1, [], 0);
    quest = play(quest, (x) => currentStep(x).kind === 'timer').quest;
    quest = questReducer(quest, { type: 'START_TIMER', minutes: 45 }, 1000).quest;
    expect(quest.timerEndsAt).toBe(1000 + 45 * 60_000);
    quest = questReducer(quest, { type: 'COMPLETE_STEP' }, 2000).quest;
    expect(quest.timerEndsAt).toBeUndefined();
  });

  it('awards level and quest clear bonuses', () => {
    const { quest } = play(createQuest('q', 'clutter', 1, ['Bedroom'], 0), (x) => x.status !== 'active');
    const stepXp = REGIONS.find((r) => r.id === 'clutter')!.steps(true).reduce((a, s) => a + s.xp, 0);
    // play() wins every fight with 5 items; it only flags laundry fights as boss fights.
    expect(quest.xp).toBe(stepXp + 5 * 10 + 40 + XP_LEVEL_CLEAR + XP_QUEST_CLEAR);
  });

  it('names levels by room or number', () => {
    expect(levelName({ region: 'clutter', levels: 2, levelNames: ['Bedroom', 'Office'] }, 1)).toBe('Office');
    expect(levelName({ region: 'laundry', levels: 3, levelNames: [] }, 0)).toBe('Load 1 of 3');
    expect(levelName({ region: 'dishes', levels: 1, levelNames: [] }, 0)).toBe('Sinkful');
  });

  it('every region has a counted fight and ends on a finisher, with its boss on the last level', () => {
    for (const r of REGIONS) {
      for (const boss of [false, true]) {
        const steps = r.steps(boss);
        const fights = steps.filter((s) => s.kind === 'fight');
        expect(fights.length, r.id).toBeGreaterThan(0);
        for (const f of fights) expect(f.countPrompt, r.id).toBeTruthy();
        expect(steps.at(-1)!.finisher, r.id).toBe(true);
        expect(steps.filter((s) => s.finisher)).toHaveLength(1);
        if (boss) expect(fights.some((f) => f.enemyId === r.bossId), r.id).toBe(true);
        else if (r.id !== 'throne') expect(steps.every((s) => s.enemyId === r.minionId), r.id).toBe(true);
      }
      expect(enemy(r.bossId).id, r.id).toBe(r.bossId);
      expect(enemy(r.minionId).id, r.id).toBe(r.minionId);
      if (r.namedLevels) expect(r.levelPresets!.length, r.id).toBeGreaterThanOrEqual(r.maxLevels);
    }
  });

  it('every lair can be won from start to finish', () => {
    for (const id of LAIR_IDS) {
      const { quest } = play(createQuest('q', id, 2, [], 0), (x) => x.status !== 'active');
      expect(quest.status, id).toBe('won');
    }
  });

  it('opens the throne only once all seven lairs have fallen', () => {
    expect(LAIR_IDS).toHaveLength(7);
    expect(throneUnlocked(['laundry', 'dishes', 'clutter'])).toBe(false);
    expect(throneUnlocked(LAIR_IDS.slice(0, 6))).toBe(false);
    expect(throneUnlocked([...LAIR_IDS])).toBe(true);
  });

  it('clamps the number of levels', () => {
    expect(createQuest('q', 'laundry', 99, [], 0).levels).toBe(6);
    expect(createQuest('q', 'laundry', 0, [], 0).levels).toBe(1);
  });
});

describe('progression', () => {
  it('levels up on a growing curve', () => {
    expect(heroLevel(0)).toBe(1);
    expect(heroLevel(xpForLevel(2))).toBe(2);
    expect(heroLevel(xpForLevel(5) - 1)).toBe(4);
    const p = levelProgress(xpForLevel(3) + 10);
    expect(p.level).toBe(3);
    expect(p.into).toBe(10);
  });

  it('grows the streak on consecutive days and resets after a gap', () => {
    const day = (d: number) => new Date(2026, 9, d, 12).getTime();
    let s = touchStreak({ days: 0, lastDate: '' }, day(5));
    expect(s.days).toBe(1);
    s = touchStreak(s, day(5));
    expect(s.days).toBe(1);
    s = touchStreak(s, day(6));
    expect(s.days).toBe(2);
    s = touchStreak(s, day(9));
    expect(s.days).toBe(1);
  });

  it('rotates the daily bounty through the lairs', () => {
    const seen = new Set([0, 1, 2].map((d) => dailyBounty(new Date(2026, 9, 5 + d, 12).getTime())));
    expect(seen.size).toBe(3);
  });
});
