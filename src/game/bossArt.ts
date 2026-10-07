import { Assets, Texture } from 'pixi.js';
import type { BossDef } from './types';

interface BossArt {
  /** Painted sprite, cut out by tools/cutout.py. Custom bosses use a drawn stand-in. */
  sprite?: string;
  /** Damage stages 2–4, when their art exists. */
  stages?: string[];
  /** Painted 9:16 arena behind the boss. */
  arena?: string;
  material: number[];
  /** Small and bouncy (minions) rather than big and heavy (bosses). */
  light?: boolean;
}

const ART: Record<string, BossArt> = {
  laundry: {
    sprite: '/art/laundry-1.webp',
    stages: ['/art/laundry-2.webp', '/art/laundry-3.webp', '/art/laundry-4.webp'],
    arena: '/art/arena-laundry.webp',
    material: [0x34428f, 0xc23b3b, 0xe8e2d0, 0xe39b2d, 0x7a3fb0, 0x5b7f3a, 0xd94f8a],
  },
  dishes: {
    sprite: '/art/dishes-1.webp',
    stages: ['/art/dishes-2.webp', '/art/dishes-3.webp', '/art/dishes-4.webp'],
    arena: '/art/arena-dishes.webp',
    material: [0xe9f6ff, 0x8fd3e8, 0x3aa7c9, 0xffffff, 0xc9a06a, 0x6f8fa8],
  },
  clutter: {
    sprite: '/art/clutter-1.webp',
    stages: ['/art/clutter-2.webp', '/art/clutter-3.webp', '/art/clutter-4.webp'],
    arena: '/art/arena-clutter.webp',
    material: [0xd98b3a, 0x8a5a2b, 0x3b5b8f, 0xc94f2f, 0xe6d3a3, 0xf2a03d],
  },
  custom: { material: [0xbfbfbf, 0x8c8c8c, 0xe0e0e0] },
  'sock-goblin': {
    sprite: '/art/sock-goblin.webp',
    arena: '/art/arena-laundry.webp',
    light: true,
    material: [0xd94f8a, 0x34428f, 0xe8e2d0, 0x7a3fb0, 0x5b7f3a],
  },
  'grease-gremlin': {
    sprite: '/art/grease-gremlin.webp',
    arena: '/art/arena-dishes.webp',
    light: true,
    material: [0xe9f6ff, 0x8fd3e8, 0xd9b44a, 0xffffff, 0x7a8f3a],
  },
  'dust-bunny': {
    sprite: '/art/dust-bunny.webp',
    arena: '/art/arena-clutter.webp',
    light: true,
    material: [0x9a9a9a, 0xc8c2b8, 0x6b6b6b, 0xe6d3a3],
  },
  king: {
    sprite: '/art/mess-king.webp',
    arena: '/art/arena-throne.webp',
    material: [0x8b5cf6, 0xffc94d, 0xe8e2d0, 0x34428f, 0xc23b3b, 0x3aa7c9],
  },
};

const artFor = (boss: BossDef): BossArt => ART[boss.art ?? boss.kind] ?? ART[boss.kind] ?? ART.custom;

export function bossIsLight(boss: BossDef) {
  return !!artFor(boss).light;
}

export function bossMaterial(boss: BossDef) {
  return artFor(boss).material;
}

/** Painted first-person weapon, once its art is in. */
export const WEAPON_ART: string | undefined = '/art/weapon.webp';

/**
 * The boss's damage-stage textures, healthiest first. Missing stages are simply
 * skipped; with no art at all, a drawn stand-in tinted to the boss's hue.
 */
export async function loadBossStages(boss: BossDef): Promise<Texture[]> {
  const art = artFor(boss);
  const urls = art.sprite ? [art.sprite, ...(art.stages ?? [])] : [];
  const loaded = await Promise.all(
    urls.map((u) =>
      Assets.load<Texture>(u).catch((err) => {
        console.warn('Boss art failed to load', u, err);
        return undefined;
      }),
    ),
  );
  const stages = loaded.filter((t): t is Texture => !!t);
  return stages.length ? stages : [Texture.from(placeholderCanvas(boss.hue))];
}

export async function loadWeapon(): Promise<Texture | undefined> {
  if (!WEAPON_ART) return undefined;
  return Assets.load<Texture>(WEAPON_ART).catch(() => undefined);
}

/** The boss's painted arena, decoded and ready to draw, or undefined if it has none. */
export async function loadArena(boss: BossDef): Promise<HTMLImageElement | undefined> {
  const url = artFor(boss).arena;
  if (!url) return undefined;
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
    return img;
  } catch {
    return undefined;
  }
}

function placeholderCanvas(hue: number) {
  const c = document.createElement('canvas');
  c.width = 600;
  c.height = 600;
  const g = c.getContext('2d')!;
  const body = g.createRadialGradient(260, 220, 40, 300, 320, 300);
  body.addColorStop(0, `hsl(${hue} 75% 66%)`);
  body.addColorStop(1, `hsl(${hue} 60% 30%)`);
  g.fillStyle = body;
  g.strokeStyle = `hsl(${hue} 60% 20%)`;
  g.lineWidth = 14;
  g.beginPath();
  g.moveTo(90, 480);
  g.bezierCurveTo(60, 230, 160, 90, 300, 90);
  g.bezierCurveTo(440, 90, 540, 230, 510, 480);
  for (let x = 510; x > 90; x -= 60) g.quadraticCurveTo(x - 30, 520, x - 60, 480);
  g.closePath();
  g.fill();
  g.stroke();
  for (const ex of [235, 365]) {
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(ex, 280, 38, 30, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#15122b';
    g.beginPath();
    g.arc(ex + 6, 288, 15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = `hsl(${hue} 70% 55%)`;
    g.fillRect(ex - 44, 246, 88, 22);
  }
  g.strokeStyle = '#15122b';
  g.lineWidth = 12;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(250, 380);
  g.quadraticCurveTo(300, 395, 350, 380);
  g.stroke();
  return c;
}

export function bossSpriteUrl(boss: BossDef): string | undefined {
  return artFor(boss).sprite;
}

/** Painted treasure chest, once its art is in. */
export const CHEST_ART: string | undefined = '/art/chest.webp';
