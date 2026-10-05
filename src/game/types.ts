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

export interface Windup {
  startedAt: number;
  target: number;
  beaten: boolean;
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
