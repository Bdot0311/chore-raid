import type { BossDef } from '../game/types';
import type { CreatureId } from './creature';

/**
 * Who plays whom: the hero classes the player picks from, and the 3D model,
 * size, gear and colors behind every enemy in the game.
 */

export type HeroClass = 'Knight' | 'Barbarian' | 'Mage' | 'Rogue' | 'Rogue_Hooded';

export interface HeroDef {
  id: HeroClass;
  label: string;
  blurb: string;
  /** Props the model ships with, and which of them this hero carries. */
  props: string[];
  carry: string[];
  idle: string;
  /** Cycled through on every hit. */
  attacks: string[];
  /** Big moves: combo specials, parries and the finisher. */
  special: string;
  finisher: string;
  /** Casts at range instead of running in. */
  ranged?: boolean;
}

const ONE_HAND = ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab'];
const DUAL = ['Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Stab'];
const ROGUE_PROPS = ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'];

export const HEROES: HeroDef[] = [
  {
    id: 'Knight',
    label: 'Knight',
    blurb: 'Sword and shield. Never late for a chore.',
    props: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword'],
    carry: ['1H_Sword', 'Round_Shield'],
    idle: 'Idle_Combat',
    attacks: ONE_HAND,
    special: '2H_Melee_Attack_Spin',
    finisher: '1H_Melee_Attack_Jump_Chop',
  },
  {
    id: 'Barbarian',
    label: 'Barbarian',
    blurb: 'Two axes, zero patience for mess.',
    props: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug'],
    carry: ['1H_Axe', '1H_Axe_Offhand'],
    idle: 'Idle_Combat',
    attacks: DUAL,
    special: '2H_Melee_Attack_Spin',
    finisher: '1H_Melee_Attack_Jump_Chop',
  },
  {
    id: 'Mage',
    label: 'Mage',
    blurb: 'Tidies from a safe distance. With lightning.',
    props: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'],
    carry: ['2H_Staff'],
    idle: 'Idle_Combat',
    attacks: ['Spellcast_Shoot'],
    special: 'Spellcast_Long',
    finisher: 'Spellcast_Long',
    ranged: true,
  },
  {
    id: 'Rogue',
    label: 'Rogue',
    blurb: 'Quick hands. Folds faster than anyone.',
    props: ROGUE_PROPS,
    carry: ['Knife', 'Knife_Offhand'],
    idle: 'Idle_Combat',
    attacks: DUAL,
    special: '2H_Melee_Attack_Spin',
    finisher: '1H_Melee_Attack_Jump_Chop',
  },
  {
    id: 'Rogue_Hooded',
    label: 'Ranger',
    blurb: 'Hood up, socks matched, no questions.',
    props: ROGUE_PROPS,
    carry: ['Knife', 'Knife_Offhand'],
    idle: 'Idle_Combat',
    attacks: DUAL,
    special: '2H_Melee_Attack_Spin',
    finisher: '1H_Melee_Attack_Jump_Chop',
  },
];

export const hero = (id: string | undefined) => HEROES.find((h) => h.id === id) ?? HEROES[0];

export type LairId = 'laundry' | 'dishes' | 'clutter' | 'bathroom' | 'bedroom' | 'floors' | 'trash' | 'throne';

export interface EnemyDef {
  model: string;
  size: number;
  /** Props from public/models/env, put in the right and left hands. */
  weapon?: string;
  offhand?: string;
  /** Dyes (part name → color) and glowing parts. */
  tints: [string, number][];
  glows: [string, number][];
  attack: string;
  boss: boolean;
  /** Pieces that break off as the boss loses HP, in order. */
  breaks: string[];
  lair: LairId;
  /** Particle colors when struck. */
  material: number[];
  /** The monster's body (creature.ts); without one, a KayKit skeleton model. */
  creature?: CreatureId;
}

const ENEMIES: Record<string, EnemyDef> = {
  'sock-goblin': {
    model: 'sock',
    creature: 'sock',
    size: 1,
    tints: [],
    glows: [],
    attack: '1H_Melee_Attack_Stab',
    boss: false,
    breaks: [],
    lair: 'laundry',
    material: [0xd94f8a, 0xfff1f7, 0x7a3fb0, 0xff7eb6],
  },
  'grease-gremlin': {
    model: 'grease',
    creature: 'grease',
    size: 1,
    tints: [],
    glows: [],
    attack: '1H_Melee_Attack_Stab',
    boss: false,
    breaks: [],
    lair: 'dishes',
    material: [0xc9a227, 0xffe08a, 0x8a6a10, 0xffffff],
  },
  'dust-bunny': {
    model: 'dust',
    creature: 'dust',
    size: 1,
    tints: [],
    glows: [],
    attack: '1H_Melee_Attack_Chop',
    boss: false,
    breaks: [],
    lair: 'clutter',
    material: [0xa8a29e, 0xd6d3d1, 0x78716c, 0xf0b8c0],
  },
  'scum-slug': {
    model: 'slug',
    creature: 'slug',
    size: 1,
    tints: [],
    glows: [],
    attack: '1H_Melee_Attack_Chop',
    boss: false,
    breaks: [],
    lair: 'bathroom',
    material: [0x5eead4, 0x99f6e4, 0x0f766e, 0xfacc15],
  },
  'pillow-imp': {
    model: 'pillow',
    creature: 'pillow',
    size: 1,
    tints: [],
    glows: [],
    attack: '1H_Melee_Attack_Stab',
    boss: false,
    breaks: [],
    lair: 'bedroom',
    material: [0xffffff, 0xf1f5f9, 0xef4444, 0xe2e8f0],
  },
  'crumb-crawler': {
    model: 'crumb',
    creature: 'crumb',
    size: 1,
    tints: [],
    glows: [],
    attack: '1H_Melee_Attack_Chop',
    boss: false,
    breaks: [],
    lair: 'floors',
    material: [0xc68a4a, 0x3b2414, 0xe0b07a, 0x8a5a2b],
  },
  'bin-rat': {
    model: 'rat',
    creature: 'rat',
    size: 1,
    tints: [],
    glows: [],
    attack: '1H_Melee_Attack_Stab',
    boss: false,
    breaks: [],
    lair: 'trash',
    material: [0x6b6561, 0xf9a8d4, 0xb0b8bf, 0x4a4a4a],
  },
  'laundry': {
    model: 'lich',
    creature: 'lich',
    size: 1.7,
    tints: [],
    glows: [],
    attack: 'Spellcast_Shoot',
    boss: true,
    breaks: ['hatsock', 'hat'],
    lair: 'laundry',
    material: [0xe9e3ff, 0xc084fc, 0x7a3fb0, 0xff7eb6, 0x60a5fa, 0xfacc15],
  },
  'dishes': {
    model: 'warlord',
    creature: 'warlord',
    size: 1.5,
    tints: [],
    glows: [],
    attack: '2H_Melee_Attack_Chop',
    boss: true,
    breaks: ['offhand', 'lid'],
    lair: 'dishes',
    material: [0xe9f6ff, 0x8fd3e8, 0x3aa7c9, 0xffffff, 0xc9d3d9],
  },
  'clutter': {
    model: 'colossus',
    creature: 'colossus',
    size: 1.45,
    tints: [],
    glows: [],
    attack: '2H_Melee_Attack_Chop',
    boss: true,
    breaks: ['offhand', 'bucket', 'backbox'],
    lair: 'clutter',
    material: [0xc49a5c, 0x8a5a2b, 0x1d4ed8, 0xb91c1c, 0xe8d9a8],
  },
  'bathroom': {
    model: 'kraken',
    creature: 'kraken',
    size: 1.5,
    tints: [],
    glows: [],
    attack: '2H_Melee_Attack_Chop',
    boss: true,
    breaks: ['offhand'],
    lair: 'bathroom',
    material: [0x2f8f83, 0x5eead4, 0xccfbf1, 0x134e48],
  },
  'bedroom': {
    model: 'dragon',
    creature: 'dragon',
    size: 1.5,
    tints: [],
    glows: [],
    attack: '2H_Melee_Attack_Chop',
    boss: true,
    breaks: ['nightcap'],
    lair: 'bedroom',
    material: [0x4f6bd8, 0xf1f5ff, 0x7b8ff0, 0xffffff],
  },
  'floors': {
    model: 'devil',
    creature: 'devil',
    size: 1.5,
    tints: [],
    glows: [],
    attack: '2H_Melee_Attack_Chop',
    boss: true,
    breaks: [],
    lair: 'floors',
    material: [0x9c9488, 0xb8ab98, 0x6b6359, 0xfde047],
  },
  'trash': {
    model: 'troll',
    creature: 'troll',
    size: 1.5,
    tints: [],
    glows: [],
    attack: '2H_Melee_Attack_Chop',
    boss: true,
    breaks: ['offhand'],
    lair: 'trash',
    material: [0x6b7f8a, 0x5d7a3a, 0xa3e635, 0x1a1206],
  },
  'king': {
    model: 'king',
    creature: 'king',
    size: 1.7,
    tints: [],
    glows: [],
    attack: '2H_Melee_Attack_Chop',
    boss: true,
    breaks: ['junk0', 'junk2', 'junk4', 'crown'],
    lair: 'throne',
    material: [0x84cc16, 0x5f8f1e, 0x8a6a3a, 0xffc94d, 0x4a4a4a],
  },
  custom: {
    model: 'colossus',
    creature: 'colossus',
    size: 1.4,
    tints: [],
    glows: [],
    attack: '2H_Melee_Attack_Chop',
    boss: true,
    breaks: ['offhand', 'bucket'],
    lair: 'clutter',
    material: [0xc49a5c, 0x8a5a2b, 0x1d4ed8, 0xe8d9a8],
  },
};

export const ENEMY_KEYS = Object.keys(ENEMIES);
export const enemyByKey = (key: string) => ENEMIES[key];

/** Which portrait image stands for a boss in menus (public/art/portraits). */
export function portraitKey(boss: BossDef) {
  const key = boss.art ?? boss.kind;
  return ENEMIES[key] ? key : ENEMIES[boss.kind] ? boss.kind : 'custom';
}

export function enemyFor(boss: BossDef): EnemyDef {
  return ENEMIES[boss.art ?? boss.kind] ?? ENEMIES[boss.kind] ?? ENEMIES.custom;
}
