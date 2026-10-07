import type { Duel } from './duel';

export type BossKind = 'laundry' | 'dishes' | 'clutter' | 'king' | 'custom';

export interface BossDef {
  id: string;
  kind: BossKind;
  name: string;
  chore: string;
  /** Singular unit word used in speech and UI: "12 dishes left". */
  unit: string;
  unitPlural: string;
  countPrompt: string;
  hue: number;
  createdAt: number;
  builtIn: boolean;
  /** Art key when it differs from the kind (minions share their region's kind). */
  art?: string;
}

export type RaidStatus = 'active' | 'won' | 'abandoned';

export type HitSource = 'tap' | 'voice' | 'key';

export interface Hit {
  at: number;
  source: HitSource;
  /** Combo multiplier at the moment of the hit. */
  combo: number;
  /** Soft undo keeps the history honest. */
  undone?: boolean;
}

/** A boss wind-up: finish `target` items before `deadline` or the boss heals its Ward. */
export interface Windup {
  startedAt: number;
  deadline: number;
  target: number;
  progress: number;
  /** Undefined while the wind-up is still running. */
  beaten?: boolean;
  resolvedAt?: number;
}

export interface Raid {
  id: string;
  bossId: string;
  maxHp: number;
  hp: number;
  status: RaidStatus;
  startedAt: number;
  endedAt?: number;
  hits: Hit[];
  score: number;
  /** Consecutive hits inside the combo window. */
  streak: number;
  bestCombo: number;
  lootStars: number;
  windups: Windup[];
  /** HP values at which a wind-up starts, rolled when the raid begins. */
  windupAtHp: number[];
  beforePhotoId?: string;
  afterPhotoId?: string;
  lootId?: string;
  /** Set when the raid is a fight inside a campaign quest. */
  questId?: string;
  /** The enemy fighting back: the hero's health and the enemy's rhythm. */
  duel?: Duel;
}

export interface Photo {
  id: string;
  raidId: string;
  blob: Blob;
  w: number;
  h: number;
  takenAt: number;
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface LootItem {
  id: string;
  type: 'trophy' | 'skin';
  name: string;
  rarity: Rarity;
  bossKind: BossKind;
  earnedAt: number;
  raidId: string;
}

export interface Settings {
  muted: boolean;
  voiceHits: boolean;
  speech: boolean;
  volume: number;
}

export interface Profile {
  totalItems: number;
  raidsWon: number;
  equippedSkin: string;
  settings: Settings;
  /** Campaign progression. */
  heroName: string;
  /** Which hero model the player chose (src/world/cast.ts). */
  heroClass: string;
  storySeen: boolean;
  xp: number;
  /** Region ids whose boss has been defeated in the campaign. */
  regionsCleared: string[];
  streak: { days: number; lastDate: string };
}

export type RegionId = 'laundry' | 'dishes' | 'clutter' | 'throne';

export type QuestStatus = 'active' | 'won' | 'abandoned';

/** One campaign run of a region: a sequence of levels, each a list of real chore steps. */
export interface Quest {
  id: string;
  region: RegionId;
  levels: number;
  levelNames: string[];
  level: number;
  step: number;
  status: QuestStatus;
  startedAt: number;
  endedAt?: number;
  /** Set while a machine cycle (washer, dryer) is running. */
  timerEndsAt?: number;
  timerMinutes?: number;
  /** The fight for the current step, once it has started. */
  raidId?: string;
  /** The boss fight of the final level, for the victory screen and loot. */
  bossRaidId?: string;
  xp: number;
  /** Items finished across all fights in this quest. */
  items: number;
  /** The hero's health, carried from step to step within a level. */
  duel?: Duel;
}
