export type BossKind = 'laundry' | 'dishes' | 'clutter' | 'custom';

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
}
