import { Assets, Texture } from 'pixi.js';
import type { BossDef, BossKind } from './types';

interface BossArt {
  /** Painted sprite, cut out by tools/cutout.py. Missing until that boss's art is in. */
  sprite?: string;
  material: number[];
}

const ART: Record<BossKind, BossArt> = {
  laundry: {
    sprite: '/art/laundry-1.webp',
    material: [0x34428f, 0xc23b3b, 0xe8e2d0, 0xe39b2d, 0x7a3fb0, 0x5b7f3a, 0xd94f8a],
  },
  dishes: { material: [0xe9f6ff, 0x8fd3e8, 0x3aa7c9, 0xffffff, 0xc9b28a] },
  clutter: { material: [0xd98b3a, 0x8a5a2b, 0x3b3b3b, 0xc94f2f, 0xe6d3a3] },
  custom: { material: [0xbfbfbf, 0x8c8c8c, 0xe0e0e0] },
};

export function bossMaterial(boss: BossDef) {
  return ART[boss.kind].material;
}

/** The boss's painted sprite, or a drawn stand-in until its art exists. */
export async function loadBossTexture(boss: BossDef): Promise<Texture> {
  const url = ART[boss.kind].sprite;
  if (url) {
    try {
      return await Assets.load<Texture>(url);
    } catch (err) {
      console.warn('Boss art failed to load, using a stand-in', err);
    }
  }
  return Texture.from(placeholderCanvas(boss.hue));
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
  return ART[boss.kind].sprite;
}

/** Painted treasure chest, once its art is in. */
export const CHEST_ART: string | undefined = undefined;
