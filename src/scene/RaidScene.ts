import {
  Application,
  BlurFilter,
  ColorMatrixFilter,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
  type Ticker,
} from 'pixi.js';
import { Weapon, type Move } from './Weapon';

/**
 * The raid's WebGL scene: painted boss, arena, particles and every bit of hit
 * feedback. React owns the HUD and the input; it drives this class through a
 * handful of imperative calls (hit, windup, die...).
 */

export interface SceneBoss {
  hue: number;
  /** Damage stages, healthiest first (1–4 textures). */
  stages: Texture[];
  /** Painted first-person weapon; a drawn one is used when absent. */
  weapon?: Texture;
  /** Fired when the boss lands a (purely cosmetic) blow, for sound and haptics. */
  onBossAttack?: (big: boolean) => void;
  /** Painted arena background; a gradient is drawn when absent. */
  arena?: HTMLImageElement;
  /** Particle colors: the boss's material (fabric scraps, suds, splinters). */
  material: number[];
}

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  spin: number;
  gravity: number;
  drag: number;
  life: number;
  max: number;
  scale0: number;
  scale1: number;
  alpha0: number;
}

interface Spring {
  x: number;
  v: number;
}

const stepSpring = (s: Spring, dt: number, k = 380, c = 16) => {
  const a = -k * s.x - c * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
};

const hsl = (h: number, s: number, l: number) => {
  // HSL (0-360, 0-1, 0-1) to 0xRRGGBB for tints.
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class RaidScene {
  readonly app = new Application();
  private boss!: SceneBoss;
  private ready = false;
  private destroyed = false;

  private world = new Container();
  private bgSprite = new Sprite();
  private dim = new Graphics();
  private embers = new Container();
  private bossRoot = new Container();
  private glow = new Sprite();
  private aura = new Graphics();
  private bossSprite = new Sprite();
  private fx = new Container();
  private texts = new Container();
  private flash = new Graphics();
  private vignette = new Sprite();
  private hurt = new Graphics();
  private claws = new Container();
  private weapon!: Weapon;
  private stage = 0;
  private glowTextures: Texture[] = [];
  private lastHitAt = 0;
  private nextAttackIn = 9;
  private counterUntil = 0;
  private hurtLevel = 0;
  private lunge: Spring = { x: 0, v: 0 };
  private attackCharge = 0;

  private bossFilter = new ColorMatrixFilter();
  private dotTex!: Texture;
  private shardTex!: Texture;
  private pool: Sprite[] = [];
  private particles: Particle[] = [];
  private emberParts: Particle[] = [];

  private time = 0;
  private hitStop = 0;
  private shake = 0;
  private flashLevel = 0;
  private overlayFlash = 0;
  private squash: Spring = { x: 0, v: 0 };
  private knock: Spring = { x: 0, v: 0 };
  private hpPct = 1;
  private shownScale = 1;
  private combo = 1;
  private windupOn = false;
  private windupLevel = 0;
  private healGlow = 0;
  private dead = false;
  private baseScale = 1;
  private bossY = 0;
  private lastSize = '';
  private ownTextures: Texture[] = [];
  private glowScale = 1;

  async init(host: HTMLElement, boss: SceneBoss) {
    this.boss = boss;
    await this.app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      powerPreference: 'high-performance',
    });
    if (this.destroyed) {
      this.app.destroy(true, { children: true });
      return;
    }
    host.appendChild(this.app.canvas);
    this.app.canvas.style.pointerEvents = 'none';

    this.dotTex = this.app.renderer.generateTexture(new Graphics().circle(0, 0, 8).fill(0xffffff));
    this.shardTex = this.app.renderer.generateTexture(new Graphics().poly([0, 0, 14, 4, 6, 12]).fill(0xffffff));

    this.glowTextures = boss.stages.map((t) => this.bakeGlow(t));
    this.glow.texture = this.glowTextures[0];
    this.glow.anchor.set(0.5);
    this.glow.blendMode = 'add';
    this.bossSprite.texture = boss.stages[0];
    this.bossSprite.anchor.set(0.5, 0.5);
    this.bossRoot.addChild(this.aura, this.glow, this.bossSprite);

    this.weapon = new Weapon(this.app.renderer, boss.weapon);
    this.world.addChild(this.bgSprite, this.embers, this.dim, this.bossRoot, this.fx, this.weapon.root, this.texts);
    this.app.stage.addChild(this.world, this.vignette, this.hurt, this.claws, this.flash);

    for (let i = 0; i < 42; i++) this.spawnEmber(true);

    this.layout();
    this.app.ticker.add(this.update);
    this.ready = true;
    void document.fonts?.load('40px "Lilita One"');
  }

  destroy() {
    this.destroyed = true;
    if (!this.ready) return;
    this.app.ticker.remove(this.update);
    this.app.destroy(true, { children: true });
  }

  // ---------------------------------------------------------------- inputs

  setHp(pct: number) {
    this.hpPct = pct;
  }

  /** x, y in CSS pixels relative to the stage. */
  hit(x: number, y: number, multiplier: number, gained: number): { move: Move; bolt: boolean } | undefined {
    if (!this.ready || this.dead) return undefined;
    const countered = this.time < this.counterUntil;
    this.counterUntil = 0;
    this.lastHitAt = this.time;
    this.nextAttackIn = rand(7, 12);
    this.attackCharge = 0;
    this.combo = multiplier;
    const move = this.weapon.attack(countered ? 'smash' : undefined);
    this.slashFor(move, multiplier >= 3 ? hsl(this.boss.hue, 0.95, 0.75) : 0xffffff);
    const bolt = multiplier >= 3 && (multiplier === 4 || Math.random() < 0.5);
    if (bolt) this.lightning();
    if (countered) {
      const { bx, by } = this.bossCenter();
      this.number(bx, by - 150, 'COUNTER!', 0x7dd3fc, 60, 1.4);
    }
    this.hitStop = 55 + multiplier * 10;
    this.shake = Math.min(26, 7 + multiplier * 4);
    this.flashLevel = 1;
    this.squash.v += 5 + multiplier;
    this.knock.v -= 260 + multiplier * 60;
    this.lunge.v -= 2 + multiplier * 0.5;

    const { bx, by } = this.bossCenter();
    // Particles burst from the boss toward the tap, so it reads as "you struck it there".
    const ix = bx + (x - bx) * 0.35;
    const iy = by + (y - by) * 0.35;
    this.burst(ix, iy, 16 + multiplier * 8, { speed: 520 + multiplier * 80, colors: this.boss.material, tex: this.shardTex, gravity: 900 });
    this.burst(ix, iy, 10 + multiplier * 4, { speed: 300, colors: [0xffffff, hsl(this.boss.hue, 0.9, 0.75)], gravity: 0, life: 0.45, add: true, scale: 0.9 });
    this.ring(ix, iy, multiplier >= 3 ? hsl(this.boss.hue, 0.9, 0.7) : 0xffffff, 60 + multiplier * 30);
    this.number(x, y - 30, `+${gained}`, multiplier >= 3 ? 0xffc94d : 0xffffff, 40 + multiplier * 6);
    return { move, bolt };
  }

  comboUp(multiplier: number) {
    if (!this.ready) return;
    const { width: w, height: h } = this.app.screen;
    const label = ({ 2: 'COMBO ×2', 3: 'TRIPLE ×3', 4: 'UNSTOPPABLE ×4' } as Record<number, string>)[multiplier];
    if (label) this.number(w / 2, h * 0.3, label, 0xffc94d, 52, 1.4);
    this.burst(w / 2, h * 0.3, 40, { speed: 600, colors: [0xffc94d, 0xff6b3d, 0xffffff], gravity: 300, add: true });
    if (multiplier >= 3) this.lightning();
    if (multiplier >= 4) {
      // Ultimate: an X of light across the boss and a beat of slow motion.
      const { bx, by } = this.bossCenter();
      this.hitStop = 220;
      this.overlayFlash = 0.6;
      this.arc(bx, by, 190, -2.6, -0.5, 0xffc94d, 34, 420);
      this.arc(bx, by, 190, 2.6, 0.5, 0xffc94d, 34, 420);
    }
  }

  windup(on: boolean) {
    this.windupOn = on;
    if (on && this.ready) {
      this.shake = Math.max(this.shake, 14);
      this.lunge.v += 6;
      const { width: w, height: h } = this.app.screen;
      this.number(w / 2, h * 0.3, 'WIND-UP!', 0xff5a4d, 64, 1.6);
    }
  }

  windupResult(beaten: boolean, bonus = 0) {
    if (!this.ready) return;
    this.windupOn = false;
    const { bx, by } = this.bossCenter();
    if (beaten) {
      this.overlayFlash = 0.8;
      this.shake = 30;
      this.hitStop = 140;
      this.burst(bx, by, 90, { speed: 900, colors: [0xffc94d, 0xffffff, 0xff6b3d], gravity: 500, add: true, scale: 1.2 });
      this.burst(bx, by, 40, { speed: 700, colors: this.boss.material, tex: this.shardTex, gravity: 1100 });
      this.weapon.attack('smash');
      this.arc(bx, by, 170, -2.2, -0.9, 0xffc94d, 30, 380);
      this.number(bx, by - 170, 'PARRY!', 0x7dd3fc, 52, 1.5);
      this.number(bx, by - 120, 'CRITICAL!', 0xffc94d, 72, 1.8);
      if (bonus) this.number(bx, by - 50, `+${bonus}`, 0xffc94d, 48, 1.6);
    } else {
      this.healGlow = 1;
      for (let i = 0; i < 50; i++) {
        this.spawn(bx + rand(-140, 140), by + rand(-40, 180), {
          vx: rand(-20, 20),
          vy: rand(-260, -120),
          colors: [0x4ade80, 0xbbf7d0],
          life: rand(0.8, 1.4),
          gravity: -60,
          add: true,
          scale: rand(0.5, 1.1),
        });
      }
      this.number(bx, by - 120, 'WARD HEALED', 0x4ade80, 46, 1.6);
      this.bossAttack(true);
    }
  }

  undo() {
    if (!this.ready) return;
    const { bx, by } = this.bossCenter();
    this.number(bx, by - 100, 'UNDO', 0x9a93bd, 34);
  }

  /** Returns a promise that settles when the death sequence is over. */
  die(): Promise<void> {
    if (!this.ready || this.dead) return Promise.resolve();
    this.dead = true;
    this.hitStop = 320;
    this.shake = 36;
    this.flashLevel = 1;
    // Finisher: a spinning double slash, a held beat, then the boss breaks apart.
    this.weapon.attack('spin');
    const { bx: fx, by: fy } = this.bossCenter();
    this.arc(fx, fy, 210, -2.7, -0.4, 0xffffff, 40, 520);
    this.arc(fx, fy, 210, 2.7, 0.4, 0xffffff, 40, 520);
    this.number(fx, fy - 190, 'FINISHED!', 0xffc94d, 76, 2);
    return new Promise((resolve) => {
      window.setTimeout(() => {
        if (this.destroyed) return resolve();
        this.shatter();
        this.overlayFlash = 1;
        const { bx, by } = this.bossCenter();
        this.burst(bx, by, 160, { speed: 1100, colors: [...this.boss.material, 0xffffff], tex: this.shardTex, gravity: 900, scale: 1.3 });
        this.burst(bx, by, 80, { speed: 700, colors: [0xffc94d, 0xffffff, hsl(this.boss.hue, 0.9, 0.7)], gravity: 0, add: true, life: 0.9, scale: 1.4 });
        this.ring(bx, by, 0xffffff, 520);
        window.setTimeout(resolve, 1500);
      }, 520);
    });
  }

  // ---------------------------------------------------------------- frame

  private update = (ticker: Ticker) => {
    const dtMs = Math.min(ticker.deltaMS, 50);
    this.layout();

    // Flash and screen shake keep running during hit-stop; everything else freezes.
    this.flashLevel = Math.max(0, this.flashLevel - dtMs / 110);
    this.overlayFlash = Math.max(0, this.overlayFlash - dtMs / 450);
    // The flash filter costs a render pass, so it is only attached while visible.
    if (this.flashLevel > 0) {
      this.bossFilter.brightness(1 + this.flashLevel * 2.2, false);
      if (!this.bossSprite.filters?.length) this.bossSprite.filters = [this.bossFilter];
    } else if (this.bossSprite.filters?.length) {
      this.bossSprite.filters = [];
    }
    this.flash.alpha = this.overlayFlash;
    // Full-screen layers cost fill rate on phones even at alpha 0, so hide them when idle.
    this.flash.visible = this.overlayFlash > 0.01;

    this.hurtLevel = Math.max(0, this.hurtLevel - dtMs / 600);
    this.hurt.alpha = this.hurtLevel;
    this.hurt.visible = this.hurtLevel > 0.01;

    const s = this.shake;
    this.world.position.set(rand(-s, s), rand(-s, s));
    this.shake = Math.max(0, this.shake - dtMs * 0.09);

    if (this.hitStop > 0) {
      this.hitStop -= dtMs;
      return;
    }

    const dt = dtMs / 1000;
    this.time += dt;
    stepSpring(this.squash, dt);
    stepSpring(this.knock, dt, 220, 14);
    stepSpring(this.lunge, dt, 160, 12);
    this.weapon.update(dt, this.time);
    this.updateStage();

    // The mess fights back when you stall: a cosmetic blow after a few idle seconds.
    if (!this.dead && !this.windupOn && this.time - this.lastHitAt > this.nextAttackIn) {
      this.attackCharge += dt;
      if (this.attackCharge > 0.7) {
        this.bossAttack(false);
        this.lastHitAt = this.time;
        this.nextAttackIn = rand(8, 14);
        this.attackCharge = 0;
      }
    }
    // Shrinks ~25% overall as it loses HP; panics (faster, jerkier sway) when low.
    // Damage-stage art already shows the boss shrinking, so scale less when it exists.
    const targetScale = this.boss.stages.length > 1 ? 0.88 + 0.12 * this.hpPct : 0.75 + 0.25 * this.hpPct;
    this.shownScale += (targetScale - this.shownScale) * Math.min(1, dt * 6);
    const low = this.hpPct < 0.25;
    const swaySpeed = low ? 5.5 : this.hpPct < 0.5 ? 2.6 : 1.6;
    const breathe = Math.sin(this.time * swaySpeed) * 0.025;
    const sq = Math.max(-0.3, Math.min(0.3, this.squash.x * 0.06));
    // Rears back while charging a blow, surges toward you when it lands.
    const charge = this.attackCharge > 0 ? -0.06 * Math.min(1, this.attackCharge / 0.7) : 0;
    const sc = this.baseScale * this.shownScale * (1 + this.lunge.x * 0.04 + charge);
    this.bossSprite.scale.set(sc * (1 + sq + breathe * 0.5), sc * (1 - sq * 0.8 + breathe));
    this.bossSprite.rotation = Math.sin(this.time * swaySpeed * 0.7) * (low ? 0.06 : 0.025);
    const tremble = this.windupOn || low ? rand(-2.5, 2.5) : 0;
    this.bossSprite.position.set(tremble, this.knock.x * 0.12 + Math.sin(this.time * 1.3) * 6);

    this.glow.scale.set(this.bossSprite.scale.x * this.glowScale * 1.05, this.bossSprite.scale.y * this.glowScale * 1.05);
    this.glow.position.copyFrom(this.bossSprite.position);
    this.glow.rotation = this.bossSprite.rotation;
    this.windupLevel += ((this.windupOn ? 1 : 0) - this.windupLevel) * Math.min(1, dt * 4);
    this.healGlow = Math.max(0, this.healGlow - dt * 0.6);
    const pulse = 0.5 + 0.5 * Math.sin(this.time * (this.windupOn ? 9 : 2.2));
    const comboBoost = (this.combo - 1) * 0.12;
    this.glow.tint = this.healGlow > 0.05 ? 0x4ade80 : this.windupLevel > 0.5 ? 0xff3b30 : hsl(this.boss.hue, 0.85, 0.6);
    this.glow.alpha = 0.35 + comboBoost + pulse * 0.2 + this.windupLevel * 0.35 + this.healGlow * 0.5;

    this.drawAura(pulse);
    this.dim.alpha = this.windupLevel * 0.45;
    this.dim.visible = this.dim.alpha > 0.01;

    for (const e of this.emberParts) this.stepParticle(e, dt, true);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (!this.stepParticle(this.particles[i], dt, false)) {
        this.release(this.particles[i].sprite);
        this.particles.splice(i, 1);
      }
    }
  };

  private stepParticle(p: Particle, dt: number, loop: boolean): boolean {
    p.life += dt;
    if (p.life >= p.max) {
      if (!loop) return false;
      this.resetEmber(p);
    }
    p.vx *= 1 - p.drag * dt;
    p.vy = p.vy * (1 - p.drag * dt) + p.gravity * dt;
    p.sprite.x += p.vx * dt;
    p.sprite.y += p.vy * dt;
    p.sprite.rotation += p.spin * dt;
    const k = p.life / p.max;
    p.sprite.scale.set(p.scale0 + (p.scale1 - p.scale0) * k);
    p.sprite.alpha = p.alpha0 * (loop ? Math.sin(Math.PI * k) : 1 - k * k);
    return true;
  }

  // ---------------------------------------------------------------- pieces

  private updateStage() {
    const n = this.boss.stages.length;
    if (n < 2 || this.dead) return;
    const lost = 1 - this.hpPct;
    const next = Math.min(n - 1, Math.floor(lost * n + 1e-6));
    if (next === this.stage) return;
    const breaking = next > this.stage;
    this.stage = next;
    this.bossSprite.texture = this.boss.stages[next];
    this.glow.texture = this.glowTextures[next];
    if (breaking) {
      // A piece of the boss gives way: flash, debris, a beat of hit-stop.
      const { bx, by } = this.bossCenter();
      this.hitStop = Math.max(this.hitStop, 120);
      this.overlayFlash = 0.45;
      this.shake = Math.max(this.shake, 24);
      this.burst(bx, by, 70, { speed: 900, colors: this.boss.material, tex: this.shardTex, gravity: 1200, scale: 1.4 });
      this.number(bx, by - 140, 'BROKEN!', 0xffffff, 54, 1.3);
    }
  }

  /** A slash trail that matches the weapon move. */
  private slashFor(move: Move, color: number) {
    const { bx, by } = this.bossCenter();
    const r = Math.min(this.app.screen.width * 0.42, 210);
    switch (move) {
      case 'slash':
        this.arc(bx + 20, by - 10, r, -0.5, -2.6, color, 26, 260);
        break;
      case 'backslash':
        this.arc(bx - 20, by - 10, r, -2.7, -0.6, color, 24, 260);
        break;
      case 'smash':
        this.arc(bx - r * 0.6, by, r, -1.2, 0.3, color, 30, 300);
        this.ring(bx, by + r * 0.6, color, 260);
        break;
      case 'thrust':
        this.impactStar(bx + rand(-30, 30), by + rand(-40, 20), color);
        break;
      case 'spin':
        this.arc(bx, by, r, -3, 0, color, 34, 360);
        break;
    }
  }

  /** A crescent of light swept from angle a0 to a1, fading out. */
  private arc(cx: number, cy: number, r: number, a0: number, a1: number, color: number, width: number, ms: number) {
    const g = new Graphics();
    g.blendMode = 'add';
    this.fx.addChild(g);
    const start = performance.now();
    const steps = 22;
    const draw = (k: number) => {
      g.clear();
      // The trail grows along the sweep for the first third, then thins and fades.
      const reach = Math.min(1, k * 3);
      const fade = k < 0.35 ? 1 : 1 - (k - 0.35) / 0.65;
      for (const [wMul, c, alpha] of [
        [1, color, 0.55],
        [0.4, 0xffffff, 0.95],
      ] as const) {
        const outer: [number, number][] = [];
        const inner: [number, number][] = [];
        for (let i = 0; i <= steps; i++) {
          const a = a0 + (a1 - a0) * (i / steps) * reach;
          const wv = width * wMul * Math.sin(Math.PI * (i / steps)) * fade;
          outer.push([cx + Math.cos(a) * (r + wv), cy + Math.sin(a) * (r + wv)]);
          inner.push([cx + Math.cos(a) * (r - wv * 0.3), cy + Math.sin(a) * (r - wv * 0.3)]);
        }
        const pts = [...outer, ...inner.reverse()].flat();
        g.poly(pts).fill({ color: c, alpha: alpha * fade });
      }
    };
    const tick = () => {
      const k = (performance.now() - start) / ms;
      if (k >= 1 || this.destroyed) {
        this.app.ticker?.remove(tick);
        g.destroy();
        return;
      }
      draw(k);
    };
    this.app.ticker.add(tick);
  }

  private impactStar(x: number, y: number, color: number) {
    const g = new Graphics();
    g.blendMode = 'add';
    g.position.set(x, y);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + rand(-0.2, 0.2);
      const len = rand(60, 130);
      g.poly([0, 0, Math.cos(a + 0.08) * 18, Math.sin(a + 0.08) * 18, Math.cos(a) * len, Math.sin(a) * len, Math.cos(a - 0.08) * 18, Math.sin(a - 0.08) * 18]).fill(i % 2 ? color : 0xffffff);
    }
    this.fx.addChild(g);
    const start = performance.now();
    const tick = () => {
      const k = (performance.now() - start) / 260;
      if (k >= 1 || this.destroyed) {
        this.app.ticker?.remove(tick);
        g.destroy();
        return;
      }
      g.scale.set(0.4 + k * 0.9);
      g.alpha = 1 - k;
    };
    this.app.ticker.add(tick);
  }

  /** A jagged bolt from the top of the screen onto the boss. */
  private lightning() {
    const { bx, by } = this.bossCenter();
    const g = new Graphics();
    g.blendMode = 'add';
    const tx = bx + rand(-60, 60);
    const pts: number[] = [tx + rand(-80, 80), -20];
    let y = -20;
    while (y < by - 20) {
      y += rand(30, 60);
      pts.push(tx + rand(-40, 40), Math.min(y, by - 20));
    }
    for (const [width, color, alpha] of [
      [18, 0x7dd3fc, 0.35],
      [7, 0xe0f2fe, 0.9],
      [3, 0xffffff, 1],
    ] as const) {
      g.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
    }
    this.fx.addChild(g);
    this.overlayFlash = Math.max(this.overlayFlash, 0.35);
    this.burst(tx, by - 20, 30, { speed: 600, colors: [0x7dd3fc, 0xffffff], gravity: 400, add: true, life: 0.5 });
    const start = performance.now();
    const tick = () => {
      const k = (performance.now() - start) / 300;
      if (k >= 1 || this.destroyed) {
        this.app.ticker?.remove(tick);
        g.destroy();
        return;
      }
      g.alpha = k < 0.3 ? 1 : (1 - k) * (Math.random() < 0.3 ? 0.4 : 1);
    };
    this.app.ticker.add(tick);
  }

  /** The boss lunges at the camera and rakes the screen. HP never changes. */
  private bossAttack(big: boolean) {
    if (!this.ready || this.dead) return;
    this.lunge.v += big ? 14 : 9;
    this.shake = Math.max(this.shake, big ? 30 : 20);
    this.hurtLevel = big ? 1 : 0.75;
    this.weapon.block();
    this.counterUntil = this.time + 1.6;
    const { width: w, height: h } = this.app.screen;
    const marks = new Graphics();
    const n = big ? 4 : 3;
    const x0 = rand(w * 0.15, w * 0.35);
    for (let i = 0; i < n; i++) {
      const ox = x0 + i * w * 0.13;
      marks
        .poly([ox, h * 0.18, ox + 14, h * 0.2, ox + w * 0.32, h * 0.72, ox + w * 0.3, h * 0.74])
        .fill({ color: 0xff2a2a, alpha: 0.85 })
        .poly([ox + 4, h * 0.2, ox + 8, h * 0.21, ox + w * 0.31, h * 0.72, ox + w * 0.305, h * 0.725])
        .fill({ color: 0xffd0d0, alpha: 0.9 });
    }
    this.claws.addChild(marks);
    const start = performance.now();
    const tick = () => {
      const k = (performance.now() - start) / 900;
      if (k >= 1 || this.destroyed) {
        this.app.ticker?.remove(tick);
        marks.destroy();
        return;
      }
      marks.alpha = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
    };
    this.app.ticker.add(tick);
    this.boss.onBossAttack?.(big);
  }

  /** The boss's center in world (fx layer) coordinates. */
  private bossCenter() {
    return { bx: this.app.screen.width / 2, by: this.bossY };
  }

  private layout() {
    const { width: w, height: h } = this.app.screen;
    const key = `${w}x${h}`;
    if (key === this.lastSize) return;
    this.lastSize = key;

    this.ownTextures.forEach((t) => t.destroy(true));
    this.bgSprite.texture = this.gradientTexture(w, h);
    this.vignette.texture = this.vignetteTexture(w, h);
    this.ownTextures = [this.bgSprite.texture, this.vignette.texture];
    this.bgSprite.setSize(w, h);
    this.vignette.setSize(w, h);
    this.dim.clear().rect(0, 0, w, h).fill(0x000000);
    this.dim.alpha = 0;
    this.flash.clear().rect(0, 0, w, h).fill(0xffffff);
    this.flash.alpha = 0;
    this.hurt.clear();
    for (let i = 0; i < 6; i++) {
      const inset = i * Math.min(w, h) * 0.035;
      this.hurt.rect(inset, inset, w - inset * 2, h - inset * 2).stroke({ width: Math.min(w, h) * 0.035, color: 0xff1a1a, alpha: 0.32 - i * 0.05 });
    }
    this.hurt.alpha = 0;
    this.weapon.layout(w, h);

    const tex = this.boss.stages[0];
    // Fit the boss into the upper ~60% of the stage, leaving room for the HUD below.
    this.baseScale = Math.min((w * 0.86) / tex.width, (h * 0.58) / tex.height);
    this.bossY = h * 0.42;
    this.bossRoot.position.set(w / 2, this.bossY);
  }

  /**
   * Blurs a silhouette of the boss once, at a quarter size, instead of running a
   * blur filter every frame: the glow is just a scaled-up sprite afterwards.
   */
  private bakeGlow(tex: Texture): Texture {
    const shrink = 0.25;
    const src = new Sprite(tex);
    src.scale.set(shrink);
    const silhouette = new ColorMatrixFilter();
    silhouette.matrix = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0];
    src.filters = [silhouette, new BlurFilter({ strength: 10, quality: 4 })];
    const pad = 40;
    const holder = new Container();
    src.position.set(pad, pad);
    holder.addChild(src);
    const baked = this.app.renderer.generateTexture({
      target: holder,
      frame: new Rectangle(0, 0, tex.width * shrink + pad * 2, tex.height * shrink + pad * 2),
    });
    holder.destroy({ children: true });
    this.glowScale = 1 / shrink;
    return baked;
  }

  private gradientTexture(w: number, h: number) {
    const c = document.createElement('canvas');
    // A smooth gradient survives half resolution; a painted arena needs more.
    const res = this.boss.arena ? Math.min(2, window.devicePixelRatio || 1) : 0.5;
    c.width = Math.max(1, Math.round(w * res));
    c.height = Math.max(1, Math.round(h * res));
    const g = c.getContext('2d')!;
    const hue = this.boss.hue;
    const arena = this.boss.arena;
    if (arena) {
      // Cover-fit the painting, then darken the top and bottom so the HUD stays readable.
      const s = Math.max(c.width / arena.width, c.height / arena.height);
      const dw = arena.width * s;
      const dh = arena.height * s;
      g.drawImage(arena, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
      const shade = g.createLinearGradient(0, 0, 0, c.height);
      shade.addColorStop(0, 'rgba(7,6,15,0.75)');
      shade.addColorStop(0.22, 'rgba(7,6,15,0.15)');
      shade.addColorStop(0.62, 'rgba(7,6,15,0.1)');
      shade.addColorStop(1, 'rgba(7,6,15,0.85)');
      g.fillStyle = shade;
      g.fillRect(0, 0, c.width, c.height);
      return Texture.from(c);
    }
    const grad = g.createRadialGradient(c.width / 2, c.height * 0.4, 10, c.width / 2, c.height * 0.45, c.height * 0.75);
    grad.addColorStop(0, `hsl(${hue} 45% 22%)`);
    grad.addColorStop(0.45, `hsl(${hue} 40% 11%)`);
    grad.addColorStop(1, '#07060f');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    // A floor glow under the boss.
    const floor = g.createRadialGradient(c.width / 2, c.height * 0.72, 4, c.width / 2, c.height * 0.72, c.width * 0.5);
    floor.addColorStop(0, `hsla(${hue} 70% 55% / 0.28)`);
    floor.addColorStop(1, 'transparent');
    g.fillStyle = floor;
    g.fillRect(0, 0, c.width, c.height);
    return Texture.from(c);
  }

  private vignetteTexture(w: number, h: number) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w / 2));
    c.height = Math.max(1, Math.round(h / 2));
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, 'rgba(0,0,0,0.75)');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    return Texture.from(c);
  }

  private drawAura(pulse: number) {
    const lvl = this.windupLevel;
    this.aura.clear();
    if (lvl < 0.02) return;
    const r = this.bossSprite.texture.height * this.baseScale * this.shownScale * (0.45 + pulse * 0.05);
    for (let i = 0; i < 4; i++) {
      this.aura.circle(0, 10, r * (1 + i * 0.12)).fill({ color: 0xff2a1f, alpha: 0.07 * lvl });
    }
  }

  private take(): Sprite {
    const s = this.pool.pop() ?? new Sprite();
    s.anchor.set(0.5);
    s.visible = true;
    return s;
  }

  private release(s: Sprite) {
    s.visible = false;
    s.parent?.removeChild(s);
    if (this.pool.length < 600) this.pool.push(s);
    else s.destroy();
  }

  private spawn(
    x: number,
    y: number,
    o: { vx: number; vy: number; colors: number[]; life: number; gravity: number; add?: boolean; scale?: number; tex?: Texture },
  ) {
    if (this.particles.length > 700) return;
    const s = this.take();
    s.texture = o.tex ?? this.dotTex;
    s.tint = o.colors[Math.floor(Math.random() * o.colors.length)];
    s.blendMode = o.add ? 'add' : 'normal';
    s.position.set(x, y);
    s.rotation = rand(0, Math.PI * 2);
    this.fx.addChild(s);
    const scale = o.scale ?? 1;
    this.particles.push({
      sprite: s,
      vx: o.vx,
      vy: o.vy,
      spin: rand(-12, 12),
      gravity: o.gravity,
      drag: 1.6,
      life: 0,
      max: o.life,
      scale0: scale * rand(0.6, 1.2),
      scale1: scale * 0.15,
      alpha0: 1,
    });
  }

  private burst(
    x: number,
    y: number,
    count: number,
    o: { speed: number; colors: number[]; gravity: number; life?: number; add?: boolean; scale?: number; tex?: Texture },
  ) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(0.25, 1) * o.speed;
      this.spawn(x, y, {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - o.speed * 0.25,
        colors: o.colors,
        life: (o.life ?? 0.7) * rand(0.6, 1.2),
        gravity: o.gravity,
        add: o.add,
        scale: o.scale,
        tex: o.tex,
      });
    }
  }

  private spawnEmber(initial: boolean) {
    const s = new Sprite(this.dotTex);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    this.embers.addChild(s);
    const p: Particle = { sprite: s, vx: 0, vy: 0, spin: 0, gravity: 0, drag: 0, life: 0, max: 1, scale0: 0, scale1: 0, alpha0: 0 };
    this.resetEmber(p);
    if (initial) p.life = rand(0, p.max);
    this.emberParts.push(p);
  }

  private resetEmber(p: Particle) {
    const { width: w, height: h } = this.app.screen;
    p.sprite.position.set(rand(0, w), rand(h * 0.3, h * 1.05));
    p.sprite.tint = Math.random() < 0.7 ? hsl(this.boss.hue, 0.9, 0.65) : 0xffb347;
    p.vx = rand(-12, 12);
    p.vy = rand(-45, -15);
    p.life = 0;
    p.max = rand(4, 9);
    p.scale0 = rand(0.15, 0.45);
    p.scale1 = p.scale0 * 0.6;
    p.alpha0 = rand(0.3, 0.8);
  }

  private ring(x: number, y: number, color: number, radius: number) {
    const g = new Graphics().circle(0, 0, 40).stroke({ width: 6, color });
    g.position.set(x, y);
    g.blendMode = 'add';
    this.fx.addChild(g);
    const start = performance.now();
    const tick = () => {
      const k = (performance.now() - start) / 380;
      if (k >= 1 || this.destroyed) {
        this.app.ticker?.remove(tick);
        g.destroy();
        return;
      }
      g.scale.set((radius / 40) * (0.2 + 0.8 * Math.sqrt(k)));
      g.alpha = 1 - k;
    };
    this.app.ticker.add(tick);
  }

  private number(x: number, y: number, text: string, color: number, size: number, hold = 1) {
    const t = new Text({
      text,
      style: {
        fontFamily: '"Lilita One", system-ui, sans-serif',
        fontSize: size,
        fill: color,
        stroke: { color: 0x120e24, width: Math.max(4, size / 7), join: 'round' },
        dropShadow: { color: 0x000000, alpha: 0.5, blur: 6, distance: 3, angle: Math.PI / 2 },
      },
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.texts.addChild(t);
    const start = performance.now();
    const dur = 750 * hold;
    const tick = () => {
      const k = (performance.now() - start) / dur;
      if (k >= 1 || this.destroyed) {
        this.app.ticker?.remove(tick);
        t.destroy();
        return;
      }
      // Pop in with overshoot, drift up, fade out at the end.
      const pop = k < 0.15 ? 0.4 + (k / 0.15) * 0.9 : 1.3 - Math.min(0.3, (k - 0.15) * 1.5);
      t.scale.set(pop);
      t.y = y - k * 70;
      t.alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    };
    this.app.ticker.add(tick);
  }

  /** Slices the boss sprite into fragments that fly apart. */
  private shatter() {
    const tex = this.bossSprite.texture;
    const cols = 7;
    const rows = 9;
    const fw = tex.frame.width / cols;
    const fh = tex.frame.height / rows;
    const src = this.bossSprite;
    const sx = src.scale.x;
    const sy = src.scale.y;
    const { bx, by } = this.bossCenter();
    const cx = bx + src.x;
    const cy = by + src.y;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const frame = new Rectangle(tex.frame.x + c * fw, tex.frame.y + r * fh, fw, fh);
        const piece = new Sprite(new Texture({ source: tex.source, frame }));
        piece.anchor.set(0.5);
        const lx = (c + 0.5) * fw - tex.frame.width / 2;
        const ly = (r + 0.5) * fh - tex.frame.height / 2;
        piece.position.set(cx + lx * sx, cy + ly * sy);
        piece.scale.set(sx, sy);
        this.fx.addChild(piece);
        const dx = lx / (tex.frame.width / 2);
        const dy = ly / (tex.frame.height / 2);
        const speed = rand(300, 900);
        this.particles.push({
          sprite: piece,
          vx: dx * speed + rand(-80, 80),
          vy: dy * speed - rand(200, 600),
          spin: rand(-6, 6),
          gravity: 1400,
          drag: 0.4,
          life: 0,
          max: rand(1.1, 1.6),
          scale0: sx,
          scale1: sx * 0.6,
          alpha0: 1,
        });
      }
    }
    this.bossSprite.visible = false;
    this.glow.visible = false;
    this.aura.visible = false;
  }
}
