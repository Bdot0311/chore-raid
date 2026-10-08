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
  /** Named levels: the names on offer, the first `defaultLevels` picked to start. */
  levelPresets?: string[];
  /** Spoken when the player first enters the region. */
  intro: string;
  arena: string;
  steps(isBossLevel: boolean): StepDef[];
}

// ------------------------------------------------------------------ enemies

/** Minions and the Mess King, alongside the built-in bosses. */
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
    name: 'The Dust Brutes',
    chore: 'Tidying',
    unit: 'thing',
    unitPlural: 'things',
    countPrompt: 'How many things are out of place?',
    hue: 30,
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'scum-slug',
    kind: 'bathroom',
    art: 'scum-slug',
    name: 'The Scum Slugs',
    chore: 'Bathroom',
    unit: 'thing',
    unitPlural: 'things',
    countPrompt: 'How many things need a scrub?',
    hue: 150,
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'pillow-imp',
    kind: 'bedroom',
    art: 'pillow-imp',
    name: 'The Pillow Imps',
    chore: 'Bedroom',
    unit: 'item',
    unitPlural: 'items',
    countPrompt: 'How many items are out of place?',
    hue: 330,
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'crumb-crawler',
    kind: 'floors',
    art: 'crumb-crawler',
    name: 'The Crumb Crawlers',
    chore: 'Floors',
    unit: 'thing',
    unitPlural: 'things',
    countPrompt: 'How many patches of floor?',
    hue: 50,
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'bin-rat',
    kind: 'trash',
    art: 'bin-rat',
    name: 'The Bin Rats',
    chore: 'Rubbish',
    unit: 'item',
    unitPlural: 'items',
    countPrompt: 'How many items to sort?',
    hue: 95,
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
      'The Laundry Lair. The Sock Goblins guard every load, and the Laundry Lich waits in the last one. It has been waiting a while. It is fine with that.',
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
        title: boss ? 'BOSS: Fold the Lich' : 'Fold it',
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
      'The Sink Caverns. Grease Gremlins guard the counters, and the Sink Warlord lurks under the suds. It has one axe and no manners.',
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
        title: boss ? 'BOSS: Wash the Warlord' : 'Wash up',
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
    levelPresets: ['Bedroom', 'Living room', 'Kitchen', 'Bathroom', 'Office', 'Kids’ room', 'Hallway', 'Garage'],
    intro:
      'The Clutter Keep. Every room is held by a Dust Brute, and the Clutter Colossus guards the last one. It is mostly cables.',
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
        title: boss ? 'BOSS: Topple the Colossus' : 'Put things back',
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
    id: 'bathroom',
    name: 'The Grime Grotto',
    chore: 'Clean the bathroom',
    hue: 150,
    bossId: 'bathroom',
    minionId: 'scum-slug',
    levelNoun: 'bathroom',
    levelNounPlural: 'bathrooms',
    levelsPrompt: 'Which bathrooms are we taking back?',
    defaultLevels: 1,
    maxLevels: 3,
    namedLevels: true,
    levelPresets: ['Main bathroom', 'En suite', 'Downstairs loo', 'Kids’ bathroom'],
    intro:
      'The Grime Grotto. The Scum Slugs cling to every tile, and the Grime Kraken lurks in the last bathroom. It lives in the plughole. It likes it there.',
    // The lair art is 3D; this painting is only the backdrop behind the menus.
    arena: '/art/arena-clutter.webp',
    steps: (boss) => [
      {
        id: 'clear',
        kind: 'task',
        title: 'Clear the decks',
        instruction: 'Bottles, toothbrushes and bath toys off the sink and the edge of the bath. Damp towels into the laundry basket.',
        enemyId: 'scum-slug',
        xp: 20,
      },
      {
        id: 'spray',
        kind: 'task',
        title: 'Spray it down',
        instruction: 'Spray cleaner on the sink, the taps, the bath or shower, and squirt some in the toilet bowl. Open a window. The slugs hate fresh air.',
        enemyId: 'scum-slug',
        xp: 20,
      },
      {
        id: 'soak',
        kind: 'timer',
        title: 'Let it soak',
        instruction: 'Leave the cleaner to loosen the grime. Start the timer here and wipe the mirror while you wait.',
        enemyId: boss ? 'bathroom' : 'scum-slug',
        minutes: 10,
        xp: 15,
      },
      {
        id: 'scrub',
        kind: 'fight',
        title: boss ? 'BOSS: Scrub the Kraken' : 'Scrub it clean',
        instruction: 'Scrub one thing and rinse it, land one hit. Sink, taps, toilet, tiles, mirror: each one counts.',
        enemyId: boss ? 'bathroom' : 'scum-slug',
        countPrompt: 'How many things need a scrub?',
        xp: 0,
      },
      {
        id: 'floor',
        kind: 'task',
        title: 'Floor and fresh towels',
        instruction: 'Wipe the floor, empty the little bin, and hang a fresh towel. Put the bottles back. Neatly, for once.',
        enemyId: boss ? 'bathroom' : 'scum-slug',
        xp: 30,
        finisher: true,
      },
    ],
  },
  {
    id: 'bedroom',
    name: 'The Duvet Den',
    chore: 'Bedroom reset',
    hue: 330,
    bossId: 'bedroom',
    minionId: 'pillow-imp',
    levelNoun: 'bedroom',
    levelNounPlural: 'bedrooms',
    levelsPrompt: 'Which bedrooms are we taking back?',
    defaultLevels: 1,
    maxLevels: 4,
    namedLevels: true,
    levelPresets: ['Main bedroom', 'Kids’ room', 'Guest room', 'Spare room'],
    intro:
      'The Duvet Den. The Pillow Imps hold every bedroom, and the Duvet Dragon sleeps in the last one. It has been asleep since Sunday. It calls this resting its eyes.',
    arena: '/art/arena-clutter.webp',
    steps: (boss) => [
      {
        id: 'air',
        kind: 'task',
        title: 'Let the light in',
        instruction: 'Curtains open, window open. The Pillow Imps do not care for daylight.',
        enemyId: 'pillow-imp',
        xp: 15,
      },
      {
        id: 'clothes',
        kind: 'task',
        title: 'Clothes off the floor',
        instruction: 'Dirty clothes into the laundry basket. Clean ones folded or hung up. The chair counts as the floor.',
        enemyId: 'pillow-imp',
        xp: 25,
      },
      {
        id: 'bed',
        kind: 'task',
        title: 'Make the bed',
        instruction: 'Straighten the sheet, shake out the duvet, plump the pillows. Changing the sheets today? Now is the time.',
        enemyId: boss ? 'bedroom' : 'pillow-imp',
        xp: 25,
      },
      {
        id: 'reset',
        kind: 'fight',
        title: boss ? 'BOSS: Tuck in the Dragon' : 'Put it all back',
        instruction: 'Put one item back where it lives, land one hit. Books, chargers, shoes, the lot.',
        enemyId: boss ? 'bedroom' : 'pillow-imp',
        countPrompt: 'How many items are out of place?',
        xp: 0,
      },
      {
        id: 'surfaces',
        kind: 'task',
        title: 'Clear the bedside table',
        instruction: 'Wipe the bedside table and the top of the dresser, and take any mugs to the kitchen. Then admire the bed. Nobody may sit on it.',
        enemyId: boss ? 'bedroom' : 'pillow-imp',
        xp: 30,
        finisher: true,
      },
    ],
  },
  {
    id: 'floors',
    name: 'The Dust Dunes',
    chore: 'Vacuum and sweep',
    hue: 50,
    bossId: 'floors',
    minionId: 'crumb-crawler',
    levelNoun: 'room',
    levelNounPlural: 'rooms',
    levelsPrompt: 'Which floors are we taking back?',
    defaultLevels: 2,
    maxLevels: 6,
    namedLevels: true,
    levelPresets: ['Kitchen', 'Living room', 'Hallway', 'Bedroom', 'Bathroom', 'Stairs', 'Dining room', 'Office'],
    intro:
      'The Dust Dunes. The Crumb Crawlers roam every room, and the Dust Devil spins in the last one. It is mostly crumbs. And a raisin.',
    arena: '/art/arena-clutter.webp',
    steps: (boss) => [
      {
        id: 'clear',
        kind: 'task',
        title: 'Clear the floor',
        instruction: 'Pick up anything on the floor that is not the floor. Shoes, toys, that cable. Chairs up on the table if they fit.',
        enemyId: 'crumb-crawler',
        xp: 20,
      },
      {
        id: 'edges',
        kind: 'task',
        title: 'Corners and edges',
        instruction: 'Sweep or vacuum the edges and corners first, where the Crumb Crawlers nest. Under the sofa too. Especially under the sofa.',
        enemyId: 'crumb-crawler',
        xp: 20,
      },
      {
        id: 'vacuum',
        kind: 'fight',
        title: boss ? 'BOSS: Vacuum the Dust Devil' : 'Vacuum it',
        instruction: 'Split the floor into patches: the rug, under the table, by the door. Clean one patch, land one hit.',
        enemyId: boss ? 'floors' : 'crumb-crawler',
        countPrompt: 'How many patches of floor?',
        xp: 0,
      },
      {
        id: 'mop',
        kind: 'task',
        title: 'Mop the sticky bits',
        instruction: 'Mop any hard floor, or at least wipe the sticky spots. All carpet? Lucky you. Carry on.',
        enemyId: boss ? 'floors' : 'crumb-crawler',
        xp: 20,
      },
      {
        id: 'empty',
        kind: 'task',
        title: 'Empty the vacuum',
        instruction: 'Empty the vacuum or the dustpan into the bin and put the chairs back down. Then walk across it in your socks.',
        enemyId: boss ? 'floors' : 'crumb-crawler',
        xp: 25,
        finisher: true,
      },
    ],
  },
  {
    id: 'trash',
    name: 'The Rubbish Rift',
    chore: 'Trash and recycling',
    hue: 95,
    bossId: 'trash',
    minionId: 'bin-rat',
    levelNoun: 'bin',
    levelNounPlural: 'bins',
    levelsPrompt: 'How many bins today?',
    defaultLevels: 2,
    maxLevels: 5,
    namedLevels: false,
    intro:
      'The Rubbish Rift. The Bin Rats guard every bin, and the Bin Troll waits at the last one. It has never once taken itself out.',
    arena: '/art/arena-clutter.webp',
    steps: (boss) => [
      {
        id: 'gather',
        kind: 'task',
        title: 'Find the bin',
        instruction: 'Bring this bin somewhere with a bit of space. Check under the desk and behind the door for strays.',
        enemyId: 'bin-rat',
        xp: 15,
      },
      {
        id: 'sort',
        kind: 'fight',
        title: boss ? 'BOSS: Sort out the Troll' : 'Sort the recycling',
        instruction: 'Put one item where it belongs, land one hit. Rinse the tins, flatten the boxes, rubbish in the bag.',
        enemyId: boss ? 'trash' : 'bin-rat',
        countPrompt: 'How many items to sort?',
        xp: 0,
      },
      {
        id: 'tie',
        kind: 'task',
        title: 'Tie it off',
        instruction: 'Pull out the full bag and tie it. If it drips, double bag it. Do not ask what dripped.',
        enemyId: boss ? 'trash' : 'bin-rat',
        xp: 20,
      },
      {
        id: 'out',
        kind: 'task',
        title: 'Out it goes',
        instruction: 'Carry the bags and the recycling out to the big bins. Lid shut, so the foxes have to work for it.',
        enemyId: boss ? 'trash' : 'bin-rat',
        xp: 25,
      },
      {
        id: 'reline',
        kind: 'task',
        title: 'Fresh bag in',
        instruction: 'Give the bin a wipe if it needs one, and put a fresh bag in. The Bin Rats hate a fresh bag.',
        enemyId: boss ? 'trash' : 'bin-rat',
        xp: 20,
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

/** Every region but the throne: the lairs the Mess King's crew hold. */
export const LAIR_IDS = REGIONS.filter((r) => r.id !== 'throne').map((r) => r.id) as Exclude<RegionId, 'throne'>[];

/** The throne first opens once every lair's boss has fallen at least once. */
export function throneUnlocked(cleared: string[]) {
  return LAIR_IDS.every((r) => cleared.includes(r));
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
