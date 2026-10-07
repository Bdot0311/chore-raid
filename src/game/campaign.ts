import type { BossDef, Quest, RegionId } from './types';
import { BUILT_IN_BOSSES } from './bosses';

/**
 * The campaign: the Mess King has taken over the home, and each chore is a
 * region to win back. A region is played as a quest of levels (one per laundry
 * load, sinkful or room), and every level walks through the real steps of the
 * chore. Quick steps are minion skirmishes, machine cycles are timers, and the
 * counting step is a fight where one finished item is one hit.
 */

export type StepKind = 'task' | 'timer' | 'fight';

export interface StepDef {
  id: string;
  kind: StepKind;
  title: string;
  instruction: string;
  /** Boss or minion on screen during this step. */
  enemyId: string;
  xp: number;
  /** Timers: the default cycle length the player can adjust. */
  minutes?: number;
  /** Fights: what the player is asked to count. */
  countPrompt?: string;
  /** The last step of a level: the finishing blow. */
  finisher?: boolean;
}

export interface RegionDef {
  id: RegionId;
  name: string;
  chore: string;
  hue: number;
  bossId: string;
  minionId: string;
  /** What one level is: "load", "sinkful", "room". */
  levelNoun: string;
  levelNounPlural: string;
  levelsPrompt: string;
  defaultLevels: number;
  maxLevels: number;
  /** Rooms have names; loads and sinkfuls are numbered. */
  namedLevels: boolean;
  /** Spoken when the player first enters the region. */
  intro: string;
  arena: string;
  steps(isBossLevel: boolean): StepDef[];
}

// ------------------------------------------------------------------ enemies

/** Minions and the Mess King, alongside the three built-in bosses. */
export const CAMPAIGN_ENEMIES: BossDef[] = [
  {
    id: 'sock-goblin',
    kind: 'laundry',
    art: 'sock-goblin',
    name: 'The Sock Goblins',
    chore: 'Laundry',
    unit: 'item',
    unitPlural: 'items',
    countPrompt: 'How many items in this load?',
    hue: 280,
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'grease-gremlin',
    kind: 'dishes',
    art: 'grease-gremlin',
    name: 'The Grease Gremlins',
    chore: 'Dishes',
    unit: 'dish',
    unitPlural: 'dishes',
    countPrompt: 'How many dishes?',
    hue: 190,
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'dust-bunny',
    kind: 'clutter',
    art: 'dust-bunny',
    name: 'The Dust Bunny Brute',
    chore: 'Tidying',
    unit: 'thing',
    unitPlural: 'things',
    countPrompt: 'How many things are out of place?',
    hue: 30,
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'mess-king',
    kind: 'king',
    art: 'mess-king',
    name: 'The Mess King',
    chore: 'Reset the whole home',
    unit: 'thing',
    unitPlural: 'things',
    countPrompt: 'Set a goal: how many things will you put right?',
    hue: 285,
    createdAt: 0,
    builtIn: true,
  },
];

const ALL_ENEMIES = [...BUILT_IN_BOSSES, ...CAMPAIGN_ENEMIES];

export function enemy(id: string): BossDef {
  return ALL_ENEMIES.find((b) => b.id === id) ?? BUILT_IN_BOSSES[0];
}

// ------------------------------------------------------------------ regions

export const REGIONS: RegionDef[] = [
  {
    id: 'laundry',
    name: 'The Laundry Lair',
    chore: 'Laundry day',
    hue: 265,
    bossId: 'laundry',
    minionId: 'sock-goblin',
    levelNoun: 'load',
    levelNounPlural: 'loads',
    levelsPrompt: 'How many loads today?',
    defaultLevels: 2,
    maxLevels: 6,
    namedLevels: false,
    intro:
      'The Laundry Lair. The Sock Goblins guard every load, and the Laundry Leviathan waits in the last one. It has been waiting a while. It is fine with that.',
    arena: '/art/arena-laundry.webp',
    steps: (boss) => [
      {
        id: 'gather',
        kind: 'task',
        title: 'Gather the load',
        instruction: 'Grab everything for this load and bring it to the washer. Check under the bed. The goblins hide socks there.',
        enemyId: 'sock-goblin',
        xp: 20,
      },
      {
        id: 'sort',
        kind: 'task',
        title: 'Sort it',
        instruction: 'Lights in one pile, darks in another, anything delicate on its own. Empty the pockets.',
        enemyId: 'sock-goblin',
        xp: 20,
      },
      {
        id: 'wash',
        kind: 'timer',
        title: 'Start the washer',
        instruction: 'Load it, add detergent, press start. Then start the timer here and go do something else.',
        enemyId: boss ? 'laundry' : 'sock-goblin',
        minutes: 45,
        xp: 15,
      },
      {
        id: 'dry',
        kind: 'timer',
        title: 'Into the dryer',
        instruction: 'Move it all to the dryer. Hang anything that should not be dried. Start the timer.',
        enemyId: boss ? 'laundry' : 'sock-goblin',
        minutes: 50,
        xp: 15,
      },
      {
        id: 'fold',
        kind: 'fight',
        title: boss ? 'BOSS: Fold the Leviathan' : 'Fold it',
        instruction: 'Fold one item, land one hit. Count the load first.',
        enemyId: boss ? 'laundry' : 'sock-goblin',
        countPrompt: 'How many items in this load?',
        xp: 0,
      },
      {
        id: 'putaway',
        kind: 'task',
        title: 'Put it all away',
        instruction: 'Every folded item goes back where it lives. Drawers, hangers, the lot.',
        enemyId: boss ? 'laundry' : 'sock-goblin',
        xp: 30,
        finisher: true,
      },
    ],
  },
  {
    id: 'dishes',
    name: 'The Sink Caverns',
    chore: 'Dishes',
    hue: 190,
    bossId: 'dishes',
    minionId: 'grease-gremlin',
    levelNoun: 'sinkful',
    levelNounPlural: 'sinkfuls',
    levelsPrompt: 'How many sinkfuls of dishes?',
    defaultLevels: 1,
    maxLevels: 4,
    namedLevels: false,
    intro:
      'The Sink Caverns. Grease Gremlins guard the counters, and the Sink Hydra lurks under the suds. It has three heads and no manners.',
    arena: '/art/arena-dishes.webp',
    steps: (boss) => [
      {
        id: 'clear',
        kind: 'task',
        title: 'Clear the table',
        instruction: 'Bring every plate, cup and pan to the sink. Do not forget the mug by the couch.',
        enemyId: 'grease-gremlin',
        xp: 20,
      },
      {
        id: 'scrape',
        kind: 'task',
        title: 'Scrape and rinse',
        instruction: 'Scrape the leftovers into the bin and give everything a quick rinse. Run the water hot.',
        enemyId: 'grease-gremlin',
        xp: 20,
      },
      {
        id: 'wash',
        kind: 'fight',
        title: boss ? 'BOSS: Wash the Hydra' : 'Wash up',
        instruction: 'Wash one dish (or load it in the dishwasher), land one hit.',
        enemyId: boss ? 'dishes' : 'grease-gremlin',
        countPrompt: 'How many dishes?',
        xp: 0,
      },
      {
        id: 'dry',
        kind: 'task',
        title: 'Dry and put away',
        instruction: 'Dry what is clean and put it back in the cupboards. Running the dishwasher? Start it and tap done.',
        enemyId: boss ? 'dishes' : 'grease-gremlin',
        xp: 25,
      },
      {
        id: 'wipe',
        kind: 'task',
        title: 'Wipe the counters',
        instruction: 'Wipe the counters and the sink. Wring out the sponge. Victory smells like lemon.',
        enemyId: boss ? 'dishes' : 'grease-gremlin',
        xp: 25,
        finisher: true,
      },
    ],
  },
  {
    id: 'clutter',
    name: 'The Clutter Keep',
    chore: 'Tidy up',
    hue: 30,
    bossId: 'clutter',
    minionId: 'dust-bunny',
    levelNoun: 'room',
    levelNounPlural: 'rooms',
    levelsPrompt: 'Which rooms are we taking back?',
    defaultLevels: 2,
    maxLevels: 6,
    namedLevels: true,
    intro:
      'The Clutter Keep. Every room is held by a Dust Bunny Brute, and the Clutter Golem guards the last one. It is mostly cables.',
    arena: '/art/arena-clutter.webp',
    steps: (boss) => [
      {
        id: 'gear',
        kind: 'task',
        title: 'Grab your gear',
        instruction: 'Grab a bag for trash and a basket for things that live in other rooms.',
        enemyId: 'dust-bunny',
        xp: 15,
      },
      {
        id: 'trash',
        kind: 'task',
        title: 'Trash run',
        instruction: 'Bin everything that is trash: wrappers, receipts, the dried-out pen. Be ruthless.',
        enemyId: 'dust-bunny',
        xp: 25,
      },
      {
        id: 'putaway',
        kind: 'fight',
        title: boss ? 'BOSS: Dismantle the Golem' : 'Put things back',
        instruction: 'Put one thing back where it lives, land one hit.',
        enemyId: boss ? 'clutter' : 'dust-bunny',
        countPrompt: 'How many things are out of place?',
        xp: 0,
      },
      {
        id: 'surfaces',
        kind: 'task',
        title: 'Clear the surfaces',
        instruction: 'Clear the tables and shelves, straighten what is left, and take the basket where it goes.',
        enemyId: boss ? 'clutter' : 'dust-bunny',
        xp: 30,
        finisher: true,
      },
    ],
  },
  {
    id: 'throne',
    name: "The Mess King's Throne",
    chore: 'Reset the whole home',
    hue: 285,
    bossId: 'mess-king',
    minionId: 'mess-king',
    levelNoun: 'battle',
    levelNounPlural: 'battles',
    levelsPrompt: '',
    defaultLevels: 1,
    maxLevels: 1,
    namedLevels: false,
    intro:
      'The throne room. The Mess King sits on a pile of everything you ever meant to put away. He is not getting up. You will have to make him.',
    arena: '/art/arena-throne.webp',
    steps: () => [
      {
        id: 'laundry',
        kind: 'task',
        title: 'Sweep the Laundry Lair',
        instruction: 'Any clothes on the floor or the chair? Into the basket.',
        enemyId: 'mess-king',
        xp: 25,
      },
      {
        id: 'sink',
        kind: 'task',
        title: 'Check the Sink Caverns',
        instruction: 'Any dishes hiding in the sink? Wash them or load them.',
        enemyId: 'mess-king',
        xp: 25,
      },
      {
        id: 'reset',
        kind: 'fight',
        title: 'FINAL BOSS: The Mess King',
        instruction: 'Ten-minute reset: put one thing right anywhere in the home, land one hit.',
        enemyId: 'mess-king',
        countPrompt: 'Set a goal: how many things will you put right?',
        xp: 0,
      },
      {
        id: 'crown',
        kind: 'task',
        title: 'Take the crown',
        instruction: 'Look around. Take a breath. This is your home again.',
        enemyId: 'mess-king',
        xp: 100,
        finisher: true,
      },
    ],
  },
];

export function region(id: RegionId): RegionDef {
  return REGIONS.find((r) => r.id === id)!;
}

/** The throne opens once all three bosses have fallen. */
export function throneUnlocked(cleared: string[]) {
  return (['laundry', 'dishes', 'clutter'] as const).every((r) => cleared.includes(r));
}

export function levelName(quest: Pick<Quest, 'region' | 'levels' | 'levelNames'>, level: number) {
  const r = region(quest.region);
  if (r.namedLevels && quest.levelNames[level]) return quest.levelNames[level];
  if (quest.levels === 1) return r.levelNoun.replace(/^\w/, (c) => c.toUpperCase());
  return `${r.levelNoun.replace(/^\w/, (c) => c.toUpperCase())} ${level + 1} of ${quest.levels}`;
}

export function isBossLevel(quest: Pick<Quest, 'levels'>, level: number) {
  return level === quest.levels - 1;
}

export function currentStep(quest: Quest): StepDef {
  return region(quest.region).steps(isBossLevel(quest, quest.level))[quest.step];
}

export function stepsFor(quest: Quest, level = quest.level) {
  return region(quest.region).steps(isBossLevel(quest, level));
}

// ------------------------------------------------------------------ quest logic

export const XP_PER_ITEM = 10;
export const XP_MINION_FIGHT = 40;
export const XP_BOSS_FIGHT = 150;
export const XP_LEVEL_CLEAR = 75;
export const XP_QUEST_CLEAR = 200;

export type QuestAction =
  | { type: 'COMPLETE_STEP' }
  | { type: 'START_TIMER'; minutes: number }
  | { type: 'START_FIGHT'; raidId: string }
  | { type: 'WIN_FIGHT'; items: number; boss: boolean };

export type QuestEvent =
  | { type: 'step-done'; xp: number; step: StepDef }
  | { type: 'level-clear'; level: number; xp: number }
  | { type: 'quest-clear'; xp: number };

export function createQuest(id: string, regionId: RegionId, levels: number, levelNames: string[], now: number): Quest {
  const r = region(regionId);
  const n = Math.max(1, Math.min(r.maxLevels, Math.round(levels)));
  return {
    id,
    region: regionId,
    levels: n,
    levelNames: levelNames.slice(0, n),
    level: 0,
    step: 0,
    status: 'active',
    startedAt: now,
    xp: 0,
    items: 0,
  };
}

/**
 * Pure quest progression. Steps only ever advance forward; a fight step only
 * completes when its fight is won (the boss dies exactly when the chore is done).
 */
export function questReducer(quest: Quest, action: QuestAction, now: number): { quest: Quest; events: QuestEvent[] } {
  if (quest.status !== 'active') return { quest, events: [] };
  const step = currentStep(quest);

  switch (action.type) {
    case 'START_TIMER':
      if (step.kind !== 'timer') return { quest, events: [] };
      return {
        quest: { ...quest, timerEndsAt: now + Math.max(1, action.minutes) * 60_000, timerMinutes: action.minutes },
        events: [],
      };

    case 'START_FIGHT':
      if (step.kind !== 'fight') return { quest, events: [] };
      return { quest: { ...quest, raidId: action.raidId }, events: [] };

    case 'WIN_FIGHT': {
      if (step.kind !== 'fight') return { quest, events: [] };
      const xp = action.items * XP_PER_ITEM + (action.boss ? XP_BOSS_FIGHT : XP_MINION_FIGHT);
      const bossRaidId = action.boss ? quest.raidId : quest.bossRaidId;
      return advance({ ...quest, items: quest.items + action.items, bossRaidId }, { ...step, xp }, now);
    }

    case 'COMPLETE_STEP':
      // Fights complete through WIN_FIGHT only.
      if (step.kind === 'fight') return { quest, events: [] };
      return advance(quest, step, now);
  }
}

function advance(quest: Quest, step: StepDef, now: number): { quest: Quest; events: QuestEvent[] } {
  const events: QuestEvent[] = [{ type: 'step-done', xp: step.xp, step }];
  let xp = quest.xp + step.xp;
  const steps = stepsFor(quest);
  let next: Quest = { ...quest, timerEndsAt: undefined, timerMinutes: undefined, raidId: undefined };

  if (quest.step + 1 < steps.length) {
    next = { ...next, step: quest.step + 1 };
  } else {
    xp += XP_LEVEL_CLEAR;
    events.push({ type: 'level-clear', level: quest.level, xp: XP_LEVEL_CLEAR });
    if (quest.level + 1 < quest.levels) {
      next = { ...next, level: quest.level + 1, step: 0 };
    } else {
      xp += XP_QUEST_CLEAR;
      events.push({ type: 'quest-clear', xp: XP_QUEST_CLEAR });
      next = { ...next, status: 'won', endedAt: now };
    }
  }
  return { quest: { ...next, xp }, events };
}
