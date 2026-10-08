import type { BossDef } from '../game/types';
import type { CostumeId } from './costume';

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

export type LairId = 'laundry' | 'dishes' | 'clutter' | 'throne';

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
  /** Boss outfit built from its lair's props (costume.ts). */
  costume?: CostumeId;
}

const ENEMIES: Record<string, EnemyDef> = {
  'sock-goblin': {
    model: 'Skeleton_Minion',
    size: 1,
    weapon: 'Skeleton_Blade',
    tints: [['Skeleton_Minion_Cloak', 0xff7eb6]],
    glows: [['Skeleton_Minion_Eyes', 0xff4fa3]],
    attack: '1H_Melee_Attack_Chop',
    boss: false,
    breaks: [],
    lair: 'laundry',
    material: [0xd94f8a, 0x34428f, 0xe8e2d0, 0x7a3fb0],
  },
  'grease-gremlin': {
    model: 'Skeleton_Rogue',
    size: 1,
    weapon: 'w_dagger',
    tints: [
      ['Skeleton_Rogue_Hood', 0xc8d96a],
      ['Skeleton_Rogue_Cape', 0xc8d96a],
    ],
    glows: [['Skeleton_Rogue_Eyes', 0xd9f24a]],
    attack: '1H_Melee_Attack_Stab',
    boss: false,
    breaks: [],
    lair: 'dishes',
    material: [0xe9f6ff, 0x8fd3e8, 0xd9b44a, 0xffffff],
  },
  'dust-bunny': {
    model: 'Skeleton_Minion',
    size: 1.05,
    weapon: 'Skeleton_Axe',
    tints: [['Skeleton_Minion_Cloak', 0xb8b0a4]],
    glows: [['Skeleton_Minion_Eyes', 0xfff1c1]],
    attack: '1H_Melee_Attack_Chop',
    boss: false,
    breaks: [],
    lair: 'clutter',
    material: [0x9a9a9a, 0xc8c2b8, 0x6b6b6b, 0xe6d3a3],
  },
  laundry: {
    model: 'Skeleton_Mage',
    size: 1.9,
    weapon: 'Skeleton_Staff',
    tints: [['Skeleton_Mage_Hat', 0x9b6bff]],
    glows: [['Skeleton_Mage_Eyes', 0xc084fc]],
    attack: 'Spellcast_Shoot',
    boss: true,
    breaks: ['hatsock', 'Skeleton_Mage_Hat', 'Skeleton_Mage_Jaw'],
    lair: 'laundry',
    material: [0x34428f, 0xc23b3b, 0xe8e2d0, 0xe39b2d, 0x7a3fb0, 0x5b7f3a, 0xd94f8a],
    costume: 'lich',
  },
  dishes: {
    model: 'Skeleton_Warrior',
    size: 2,
    tints: [['Skeleton_Warrior_Cloak', 0x2f8fb0]],
    glows: [['Skeleton_Warrior_Eyes', 0x7dd3fc]],
    attack: '1H_Melee_Attack_Chop',
    boss: true,
    breaks: ['offhand', 'pothelm', 'Skeleton_Warrior_Jaw'],
    lair: 'dishes',
    material: [0xe9f6ff, 0x8fd3e8, 0x3aa7c9, 0xffffff, 0xc9a06a],
    costume: 'warlord',
  },
  clutter: {
    model: 'Skeleton_Warrior',
    size: 2.3,
    tints: [['Skeleton_Warrior_Cloak', 0x8a5a2b]],
    glows: [['Skeleton_Warrior_Eyes', 0xffb347]],
    attack: '2H_Melee_Attack_Chop',
    boss: true,
    breaks: ['offhand', 'bucket', 'backbox'],
    lair: 'clutter',
    material: [0xd98b3a, 0x8a5a2b, 0x3b5b8f, 0xc94f2f, 0xe6d3a3],
    costume: 'colossus',
  },
  king: {
    model: 'Skeleton_Mage',
    size: 2.4,
    tints: [],
    glows: [['Skeleton_Mage_Eyes', 0xff2d1a]],
    attack: '2H_Melee_Attack_Chop',
    boss: true,
    breaks: ['gut0', 'gut2', 'gut4', 'crown'],
    lair: 'throne',
    material: [0x84cc16, 0x6b7f2a, 0x8a6a3a, 0xffc94d, 0x4a4a4a],
    costume: 'king',
  },
  custom: {
    model: 'Skeleton_Warrior',
    size: 1.6,
    weapon: 'Skeleton_Blade',
    offhand: 'Skeleton_Shield_Small_A',
    tints: [['Skeleton_Warrior_Cloak', 0xa3a3a3]],
    glows: [['Skeleton_Warrior_Eyes', 0xffffff]],
    attack: '1H_Melee_Attack_Chop',
    boss: true,
    breaks: ['offhand', 'Skeleton_Warrior_Helmet'],
    lair: 'clutter',
    material: [0xbfbfbf, 0x8c8c8c, 0xe0e0e0],
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
