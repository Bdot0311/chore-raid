import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';

/**
 * The player's first-person weapon. Every finished item is one attack, and the
 * moves cycle so consecutive hits look like a fight instead of the same flash.
 */

export type Move = 'slash' | 'backslash' | 'thrust' | 'smash' | 'spin';

const MOVE_ORDER: Move[] = ['slash', 'backslash', 'thrust', 'slash', 'smash', 'backslash'];

interface Pose {
  x: number;
  y: number;
  rot: number;
  scale: number;
}

const ease = (t: number) => 1 - (1 - t) ** 3;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Keyframes as offsets from the rest pose: wind-up, strike, then recover. */
const KEYS: Record<Move, [Pose, Pose]> = {
  slash: [
    { x: 0.06, y: 0.02, rot: 0.55, scale: 1.05 },
    { x: -0.42, y: -0.12, rot: -1.1, scale: 0.9 },
  ],
  backslash: [
    { x: -0.3, y: -0.05, rot: -0.9, scale: 1 },
    { x: 0.1, y: -0.1, rot: 0.7, scale: 0.92 },
  ],
  thrust: [
    { x: 0.05, y: 0.08, rot: 0.15, scale: 1.05 },
    { x: -0.22, y: -0.3, rot: -0.25, scale: 0.72 },
  ],
  smash: [
    { x: -0.05, y: -0.22, rot: 0.75, scale: 1.08 },
    { x: -0.2, y: 0.02, rot: -0.55, scale: 0.88 },
  ],
  spin: [
    { x: 0.1, y: 0.05, rot: 1.2, scale: 1.1 },
    { x: -0.35, y: -0.2, rot: -2.4, scale: 0.85 },
  ],
};

const DURATION: Record<Move, number> = { slash: 0.26, backslash: 0.26, thrust: 0.24, smash: 0.32, spin: 0.42 };

export class Weapon {
  readonly root = new Container();
  private sprite: Sprite;
  private w = 1;
  private h = 1;
  private baseScale = 1;
  private anim?: { move: Move; t: number };
  private recoil = 0;
  private next = 0;

  constructor(renderer: Renderer, art?: Texture, tint = 0xffffff) {
    const tex = art ?? drawBroomblade(renderer);
    this.sprite = new Sprite(tex);
    this.sprite.tint = tint;
    // The grip sits near the bottom-right corner of the art; rotate around it.
    this.sprite.anchor.set(art ? 0.8 : 0.9, art ? 0.94 : 0.92);
    this.root.addChild(this.sprite);
  }

  layout(w: number, h: number) {
    this.w = w;
    this.h = h;
    const tex = this.sprite.texture;
    this.baseScale = Math.min(h * 0.46, w * 1.0) / tex.height;
  }

  /** Picks the next move in the cycle unless one is forced. */
  attack(force?: Move): Move {
    const move = force ?? MOVE_ORDER[this.next++ % MOVE_ORDER.length];
    this.anim = { move, t: 0 };
    return move;
  }

  /** Knocked back when the boss lands a blow. */
  block() {
    this.recoil = 1;
  }

  update(dt: number, time: number) {
    const rest: Pose = { x: this.w * 0.86, y: this.h * 0.96, rot: -0.12, scale: this.baseScale };
    // Idle: a slow breathing bob, like holding a weapon at the ready.
    let x = rest.x + Math.sin(time * 1.7) * 4;
    let y = rest.y + Math.sin(time * 2.3) * 6;
    let rot = rest.rot + Math.sin(time * 1.1) * 0.02;
    let scale = rest.scale;

    if (this.anim) {
      const a = this.anim;
      a.t += dt / DURATION[a.move];
      const [wind, strike] = KEYS[a.move];
      let p: Pose;
      if (a.t < 0.22) {
        p = mix({ x: 0, y: 0, rot: 0, scale: 1 }, wind, ease(a.t / 0.22));
      } else if (a.t < 0.5) {
        p = mix(wind, strike, ease((a.t - 0.22) / 0.28));
      } else {
        p = mix(strike, { x: 0, y: 0, rot: 0, scale: 1 }, ease(Math.min(1, (a.t - 0.5) / 0.5)));
      }
      x += p.x * this.w;
      y += p.y * this.h;
      rot += p.rot;
      scale *= p.scale;
      if (a.t >= 1) this.anim = undefined;
    }

    if (this.recoil > 0) {
      x += this.recoil * this.w * 0.08;
      y += this.recoil * this.h * 0.08;
      rot += this.recoil * 0.35;
      this.recoil = Math.max(0, this.recoil - dt * 3);
    }

    this.sprite.position.set(x, y);
    this.sprite.rotation = rot;
    this.sprite.scale.set(scale);
  }
}

function mix(a: Pose, b: Pose, t: number): Pose {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), rot: lerp(a.rot, b.rot, t), scale: lerp(a.scale, b.scale, t) };
}

/** A drawn stand-in until the painted weapon art is in: a sword-bladed broom. */
function drawBroomblade(renderer: Renderer): Texture {
  const g = new Graphics();
  // Drawn pointing straight up, then the container is rotated so it leans up-left.
  const handleLen = 300;
  const bladeLen = 330;
  // Gauntlet
  g.roundRect(-46, handleLen - 30, 92, 120, 30).fill(0x5a3b22).stroke({ width: 6, color: 0x2a170b });
  g.roundRect(-40, handleLen - 20, 80, 26, 10).fill(0x9aa3b5);
  g.roundRect(-40, handleLen + 30, 80, 22, 10).fill(0x9aa3b5);
  // Handle with leather wrap
  g.roundRect(-13, 0, 26, handleLen, 10).fill(0x8a5a2b).stroke({ width: 4, color: 0x3d2312 });
  for (let y = 40; y < handleLen - 40; y += 34) g.rect(-14, y, 28, 12).fill(0x4a2c16);
  // Bristle crossguard
  for (let i = -6; i <= 6; i++) {
    g.moveTo(0, 6).lineTo(i * 11, -38 - Math.abs(i) * 2).stroke({ width: 7, color: i % 2 ? 0xe0b04a : 0xc9902a, cap: 'round' });
  }
  g.roundRect(-58, -16, 116, 26, 10).fill(0xffd166).stroke({ width: 4, color: 0x8a5a10 });
  // Blade
  g.poly([-24, -16, 24, -16, 18, -bladeLen + 40, 0, -bladeLen, -18, -bladeLen + 40]).fill(0xdfe7f2).stroke({ width: 5, color: 0x5d6b80 });
  g.poly([0, -20, 6, -bladeLen + 60, 0, -bladeLen + 30, -6, -bladeLen + 60]).fill(0xffffff);
  g.poly([-24, -16, 0, -16, 0, -bladeLen, -18, -bladeLen + 40]).fill({ color: 0x8fa3c0, alpha: 0.35 });

  const holder = new Container();
  g.rotation = -0.62;
  g.position.set(330, 470);
  holder.addChild(g);
  const tex = renderer.generateTexture({ target: holder, resolution: 1 });
  holder.destroy({ children: true });
  return tex;
}
