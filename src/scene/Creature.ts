import { Container, Graphics, MeshPlane, Point, type Texture } from 'pixi.js';

/**
 * A painted enemy brought to life. The art is one flat cut-out, so all of the
 * life comes from a deformable mesh: the feet stay planted while the body bends,
 * breathes, jiggles where it is struck, and lags behind its own movement. On top
 * of that runs a small behavior loop: hopping or stomping around the arena,
 * taunting, roaring, turning, rearing back before a blow and lunging at you.
 */

interface Spring {
  x: number;
  v: number;
}

const stepSpring = (s: Spring, dt: number, k: number, c: number) => {
  s.v += (-k * s.x - c * s.v) * dt;
  s.x += s.v * dt;
};

interface Ripple {
  x: number;
  y: number;
  age: number;
  amp: number;
}

export interface CreatureState {
  hpPct: number;
  /** 0–1 while the creature rears back before a cosmetic blow. */
  charge: number;
  windup: boolean;
  dormant: boolean;
  passive: boolean;
}

type ActKind = 'roam' | 'bounce' | 'wiggle' | 'turn' | 'roar' | 'look' | 'stumble';

interface Act {
  kind: ActKind;
  t: number;
  dur: number;
  dir: number;
  hops: number;
  /** Where the current step lands (roam only). */
  target?: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// Glow textures are baked at a quarter size with this much padding (see RaidScene.bakeGlow).
export const GLOW_SHRINK = 0.25;
export const GLOW_PAD = 40;

const GRID_X = 10;
const GRID_Y = 14;

export class Creature {
  /** Sits on the floor where the creature stands; the scene positions it. */
  readonly root = new Container();
  private rig = new Container();
  private shadow = new Graphics();
  readonly body: MeshPlane;
  readonly glow: MeshPlane;
  private base!: Float32Array;
  private glowBase!: Float32Array;
  private tw = 1;
  private th = 1;

  /** Screen pixels per texture pixel at full size. */
  scale = 1;
  /** How far left and right of center it may wander, in screen pixels. */
  range = 100;
  /** Extra size from losing HP (1 = full), eased by the scene. */
  shownScale = 1;
  /** Fired when it lands from a hop or stomp, for dust, shake and sound. */
  onLand?: (strength: number) => void;
  onRoar?: () => void;

  private time = 0;
  private x = 0;
  private hop = 0;
  private hopVel = 0;
  private facing = 1;
  private faceShown = 1;
  private act?: Act;
  private nextThink = 1.2;
  private entering = 0;
  private lungeT = -1;
  private lungeBig = false;
  private lungeSide = 1;

  private jig: Spring = { x: 0, v: 0 };
  private jigY: Spring = { x: 0, v: 0 };
  private recoil: Spring = { x: 0, v: 0 };
  private push: Spring = { x: 0, v: 0 };
  private knockX: Spring = { x: 0, v: 0 };
  private ripples: Ripple[] = [];
  private lastX = 0;
  private dead = false;

  readonly light: boolean;

  constructor(texture: Texture, glowTexture: Texture, light: boolean) {
    this.light = light;
    this.glow = new MeshPlane({ texture: glowTexture, verticesX: GRID_X, verticesY: GRID_Y });
    this.glow.blendMode = 'add';
    this.glow.scale.set(1 / GLOW_SHRINK);
    this.glow.position.set(-GLOW_PAD / GLOW_SHRINK, -GLOW_PAD / GLOW_SHRINK);
    this.body = new MeshPlane({ texture, verticesX: GRID_X, verticesY: GRID_Y });
    this.shadow.ellipse(0, 0, 100, 18).fill({ color: 0x000000, alpha: 0.45 });
    this.rig.addChild(this.glow, this.body);
    this.root.addChild(this.shadow, this.rig);
    this.setTexture(texture, glowTexture);
  }

  setTexture(texture: Texture, glowTexture: Texture) {
    this.body.texture = texture;
    this.glow.texture = glowTexture;
    this.tw = texture.width;
    this.th = texture.height;
    this.base = Float32Array.from(this.body.geometry.positions);
    this.glowBase = Float32Array.from(this.glow.geometry.positions);
    this.rig.pivot.set(this.tw / 2, this.th);
  }

  /** On-screen height at the current size, in screen pixels. */
  get height() {
    return this.th * this.scale * this.shownScale;
  }

  /** The middle of the body, in the parent's coordinates (it moves as it does). */
  center() {
    return {
      x: this.root.x + this.rig.x,
      y: this.root.y + this.rig.y - this.th * Math.abs(this.rig.scale.y) * 0.5,
    };
  }

  /** Drops (boss) or leaps (minion) into the arena. */
  enter() {
    this.entering = 0.0001;
  }

  /** Struck at a point in global coordinates; strength grows with the combo. */
  hurt(gx: number, gy: number, strength: number) {
    if (this.dead) return;
    const p = this.body.toLocal(new Point(gx, gy));
    const side = p.x < this.tw / 2 ? 1 : -1;
    this.ripples.push({ x: p.x, y: p.y, age: 0, amp: (this.light ? 0.07 : 0.05) * this.th * (0.8 + strength * 0.2) });
    if (this.ripples.length > 5) this.ripples.shift();
    this.recoil.v += side * (2.4 + strength * 0.6);
    this.jig.v += side * (1.6 + strength * 0.4);
    this.push.v -= 3 + strength;
    this.knockX.v += side * (this.light ? 520 : 260);
    if (this.light) this.hopVel = Math.max(this.hopVel, 260 + strength * 40);
    // Getting hit interrupts whatever it was doing, except a hop already in the air.
    if (this.act && this.act.kind !== 'roam') this.act = undefined;
    this.nextThink = Math.max(this.nextThink, rand(0.5, 1));
  }

  /** The cosmetic attack: surges at the camera, then recovers. */
  lunge(big: boolean) {
    if (this.dead) return;
    this.lungeT = 0;
    this.lungeBig = big;
    this.lungeSide = Math.random() < 0.5 ? -1 : 1;
    this.act = undefined;
  }

  /** Powers up: rears back and shakes. */
  roar() {
    if (this.dead) return;
    this.act = { kind: 'roar', t: 0, dur: 1.1, dir: 1, hops: 0 };
  }

  /** A big hit took a chunk off: it reels. */
  stagger() {
    this.recoil.v += (Math.random() < 0.5 ? -1 : 1) * 7;
    this.jigY.v -= 3;
    this.act = { kind: 'stumble', t: 0, dur: 0.9, dir: Math.random() < 0.5 ? -1 : 1, hops: 0 };
  }

  freeze() {
    this.dead = true;
  }

  // ------------------------------------------------------------------ frame

  update(dt: number, st: CreatureState) {
    if (this.dead) return;
    this.time += dt;
    const t = this.time;
    const L = this.light;
    const low = st.hpPct < 0.25;

    stepSpring(this.jig, dt, 90, 7);
    stepSpring(this.jigY, dt, 240, 11);
    stepSpring(this.recoil, dt, 160, 10);
    stepSpring(this.push, dt, 200, 14);
    stepSpring(this.knockX, dt, 60, 12);

    // --- behavior
    if (st.dormant) {
      this.act = undefined;
      this.x += (0 - this.x) * Math.min(1, dt * 2);
    } else if (this.entering === 0 && this.lungeT < 0 && st.charge === 0) {
      this.nextThink -= dt;
      if (!this.act && this.nextThink <= 0 && this.hop === 0) this.think(st, low);
    }
    if (this.act) this.runAct(this.act, dt, st);

    // --- hop physics (heavy creatures barely leave the ground)
    if (this.hop < 0 || this.hopVel > 0) {
      this.hopVel -= (L ? 2600 : 3200) * dt;
      this.hop -= this.hopVel * dt;
      if (this.hop >= 0) {
        const impact = Math.min(1, Math.abs(this.hopVel) / (L ? 900 : 500));
        this.hop = 0;
        this.hopVel = 0;
        this.jigY.v -= (L ? 4 : 3) * (0.4 + impact);
        this.onLand?.(L ? impact * 0.4 : 0.5 + impact * 0.5);
      }
    }

    // --- entrance: falls from above the frame and lands hard
    let enterY = 0;
    let enterX = 0;
    if (this.entering > 0) {
      this.entering += dt / (L ? 0.7 : 0.9);
      const k = Math.min(1, this.entering);
      enterY = -(1 - k * k) * this.height * 1.6;
      if (L) enterX = (1 - k) * this.range * 2.2 * this.facing * -1;
      if (k >= 1) {
        this.entering = 0;
        this.jigY.v -= 6;
        this.onLand?.(L ? 0.6 : 1);
      }
    }

    // --- lunge at the camera
    let lungeAmt = 0;
    if (this.lungeT >= 0) {
      this.lungeT += dt;
      const k = this.lungeT;
      lungeAmt = k < 0.11 ? Math.sin((k / 0.11) * (Math.PI / 2)) : Math.max(0, 1 - (k - 0.11) / 0.5) ** 2;
      if (k > 0.65) this.lungeT = -1;
    }

    // --- facing flips through zero, which reads as turning around
    this.faceShown += (this.facing - this.faceShown) * Math.min(1, dt * 14);

    // Secondary motion: the top of the body lags behind horizontal movement.
    const vx = (this.x - this.lastX) / Math.max(dt, 1e-3);
    this.lastX = this.x;
    this.jig.v -= vx * dt * 0.012;

    // --- pose
    const swaySpeed = low ? 4.2 : L ? 2.4 : 1.4;
    let bend = Math.sin(t * swaySpeed) * (L ? 0.035 : 0.025) + this.jig.x * 0.05;
    let breath = Math.sin(t * (L ? 3.2 : 2)) * (L ? 0.025 : 0.02);
    let sx = 1;
    let sy = 1;
    let rot = this.recoil.x * 0.03;
    let idleBounce = 0;

    if (st.dormant) {
      // Asleep while the machine runs: slumped, slow deep breaths.
      breath = Math.sin(t * 1.1) * 0.05;
      sy -= 0.07 + Math.sin(t * 1.1) * 0.025;
      sx += 0.04;
      bend = 0.05 + Math.sin(t * 0.55) * 0.015;
    } else if (L && this.hop === 0 && !this.act && this.entering === 0) {
      // Minions never stand still: a constant springy bounce on the spot.
      const b = Math.abs(Math.sin(t * 5.2));
      idleBounce = -b * this.height * 0.05;
      sy += (b - 0.5) * 0.06;
      sx -= (b - 0.5) * 0.04;
    }
    if (this.hop < 0) {
      // Stretch on the way up, round out at the top.
      const s = clamp(this.hopVel / 900, -0.12, 0.12);
      sy += Math.abs(s);
      sx -= Math.abs(s) * 0.6;
    }
    if (st.charge > 0) {
      // Rears up and back before it swings.
      sy += st.charge * 0.1;
      sx -= st.charge * 0.05;
      bend -= st.charge * 0.06 * this.facing;
      rot += (Math.random() - 0.5) * 0.02 * st.charge;
    }
    if (st.windup) {
      const p = 0.5 + 0.5 * Math.sin(t * 14);
      sx += 0.04 * p;
      sy += 0.03 * p;
      rot += (Math.random() - 0.5) * 0.03;
    }
    if (low && !st.dormant) rot += (Math.random() - 0.5) * 0.02;

    let lungeScale = 1;
    let lungeY = 0;
    if (lungeAmt > 0) {
      lungeScale = 1 + lungeAmt * (this.lungeBig ? 0.5 : 0.35);
      lungeY = lungeAmt * this.height * 0.22;
      rot += lungeAmt * 0.12 * this.lungeSide;
      bend += lungeAmt * 0.06 * this.lungeSide;
    }

    const squash = clamp(this.jigY.x * 0.06, -0.25, 0.25);
    sy *= 1 + squash;
    sx *= 1 - squash * 0.7;
    const pushK = 1 + clamp(this.push.x * 0.02, -0.15, 0.1);

    const s = this.scale * this.shownScale * lungeScale * pushK;
    this.rig.scale.set(s * sx * this.faceShown, s * sy);
    this.rig.rotation = rot;
    this.rig.position.set(this.x + this.knockX.x * 0.12 + enterX, this.hop + idleBounce + enterY + lungeY);

    const air = Math.min(1, -(this.hop + idleBounce + enterY) / (this.height * 0.6 + 1));
    const shadowW = this.tw * this.scale * this.shownScale * 0.32 * lungeScale;
    this.shadow.position.set(this.rig.x, lungeY * 0.6);
    this.shadow.scale.set((shadowW / 100) * (1 - air * 0.5), (shadowW / 100) * (1 - air * 0.5));
    this.shadow.alpha = st.dormant ? 0.7 : 1 - air * 0.7;

    this.deform(dt, bend, breath);
  }

  private think(st: CreatureState, low: boolean) {
    const L = this.light;
    const r = Math.random();
    const toward = () => {
      const target = rand(-this.range, this.range);
      return target > this.x ? 1 : -1;
    };
    if (low && r < 0.25) {
      this.act = { kind: 'stumble', t: 0, dur: 1, dir: Math.random() < 0.5 ? -1 : 1, hops: 0 };
    } else if (L) {
      if (r < 0.45) this.act = { kind: 'roam', t: 0, dur: 0, dir: toward(), hops: Math.floor(rand(2, 5)) };
      else if (r < 0.65) this.act = { kind: 'bounce', t: 0, dur: 0, dir: 1, hops: 3 };
      else if (r < 0.85) this.act = { kind: 'wiggle', t: 0, dur: 0.9, dir: 1, hops: 0 };
      else this.act = { kind: 'turn', t: 0, dur: 0.5, dir: -this.facing, hops: 0 };
    } else {
      if (r < 0.5) this.act = { kind: 'roam', t: 0, dur: 0, dir: toward(), hops: Math.floor(rand(2, 4)) };
      else if (r < 0.72 && !st.passive && !st.windup) this.act = { kind: 'roar', t: 0, dur: 1.3, dir: 1, hops: 0 };
      else this.act = { kind: 'look', t: 0, dur: 1.6, dir: Math.random() < 0.5 ? -1 : 1, hops: 0 };
    }
    this.nextThink = L ? rand(0.4, 1.4) : rand(1, 2.6);
  }

  private runAct(a: Act, dt: number, st: CreatureState) {
    a.t += dt;
    const L = this.light;
    switch (a.kind) {
      case 'roam': {
        // A string of hops (minion) or heavy steps (boss) toward one side.
        if (this.hop === 0 && this.hopVel === 0) {
          if (a.hops <= 0) {
            this.act = undefined;
            return;
          }
          const stepLen = (L ? 0.32 : 0.22) * this.range;
          if (Math.abs(this.x + a.dir * stepLen) > this.range) a.dir = -a.dir;
          // Only minions turn around; a big painted boss keeps facing you.
          if (L) this.facing = a.dir;
          this.hopVel = L ? rand(520, 700) : 330;
          this.jigY.v += 2;
          a.hops--;
          a.target = this.x + a.dir * stepLen;
        }
        // Drift toward the step target while airborne.
        this.x += ((a.target ?? this.x) - this.x) * Math.min(1, dt * (L ? 9 : 6));
        break;
      }
      case 'bounce':
        if (this.hop === 0 && this.hopVel === 0) {
          if (a.hops <= 0) {
            this.act = undefined;
            return;
          }
          this.hopVel = rand(380, 520);
          a.hops--;
        }
        break;
      case 'wiggle':
        this.recoil.x = Math.sin(a.t * 22) * 2.2;
        this.jig.x = Math.sin(a.t * 22 + 1) * 0.8;
        if (a.t >= a.dur) this.act = undefined;
        break;
      case 'turn':
        this.facing = a.dir;
        if (a.t >= a.dur) this.act = undefined;
        break;
      case 'roar': {
        // Rears up, then shakes with rage. Bosses only.
        const k = a.t / a.dur;
        if (k < 0.25) this.jigY.x = -(k / 0.25) * 1.8;
        else {
          if (a.hops === 0) {
            a.hops = 1;
            this.onRoar?.();
          }
          this.recoil.x = (Math.random() - 0.5) * 1.5;
          this.jig.x = Math.sin(a.t * 30) * 0.5;
        }
        if (k >= 1) this.act = undefined;
        break;
      }
      case 'look':
        this.jig.x += (a.dir * 1.5 - this.jig.x) * Math.min(1, dt * 4) * (a.t < a.dur * 0.7 ? 1 : -1);
        if (a.t >= a.dur) this.act = undefined;
        break;
      case 'stumble':
        this.recoil.x += (a.dir * 3 - this.recoil.x) * Math.min(1, dt * 5) * (a.t < a.dur * 0.5 ? 1 : -0.6);
        if (a.t >= a.dur) this.act = undefined;
        break;
    }
    if (st.dormant) this.act = undefined;
  }

  /** Bends the mesh: feet planted, the top sways the most. */
  private deform(dt: number, bend: number, breath: number) {
    const tw = this.tw;
    const th = this.th;
    for (const r of this.ripples) r.age += dt;
    this.ripples = this.ripples.filter((r) => r.age < 0.9);

    const disp = (x: number, y: number, out: number[]) => {
      const h = clamp(1 - y / th, 0, 1.15);
      const nx = (x - tw / 2) / (tw / 2);
      let dx = bend * th * h * h;
      let dy = -breath * th * 0.35 * h;
      dx += nx * breath * tw * 0.5 * Math.sin(Math.PI * clamp(h, 0, 1));
      for (const r of this.ripples) {
        const ddx = x - r.x;
        const ddy = y - r.y;
        const d = Math.sqrt(ddx * ddx + ddy * ddy) + 1;
        const fall = Math.exp(-d / (th * 0.45)) * Math.exp(-r.age * 5);
        const wave = Math.sin(r.age * 34 - d * (12 / th)) * r.amp * fall;
        dx += (ddx / d) * wave;
        dy += (ddy / d) * wave;
      }
      out[0] = dx;
      out[1] = dy * clamp(h * 3, 0, 1);
    };

    const o = [0, 0];
    const pos = this.body.geometry.positions;
    const base = this.base;
    for (let i = 0; i < base.length; i += 2) {
      disp(base[i], base[i + 1], o);
      pos[i] = base[i] + o[0];
      pos[i + 1] = base[i + 1] + o[1];
    }
    this.body.geometry.getBuffer('aPosition').update();

    // Same bend for the glow, mapped from its padded quarter-size texture.
    const g = this.glow.geometry.positions;
    const gb = this.glowBase;
    const k = 1 / GLOW_SHRINK;
    for (let i = 0; i < gb.length; i += 2) {
      disp((gb[i] - GLOW_PAD) * k, (gb[i + 1] - GLOW_PAD) * k, o);
      g[i] = gb[i] + o[0] * GLOW_SHRINK;
      g[i + 1] = gb[i + 1] + o[1] * GLOW_SHRINK;
    }
    this.glow.geometry.getBuffer('aPosition').update();
  }
}
