import {
  AdditiveBlending,
  BufferAttribute,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  BoxGeometry,
  Box3,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { AnimationMixer, LoopRepeat } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { piece } from './assets';

/**
 * The monsters: every enemy is its own creature, built from simple shapes
 * and the lairs' props, and animated in code. A slime king that wobbles, a
 * bedsheet ghost that billows, a golem made of boxes that stomps. They share
 * one small rig (body, head, mouth, arms, hands, tails) and one set of moves,
 * so the fight code drives them exactly like the hero: play "attack", "hit",
 * "taunt", "death" and wait for them to finish.
 */

export type CreatureId =
  | 'king'
  | 'lich'
  | 'warlord'
  | 'colossus'
  | 'kraken'
  | 'dragon'
  | 'devil'
  | 'troll'
  | 'sock'
  | 'grease'
  | 'dust'
  | 'slug'
  | 'pillow'
  | 'crumb'
  | 'rat';

interface PlayOptions {
  fade?: number;
  speed?: number;
  hold?: boolean;
}

type Motion = 'idle' | 'brace' | 'slump' | 'walk' | 'attack' | 'hit' | 'taunt' | 'death' | 'spawn' | 'raise' | 'down' | 'up' | 'bob';

const LOOPS: Record<string, Motion> = {
  Spellcasting: 'brace',
  Blocking: 'brace',
  '2H_Melee_Idle': 'brace',
  Lie_Idle: 'slump',
  Sit_Floor_Idle: 'slump',
};

function motionOf(clip: string): Motion {
  if (LOOPS[clip]) return LOOPS[clip];
  if (clip.startsWith('Walking') || clip.startsWith('Running')) return 'walk';
  if (clip.startsWith('Idle')) return 'idle';
  if (clip.includes('Attack') || clip === 'Spellcast_Shoot') return 'attack';
  if (clip.startsWith('Hit') || clip === 'Block_Hit') return 'hit';
  if (clip.startsWith('Death')) return 'death';
  if (clip === 'Taunt' || clip === 'Cheer') return 'taunt';
  if (clip.startsWith('Spawn') || clip.startsWith('Skeletons_Awaken')) return 'spawn';
  if (clip === 'Spellcast_Raise' || clip === 'Spellcast_Long') return 'raise';
  if (clip === 'Lie_Down' || clip === 'Sit_Floor_Down') return 'down';
  if (clip === 'Lie_StandUp' || clip === 'Sit_Floor_StandUp') return 'up';
  return 'bob';
}

const DURATION: Record<Motion, number> = {
  idle: 2,
  brace: 1,
  slump: 2,
  walk: 0.8,
  attack: 1.05,
  hit: 0.55,
  taunt: 1.5,
  death: 1.6,
  spawn: 1.3,
  raise: 1.1,
  down: 0.8,
  up: 0.8,
  bob: 0.7,
};

/** One pose, as a handful of numbers the rig knows how to show. */
interface Pose {
  lift: number;
  lean: number;
  squash: number;
  arms: number;
  armR: number;
  spread: number;
  jaw: number;
  shake: number;
  tilt: number;
  forward: number;
  /** Overall size: 1 normally, shrinking to nothing as some creatures die. */
  size: number;
}

const REST: Pose = { lift: 0, lean: 0, squash: 1, arms: -0.15, armR: -0.15, spread: 0.15, jaw: 0.1, shake: 0, tilt: 0, forward: 0, size: 1 };

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
function mix(a: Pose, b: Pose, k: number): Pose {
  const o = { ...a };
  for (const key of Object.keys(a) as (keyof Pose)[]) o[key] = lerp(a[key], b[key], k);
  return o;
}

interface Tail {
  nodes: Object3D[];
  amp: number;
  speed: number;
  axis: 'x' | 'z';
  phase: number;
}

export interface Rig {
  /** Squash and lean pivot, at the creature's feet. */
  body: Group;
  head?: Object3D;
  /** The mouth: opened by scaling (a dark hollow) or rotating (a hinged lid or jaw). */
  jaw?: Object3D;
  jawMode?: 'scale' | 'rot';
  jawRest?: number;
  armL?: Object3D;
  armR?: Object3D;
  legs?: Object3D[];
  tails?: Tail[];
  /** Hovers this far off the floor. */
  float?: number;
  /** Per-frame flourish: slime jiggle, cloth flutter, a spinning vortex. */
  wobble?: (t: number, agitation: number, dt: number) => void;
  /** How it dies: melts flat, topples, or blows apart. */
  death?: 'melt' | 'topple' | 'vanish';
}

interface Running {
  motion: Motion;
  t: number;
  dur: number;
  hold: boolean;
  /** Held moves keep their last pose but still report that they finished. */
  done?: boolean;
  resolve: () => void;
}

interface Walk {
  from: Vector3;
  to: Vector3;
  t: number;
  dur: number;
  resolve: () => void;
}

export class Creature {
  readonly root = new Group();
  readonly model = new Group();
  readonly rig: Rig;
  readonly extras: Extras;
  idle = 'Idle';
  private loopName = 'Idle';
  private loopMotion: Motion = 'idle';
  private prevLoop: Motion = 'idle';
  private loopBlend = 1;
  private loopFade = 0.25;
  private action?: Running;
  private walk?: Walk;
  private time = Math.random() * 10;
  private agitation = 0;
  /** How far the body reaches out in front, at size 1 (the fight keeps the hero clear of it). */
  front = 0.7;

  constructor(rig: Rig, extras: Extras) {
    this.rig = rig;
    this.extras = extras;
    this.root.add(this.model);
    this.model.add(rig.body);
  }

  has() {
    return true;
  }

  duration(name: string) {
    return DURATION[motionOf(name)];
  }

  loop(name: string, o: PlayOptions = {}) {
    if (name === this.loopName && !this.action) return;
    this.prevLoop = this.loopMotion;
    this.loopName = name;
    this.loopMotion = motionOf(name);
    this.loopBlend = 0;
    this.loopFade = o.fade ?? 0.25;
    if (this.action && !this.action.hold) this.finish();
    else if (this.action?.hold) this.action = undefined;
  }

  once(name: string, o: PlayOptions = {}): Promise<void> {
    this.finish();
    const motion = motionOf(name);
    return new Promise((resolve) => {
      this.action = { motion, t: 0, dur: DURATION[motion] / Math.max(0.1, o.speed ?? 1), hold: !!o.hold, resolve };
    });
  }

  private finish() {
    const a = this.action;
    if (!a) return;
    this.action = undefined;
    if (!a.done) a.resolve();
  }

  walkTo(to: Vector3, speed = 1.6, clip = 'Walking_A'): Promise<void> {
    const from = this.root.position.clone();
    const dist = from.distanceTo(to);
    if (dist < 0.01) return Promise.resolve();
    this.walk?.resolve();
    this.loop(clip);
    return new Promise((resolve) => {
      this.walk = { from, to: to.clone(), t: 0, dur: dist / speed, resolve };
    });
  }

  face(target: Vector3) {
    const d = target.clone().sub(this.root.position);
    this.root.rotation.y = Math.atan2(d.x, d.z);
  }

  part(name: string): Object3D | undefined {
    return this.root.getObjectByName(name.replace(/\./g, ''));
  }

  attach(prop: Object3D, bone = 'handslot.r') {
    this.part(bone)?.add(prop);
  }

  tint(_part: string, _color: number) {}

  glow(partName: string, color: number, intensity = 2) {
    this.part(partName)?.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as MeshStandardMaterial).clone();
      mat.emissive = new Color(color);
      mat.emissiveIntensity = intensity;
      m.material = mat;
    });
  }

  get walking() {
    return !!this.walk;
  }

  private posed(m: Motion, u: number, t: number): Pose {
    const p = { ...REST };
    const s = Math.sin;
    switch (m) {
      case 'idle':
      case 'bob':
        p.lift = s(t * 2.2) * 0.05;
        p.squash = 1 + s(t * 2.2) * 0.035;
        p.arms = -0.2 + s(t * 1.7) * 0.12;
        p.armR = -0.25 + s(t * 1.7 + 1) * 0.12;
        p.jaw = 0.15 + s(t * 1.3) * 0.1;
        p.lean = s(t * 0.9) * 0.04;
        break;
      case 'brace':
        p.lean = -0.28;
        p.arms = -2.5;
        p.armR = -2.7;
        p.spread = 0.5;
        p.jaw = 0.75 + s(t * 9) * 0.15;
        p.shake = 0.035;
        p.squash = 1.08;
        p.lift = 0.08;
        break;
      case 'slump':
        p.squash = 0.72;
        p.lean = 0.35;
        p.arms = 0.25;
        p.armR = 0.25;
        p.jaw = 0.05;
        p.lift = s(t * 1.2) * 0.02;
        break;
      case 'walk':
        p.lift = Math.abs(s(t * 9)) * 0.14;
        p.squash = 1 - Math.abs(s(t * 9)) * 0.06 + 0.03;
        p.arms = s(t * 9) * 0.5 - 0.2;
        p.armR = -s(t * 9) * 0.5 - 0.2;
        p.tilt = s(t * 4.5) * 0.08;
        p.lean = 0.12;
        p.jaw = 0.25;
        break;
      case 'attack': {
        // Wind back, slam forward on ~45% (when the fight code lands the blow), recover.
        const wind = smooth(u / 0.36);
        const strike = smooth((u - 0.36) / 0.1);
        const back = smooth((u - 0.6) / 0.4);
        p.lean = lerp(lerp(0, -0.35, wind), 0.5, strike) * (1 - back);
        p.armR = lerp(lerp(-0.2, -2.8, wind), 0.6, strike) * (1 - back) - 0.2 * back;
        p.arms = lerp(lerp(-0.2, -1.6, wind), 0.2, strike) * (1 - back) - 0.2 * back;
        p.squash = lerp(lerp(1, 1.12, wind), 0.82, strike) * (1 - back) + back;
        p.jaw = lerp(lerp(0.2, 0.7, wind), 1, strike) * (1 - back) + 0.15 * back;
        p.forward = lerp(0, 0.35, strike) * (1 - back);
        p.lift = lerp(0, 0.15, wind) * (1 - strike);
        break;
      }
      case 'hit': {
        const k = s(Math.PI * Math.min(1, u * 1.3));
        p.lean = -0.45 * k;
        p.squash = 1 - 0.18 * k;
        p.jaw = 0.9 * k;
        p.arms = -0.2 - 0.8 * k;
        p.armR = -0.2 - 0.8 * k;
        p.spread = 0.15 + 0.6 * k;
        p.shake = 0.05 * k;
        p.forward = -0.25 * k;
        break;
      }
      case 'taunt': {
        const k = smooth(u / 0.25) * (1 - smooth((u - 0.8) / 0.2));
        p.lean = -0.3 * k;
        p.lift = 0.25 * k;
        p.squash = 1 + 0.15 * k;
        p.arms = -0.2 - 2.2 * k;
        p.armR = -0.2 - 2.2 * k;
        p.spread = 0.15 + 0.9 * k;
        p.jaw = 0.15 + 0.95 * k;
        p.shake = 0.06 * k;
        break;
      }
      case 'death': {
        const k = smooth(u);
        const how = this.rig.death ?? 'topple';
        p.jaw = 1 - k * 0.6;
        p.arms = lerp(-1.5, 0.6, k);
        p.armR = lerp(-1.8, 0.6, k);
        p.spread = 0.9 * k;
        if (how === 'melt') {
          p.squash = lerp(1.15, 0.2, k);
          p.size = lerp(1, 0.55, k);
          p.lift = -(this.rig.float ?? 0) * k;
        } else if (how === 'vanish') {
          p.size = lerp(1, 0.02, smooth(u * 1.2));
          p.lift = 0.8 * k;
          p.tilt = k * 3;
        } else {
          p.tilt = 1.45 * smooth(u * 1.3);
          p.lift = -(this.rig.float ?? 0) * k;
          p.squash = 1 - 0.15 * k;
        }
        p.shake = 0.05 * (1 - k);
        break;
      }
      case 'spawn': {
        const k = smooth(u / 0.7);
        p.lift = lerp(-2.4, 0, k) + s(Math.PI * smooth((u - 0.6) / 0.4)) * 0.15;
        p.squash = lerp(0.4, 1, k) + 0.15 * s(Math.PI * smooth((u - 0.6) / 0.4));
        p.jaw = 0.8;
        p.arms = -2;
        p.armR = -2;
        break;
      }
      case 'raise':
        p.arms = -2.8;
        p.armR = -2.8;
        p.lift = 0.2 * s(Math.PI * u);
        p.jaw = 0.6;
        p.spread = 0.4;
        break;
      case 'down':
        return mix(this.posed('idle', 0, t), this.posed('slump', 0, t), smooth(u));
      case 'up':
        return mix(this.posed('slump', 0, t), this.posed('idle', 0, t), smooth(u));
    }
    return p;
  }

  update(dt: number) {
    this.time += dt;
    const t = this.time;
    const w = this.walk;
    if (w) {
      w.t += dt;
      const k = Math.min(1, w.t / w.dur);
      this.root.position.lerpVectors(w.from, w.to, k);
      const d = w.to.clone().sub(w.from);
      let diff = Math.atan2(d.x, d.z) - this.root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.root.rotation.y += diff * Math.min(1, dt * 10);
      if (k >= 1) {
        this.walk = undefined;
        this.loop(this.idle);
        w.resolve();
      }
    }

    this.loopBlend = Math.min(1, this.loopBlend + dt / Math.max(0.01, this.loopFade));
    let pose = mix(this.posed(this.prevLoop, 0, t), this.posed(this.loopMotion, 0, t), smooth(this.loopBlend));
    const a = this.action;
    if (a) {
      a.t += dt;
      const u = Math.min(1, a.t / a.dur);
      const inW = smooth(a.t / 0.08);
      const outW = a.hold ? 1 : 1 - smooth((u - 0.88) / 0.12);
      pose = mix(pose, this.posed(a.motion, u, t), Math.min(inW, outW));
      if (u >= 1 && !a.hold) this.finish();
      else if (u >= 1) {
        a.t = a.dur;
        if (!a.done) {
          a.done = true;
          a.resolve();
        }
      }
    }
    const busy = a && (a.motion === 'attack' || a.motion === 'taunt' || a.motion === 'hit');
    const brace = this.loopMotion === 'brace';
    this.agitation = lerp(this.agitation, busy || brace ? 1 : 0, Math.min(1, dt * 4));
    this.apply(pose, t, dt);
  }

  private apply(p: Pose, t: number, dt: number) {
    const r = this.rig;
    const b = r.body;
    const float = (r.float ?? 0) * (1 + Math.sin(t * 1.6) * 0.15);
    b.position.set(Math.sin(t * 37) * p.shake, float + p.lift, p.forward);
    b.rotation.set(p.lean, 0, p.tilt + Math.sin(t * 41) * p.shake * 0.6);
    // Squash keeps its volume, but only so far: a flattened creature must not
    // spread across the whole floor.
    const sq = Math.max(0.05, p.squash);
    const side = Math.min(1.35, 1 / Math.sqrt(sq));
    const size = Math.max(0.001, p.size);
    b.scale.set(side * size, sq * size, side * size);
    if (r.head) r.head.rotation.x = -p.lean * 0.4 + Math.sin(t * 1.1) * 0.03;
    if (r.armL) r.armL.rotation.set(p.arms, 0, p.spread);
    if (r.armR) r.armR.rotation.set(p.armR, 0, -p.spread);
    if (r.jaw) {
      const open = Math.max(0, Math.min(1.2, p.jaw));
      if (r.jawMode === 'rot') r.jaw.rotation.x = (r.jawRest ?? 0) - open * 0.7;
      else r.jaw.scale.y = 0.15 + open;
    }
    r.legs?.forEach((leg, i) => (leg.rotation.x = this.loopMotion === 'walk' ? Math.sin(t * 9 + i * Math.PI) * 0.5 : 0));
    for (const tail of r.tails ?? []) {
      const amp = tail.amp * (1 + this.agitation * 1.2);
      tail.nodes.forEach((n, i) => {
        const v = Math.sin(t * tail.speed * (1 + this.agitation * 0.8) + tail.phase - i * 0.7) * amp;
        if (tail.axis === 'x') n.rotation.x = v;
        else n.rotation.z = v;
      });
    }
    r.wobble?.(t, this.agitation, dt);
    this.extras.update(dt, t);
  }
}

// ------------------------------------------------------------------ extras

let dot: CanvasTexture | undefined;
function dotTexture() {
  if (dot) return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  dot = new CanvasTexture(c);
  return dot;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Things around a creature that are not part of its body: orbiting junk, motes, flies, a glow. */
export class Extras {
  private floaters: { obj: Object3D; radius: number; height: number; speed: number; phase: number; bob: number; spin: Vector3 }[] = [];
  private motes: { s: Sprite; vel: Vector3; life: number; max: number; from: () => Vector3; size: number; fade: number }[] = [];
  private flies: { m: Mesh; phase: number; r: number; speed: number }[] = [];
  private flyCenter?: Object3D;
  light?: PointLight;
  root: Group;

  constructor(root: Group) {
    this.root = root;
  }

  update(dt: number, t: number) {
    for (const f of this.floaters) {
      const a = t * f.speed + f.phase;
      f.obj.position.set(Math.cos(a) * f.radius, f.height + Math.sin(t * 2 + f.phase) * f.bob, Math.sin(a) * f.radius);
      f.obj.rotation.x += f.spin.x * dt;
      f.obj.rotation.y += f.spin.y * dt;
      f.obj.rotation.z += f.spin.z * dt;
    }
    for (const p of this.motes) {
      p.life -= dt;
      if (p.life <= 0) {
        p.life = p.max * rand(0.6, 1);
        p.s.position.copy(p.from());
      }
      p.s.position.addScaledVector(p.vel, dt);
      const k = 1 - p.life / p.max;
      p.s.scale.setScalar(p.size * (0.5 + k));
      (p.s.material as SpriteMaterial).opacity = Math.sin(Math.PI * Math.min(1, k)) * p.fade;
    }
    if (this.flyCenter && this.flies.length) {
      const c = new Vector3();
      this.flyCenter.getWorldPosition(c);
      this.root.worldToLocal(c);
      for (const f of this.flies) {
        const a = t * f.speed + f.phase;
        f.m.position.set(c.x + Math.cos(a) * f.r, c.y + Math.sin(a * 1.7) * 0.3, c.z + Math.sin(a * 1.3) * f.r);
      }
    }
    if (this.light) this.light.intensity = this.light.userData.base * (0.8 + Math.sin(t * 5) * 0.12 + Math.sin(t * 13) * 0.08);
  }

  orbit(obj: Object3D, radius: number, height: number, speed: number, phase: number, bob = 0.15) {
    this.root.add(obj);
    this.floaters.push({ obj, radius, height, speed, phase, bob, spin: new Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)) });
  }

  stream(n: number, color: number, from: () => Vector3, vel: () => Vector3, life: number, size: number, opts: { additive?: boolean; fade?: number } = {}) {
    for (let i = 0; i < n; i++) {
      const s = new Sprite(
        new SpriteMaterial({ map: dotTexture(), color, transparent: true, depthWrite: false, blending: opts.additive ? AdditiveBlending : undefined, opacity: 0 }),
      );
      s.position.copy(from());
      this.root.add(s);
      this.motes.push({ s, vel: vel(), life: rand(0, life), max: life, from, size, fade: opts.fade ?? 0.8 });
    }
  }

  swarm(center: Object3D, n: number) {
    this.flyCenter = center;
    const mat = mat3(0x111111, { roughness: 0.4 });
    const geo = new SphereGeometry(0.05, 5, 4);
    for (let i = 0; i < n; i++) {
      const m = new Mesh(geo, mat);
      this.root.add(m);
      this.flies.push({ m, phase: rand(0, Math.PI * 2), r: rand(0.4, 0.9), speed: rand(4, 9) * (Math.random() < 0.5 ? -1 : 1) });
    }
  }

  glow(color: number, intensity: number, y: number, z = 1.6) {
    const l = new PointLight(color, intensity, 7, 1.6);
    l.userData.base = intensity;
    l.position.set(0, y, z);
    this.root.add(l);
    this.light = l;
  }
}

// ------------------------------------------------------------------ parts

function mat3(color: number, o: Partial<MeshStandardMaterial> = {}) {
  return new MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, flatShading: true, ...o });
}

function glowMat(color: number, intensity = 2.5) {
  return new MeshStandardMaterial({ color, emissive: new Color(color), emissiveIntensity: intensity, roughness: 0.4 });
}

function mesh(geo: BufferGeometry, material: MeshStandardMaterial, x = 0, y = 0, z = 0) {
  const m = new Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function group(name = '', x = 0, y = 0, z = 0, ...kids: Object3D[]) {
  const g = new Group();
  g.name = name;
  g.position.set(x, y, z);
  if (kids.length) g.add(...kids);
  return g;
}

/** Bumps a geometry's surface for a lumpy, hand-made look. */
function lumpy(geo: BufferGeometry, amount: number, seed = 1) {
  const pos = geo.attributes.position as BufferAttribute;
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 5.1 + seed) * Math.sin(v.y * 4.3 + seed * 2) * Math.sin(v.z * 6.7 + seed * 3);
    v.multiplyScalar(1 + n * amount);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Angry eyes: white, a glowing pupil, a heavy brow. */
function eyes(spacing: number, size: number, pupil: number, opts: { white?: number; brow?: number; angle?: number } = {}) {
  const g = group('eyes');
  for (const side of [-1, 1]) {
    const e = mesh(new SphereGeometry(size, 12, 10), mat3(opts.white ?? 0xfffbe8, { flatShading: false, roughness: 0.3 }), side * spacing, 0, 0);
    e.scale.z = 0.6;
    const p = mesh(new SphereGeometry(size * 0.48, 10, 8), glowMat(pupil, 3), side * spacing, 0, size * 0.5);
    g.add(e, p);
    if (opts.brow !== undefined) {
      const brow = mesh(new BoxGeometry(size * 2.2, size * 0.45, size * 0.5), mat3(opts.brow), side * spacing, size * 0.95, size * 0.35);
      brow.rotation.z = side * (opts.angle ?? 0.45);
      g.add(brow);
    }
  }
  return g;
}

/** A dark mouth full of teeth that opens by scaling. */
function mouth(width: number, height: number, teeth = 6, color = 0x1a0606) {
  const g = group('mouth');
  const hole = mesh(new SphereGeometry(1, 16, 10), mat3(color, { flatShading: false }));
  hole.scale.set(width, height, height * 0.5);
  g.add(hole);
  const tooth = mat3(0xf4efd8);
  for (let i = 0; i < teeth; i++) {
    const x = (i / (teeth - 1) - 0.5) * width * 1.5;
    const top = mesh(new ConeGeometry(width * 0.09, height * 0.7, 4), tooth, x, height * 0.75, height * 0.3);
    top.rotation.x = Math.PI;
    const bottom = mesh(new ConeGeometry(width * 0.08, height * 0.55, 4), tooth, x * 0.9, -height * 0.75, height * 0.3);
    g.add(top, bottom);
  }
  return g;
}

/** An arm that hangs from a shoulder pivot, with a hand slot at its end. */
function arm(name: string, x: number, y: number, len: number, thick: number, material: MeshStandardMaterial, hand?: Object3D, handName?: string) {
  const pivot = group(name, x, y, 0);
  const limb = mesh(new CapsuleGeometry(thick, len, 4, 8), material, 0, -len / 2, 0);
  pivot.add(limb);
  const slot = group(handName ?? `${name}hand`, 0, -len - thick * 0.6, 0);
  if (hand) slot.add(hand);
  pivot.add(slot);
  return pivot;
}

/** A tentacle or tail: a chain of segments that waves. */
function chain(n: number, len: number, r0: number, r1: number, material: MeshStandardMaterial, dir: 1 | -1 = -1) {
  const nodes: Object3D[] = [];
  const root = new Group();
  let parent: Object3D = root;
  for (let i = 0; i < n; i++) {
    const r = lerp(r0, r1, i / Math.max(1, n - 1));
    const seg = group('', 0, i === 0 ? 0 : (dir * len) / n, 0);
    seg.add(mesh(new CapsuleGeometry(r, len / n, 3, 6), material, 0, (dir * len) / n / 2, 0));
    parent.add(seg);
    nodes.push(seg);
    parent = seg;
  }
  return { root, nodes };
}

export function sock(color: number, stripe = 0xffffff) {
  const g = new Group();
  const m = mat3(color);
  const leg = mesh(new CapsuleGeometry(0.07, 0.28, 4, 8), m);
  const foot = mesh(new CapsuleGeometry(0.07, 0.14, 4, 8), m, 0.08, -0.17, 0);
  foot.rotation.z = Math.PI / 2;
  const cuff = mesh(new TorusGeometry(0.07, 0.025, 6, 12), mat3(stripe), 0, 0.17, 0);
  cuff.rotation.x = Math.PI / 2;
  g.add(leg, foot, cuff);
  return g;
}

export function crown() {
  const g = group('crown');
  const gold = mat3(0xffc53d, { metalness: 0.6, roughness: 0.35, emissive: new Color(0x5a3a00), emissiveIntensity: 0.6 });
  const band = mesh(new CylinderGeometry(0.3, 0.27, 0.2, 14, 1, true), gold);
  band.material.side = DoubleSide;
  g.add(band);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(mesh(new ConeGeometry(0.06, 0.22, 6), gold, Math.sin(a) * 0.29, 0.2, Math.cos(a) * 0.29));
    g.add(mesh(new SphereGeometry(0.035, 8, 6), glowMat(i % 2 ? 0x22c55e : 0xff2d2d, 2), Math.sin(a) * 0.31, 0.32, Math.cos(a) * 0.31));
  }
  const goo = mesh(new CapsuleGeometry(0.03, 0.14, 4, 6), mat3(0x6b8f1a, { emissive: new Color(0x2a3a00), roughness: 0.3 }), 0.28, -0.06, 0.08);
  g.add(goo);
  return g;
}

function plunger() {
  const g = new Group();
  g.add(mesh(new CylinderGeometry(0.045, 0.05, 1.7, 8), mat3(0x8a5a2b), 0, 0.55, 0));
  const cup = mesh(new SphereGeometry(0.26, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat3(0xc0262d, { roughness: 0.45, side: DoubleSide }), 0, 1.5, 0);
  cup.rotation.x = Math.PI;
  const slime = mesh(new SphereGeometry(0.12, 8, 6), mat3(0x7ba828, { emissive: new Color(0x3a5a00), roughness: 0.2 }), 0, 1.5, 0);
  slime.scale.set(1.2, 0.5, 1.2);
  g.add(cup, slime);
  return g;
}

function cable(len: number) {
  const g = new Group();
  const m = mat3(0x1d1d1d, { roughness: 0.5 });
  let y = 0;
  for (let i = 0; i < 5; i++) {
    const seg = mesh(new CylinderGeometry(0.025, 0.025, len / 5, 6), m, Math.sin(i * 1.7) * 0.06, y - len / 10, Math.cos(i * 1.3) * 0.06);
    seg.rotation.z = Math.sin(i) * 0.4;
    y -= len / 5;
    g.add(seg);
  }
  g.add(mesh(new CylinderGeometry(0.06, 0.06, 0.12, 6), mat3(0xe6e6e6), 0, y, 0));
  return g;
}

/** Gives a prop its own materials (pieces share theirs across clones). */
async function prop(name: string, scale: number, tint?: [number, number]) {
  const p = await piece(name);
  p.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as MeshStandardMaterial).clone();
    if (tint) mat.color = new Color(0xffffff).lerp(new Color(tint[0]), tint[1]);
    m.material = mat;
    m.castShadow = true;
  });
  p.scale.setScalar(scale);
  return p;
}

/** Keeps a soft body jiggling: each vertex breathes along its normal. */
function jiggle(m: Mesh, amount: number, speed: number) {
  const pos = m.geometry.attributes.position as BufferAttribute;
  const base = (pos.array as Float32Array).slice();
  const v = new Vector3();
  return (t: number, agitation: number) => {
    const a = amount * (1 + agitation * 1.5);
    const sp = speed * (1 + agitation);
    for (let i = 0; i < pos.count; i++) {
      v.set(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
      const n = Math.sin(t * sp + v.y * 4 + v.x * 3) * 0.6 + Math.sin(t * sp * 1.7 + v.z * 5) * 0.4;
      v.multiplyScalar(1 + n * a);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    m.geometry.computeVertexNormals();
  };
}

/** A cloth hem that ripples. */
function flutter(m: Mesh, amount: number, below: number) {
  const pos = m.geometry.attributes.position as BufferAttribute;
  const base = (pos.array as Float32Array).slice();
  return (t: number, agitation: number) => {
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      const z = base[i * 3 + 2];
      const k = Math.max(0, (below - y) / below);
      const w = Math.sin(t * (3 + agitation * 3) + Math.atan2(z, x) * 3 + y * 2) * amount * k * (1 + agitation);
      pos.setXYZ(i, x * (1 + w), y, z * (1 + w));
    }
    pos.needsUpdate = true;
  };
}

// ------------------------------------------------------------------ the cast

async function build(id: CreatureId, extras: Extras): Promise<Rig> {
  switch (id) {
    // ---------------------------------------------------------------- bosses
    case 'king': {
      // A heaving mound of slime and garbage in a crown.
      const body = group();
      const slime = mat3(0x5f8f1e, { roughness: 0.18, flatShading: false, emissive: new Color(0x1a2a00), emissiveIntensity: 0.6 });
      const blob = mesh(lumpy(new IcosahedronGeometry(1.15, 4), 0.06, 2), slime, 0, 1.05, 0);
      blob.scale.set(1.15, 0.95, 1);
      body.add(blob);
      // Garbage stuck in him.
      const junk: [string, number, [number, number, number], [number, number, number]][] = [
        ['k_plate_dirty', 0.6, [0.75, 1.5, 0.55], [1.2, 0.3, 0.4]],
        ['f_book_set', 0.55, [-0.95, 1.05, 0.35], [0.3, 0.8, 0.5]],
        ['k_bowl_dirty', 0.9, [0.85, 0.55, 0.6], [0.5, 0, -0.9]],
        ['f_pillow_B', 0.9, [-0.7, 0.45, 0.7], [0.4, 0.3, 1.1]],
        ['k_pan_A', 0.55, [0.2, 1.9, -0.6], [0.8, 1.4, 0.3]],
      ];
      let i = 0;
      for (const [name, s, p, r] of junk) {
        const pc = await prop(name, s, [0x8a9a4a, 0.55]);
        pc.position.set(...p);
        pc.rotation.set(...r);
        pc.name = `junk${i++}`;
        body.add(pc);
      }
      const head = group('head', 0, 1.3, 1.02);
      head.add(eyes(0.36, 0.25, 0xff1a0a, { brow: 0x1a2604, angle: 0.55 }));
      const jaw = group('jaw', 0, -0.55, 0.05, mouth(0.55, 0.24, 8, 0x1a0a02));
      head.add(jaw);
      body.add(head);
      const c = crown();
      c.position.set(0.1, 2.12, 0);
      c.rotation.set(0.1, 0, -0.22);
      c.scale.setScalar(1.6);
      body.add(c);
      const armL = arm('armL', -1.15, 1.2, 0.9, 0.2, slime);
      const armR = arm('armR', 1.15, 1.2, 0.9, 0.2, slime, plunger(), 'handslotr');
      body.add(armL, armR);
      const puddle = mesh(new CylinderGeometry(1.5, 1.5, 0.02, 28), mat3(0x4d7c0f, { emissive: new Color(0x365314), emissiveIntensity: 0.9, roughness: 0.1, transparent: true, opacity: 0.85, flatShading: false }), 0, 0.02, 0);
      extras.root.add(puddle);
      for (let j = 0; j < 4; j++) extras.orbit(await prop(['k_plate_dirty', 'f_pillow_A', 'k_bowl_dirty', 'f_book_set'][j], 0.9, [0x7a8a3a, 0.6]), 1.8, 0.9 + (j % 2) * 0.8, 0.8, j * (Math.PI / 2), 0.2);
      for (let j = 0; j < 3; j++) extras.orbit(sock([0x6b7f2a, 0x8a6a3a, 0x4a4a4a][j]), 2, 0.6, -0.6, j * 2.1, 0.3);
      extras.swarm(head, 26);
      extras.stream(22, 0x9bc53d, () => new Vector3(rand(-1, 1), rand(0.5, 1.6), rand(-0.8, 0.8)), () => new Vector3(rand(-0.1, 0.1), rand(0.35, 0.8), rand(-0.1, 0.1)), 2.6, 0.8, { fade: 0.42 });
      extras.stream(12, 0x84cc16, () => new Vector3(rand(-0.9, 0.9), rand(0.8, 1.6), rand(0.4, 0.9)), () => new Vector3(0, -2, 0), 0.7, 0.16, { fade: 0.9 });
      extras.glow(0x84cc16, 4, 0.6);
      return { body, head, jaw, armL, armR, death: 'melt', wobble: jiggle(blob, 0.035, 2.2) };
    }

    case 'lich': {
      // A haunted bedsheet: hollow eyes, a gaping mouth and a sock collection.
      const body = group();
      const cloth = mat3(0xd9d2f5, { flatShading: false, roughness: 0.9, emissive: new Color(0x2a1060), emissiveIntensity: 0.2 });
      const shape = [
        [0.0, 2.3], [0.35, 2.25], [0.6, 2.05], [0.75, 1.7], [0.78, 1.3], [0.85, 0.9], [1.0, 0.45], [1.2, 0.05],
      ]
        .reverse()
        .map(([x, y]) => new Vector2(x, y));
      // Bottom to top, so the cloth faces outward.
      const sheetGeo = new LatheGeometry(shape, 28);
      const sheet = mesh(sheetGeo, cloth);
      body.add(sheet);
      const head = group('head', 0, 1.72, 0.66);
      for (const side of [-1, 1]) {
        const hole = mesh(new SphereGeometry(0.17, 12, 10), mat3(0x0d0221, { flatShading: false }), side * 0.27, 0, 0.08);
        hole.scale.set(1.1, 1.2, 0.5);
        hole.rotation.z = side * 0.5;
        head.add(hole, mesh(new SphereGeometry(0.07, 8, 6), glowMat(0xd946ef, 5), side * 0.27, -0.03, 0.16));
      }
      const jaw = group('jaw', 0, -0.42, 0.1);
      const gape = mesh(new SphereGeometry(0.2, 12, 10), mat3(0x0d0221, { flatShading: false }));
      gape.scale.set(0.9, 1, 0.4);
      jaw.add(gape);
      head.add(jaw);
      body.add(head);
      // A wizard's hat (it is a Lich, after all) with a sock draped over it.
      const hat = group('hat', 0.05, 2.2, 0);
      hat.rotation.z = -0.15;
      const purple = mat3(0x6d28d9);
      hat.add(mesh(new ConeGeometry(0.5, 1.1, 10), purple, 0, 0.55, 0), mesh(new TorusGeometry(0.55, 0.09, 6, 18), purple, 0, 0.02, 0));
      (hat.children[1] as Mesh).rotation.x = Math.PI / 2;
      const hs = sock(0xff7eb6);
      hs.name = 'hatsock';
      hs.position.set(0.25, 0.5, 0.15);
      hs.rotation.z = -1.2;
      hs.scale.setScalar(1.5);
      hat.add(hs);
      body.add(hat);
      const staff = await prop('w_staff', 1.2);
      const orb = mesh(new SphereGeometry(0.16, 12, 10), glowMat(0xc084fc, 3), 0, 1.45, 0);
      staff.add(orb);
      const armL = arm('armL', -0.75, 1.5, 0.75, 0.16, cloth);
      const armR = arm('armR', 0.75, 1.5, 0.75, 0.16, cloth, staff, 'handslotr');
      body.add(armL, armR);
      const colors = [0xff7eb6, 0x60a5fa, 0xfacc15, 0x4ade80, 0xf97316, 0xe5e7eb];
      colors.forEach((c, k) => extras.orbit(sock(c), 1.5, 1.4, 1.1, (k / colors.length) * Math.PI * 2, 0.25));
      extras.stream(16, 0xc4b5fd, () => new Vector3(rand(-0.8, 0.8), rand(0, 0.5), rand(-0.8, 0.8)), () => new Vector3(0, rand(0.3, 0.7), 0), 2.2, 0.5, { additive: true, fade: 0.6 });
      extras.glow(0xa78bfa, 2.2, 1.4, 2.4);
      return { body, head, jaw, armL, armR, float: 0.35, death: 'vanish', wobble: flutter(sheet, 0.08, 1.2) };
    }

    case 'warlord': {
      // A stew pot on legs, boiling over with dishwater and very cross about it.
      const body = group();
      const pot = await prop('k_pot_A_stew', 2.1, [0x8fa3ad, 0.25]);
      pot.position.y = 0.55;
      body.add(pot);
      const water = mesh(new CylinderGeometry(0.62, 0.62, 0.05, 20), mat3(0x6aa6b8, { roughness: 0.15, transparent: true, opacity: 0.9, flatShading: false }), 0, 1.5, 0);
      body.add(water);
      // A head of foam rising out of the pot, with eyes.
      const foam = mat3(0xf0fbff, { flatShading: false, roughness: 0.6 });
      const head = group('head', 0, 1.9, 0.05);
      const suds = mesh(lumpy(new IcosahedronGeometry(0.55, 2), 0.12, 4), foam);
      head.add(suds);
      head.add(mesh(new SphereGeometry(0.22, 10, 8), foam, 0.4, 0.25, 0), mesh(new SphereGeometry(0.2, 10, 8), foam, -0.4, 0.2, 0.05));
      const e = eyes(0.2, 0.13, 0x22d3ee, { brow: 0x1e3a4a, angle: 0.55 });
      e.position.set(0, 0.05, 0.45);
      head.add(e);
      const jaw = group('jaw', 0, -0.25, 0.48, mouth(0.3, 0.12, 6, 0x06222a));
      head.add(jaw);
      // An upturned colander for a helmet.
      const lid = group('lid', 0, 0.45, 0);
      const metal = mat3(0xb8c4cc, { metalness: 0.5, roughness: 0.35 });
      lid.add(mesh(new SphereGeometry(0.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), metal), mesh(new CylinderGeometry(0.06, 0.06, 0.25, 6), metal, 0, 0.5, 0));
      head.add(lid);
      body.add(head);
      const plates = mat3(0xe8eef2);
      const armL = arm('armL', -1.0, 1.25, 0.8, 0.17, plates);
      const fork = new Group();
      const steel = mat3(0xc9d3d9, { metalness: 0.6, roughness: 0.3 });
      fork.add(mesh(new CylinderGeometry(0.05, 0.05, 1.6, 6), mat3(0x6b4a2b), 0, 0.5, 0));
      for (let k = -1; k <= 1; k++) fork.add(mesh(new BoxGeometry(0.05, 0.45, 0.05), steel, k * 0.12, 1.45, 0));
      fork.add(mesh(new BoxGeometry(0.36, 0.08, 0.06), steel, 0, 1.22, 0));
      const blade = mesh(new CylinderGeometry(0.42, 0.42, 0.04, 16, 1, false, 0, Math.PI), steel, 0.05, 0.95, 0);
      blade.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      fork.add(blade);
      const armR = arm('armR', 1.0, 1.25, 0.8, 0.17, plates, fork, 'handslotr');
      const plate = await prop('k_plate_dirty', 1.3);
      plate.name = 'offhand';
      plate.rotation.set(Math.PI / 2, 0, 0);
      plate.position.set(0, 0, 0.25);
      armL.getObjectByName('armLhand')!.add(plate);
      for (let k = 0; k < 3; k++) armL.add(mesh(new CylinderGeometry(0.26, 0.26, 0.05, 14), plates, 0, -0.15 - k * 0.22, 0));
      for (let k = 0; k < 3; k++) armR.add(mesh(new CylinderGeometry(0.26, 0.26, 0.05, 14), plates, 0, -0.15 - k * 0.22, 0));
      body.add(armL, armR);
      const legMat = mat3(0x7c8a92, { metalness: 0.4 });
      const legs = [-0.4, 0.4].map((x) => group('', x, 0.55, 0, mesh(new CylinderGeometry(0.13, 0.16, 0.6, 8), legMat, 0, -0.27, 0)));
      body.add(...legs);
      extras.stream(10, 0xe0f7ff, () => new Vector3(rand(-0.7, 0.7), rand(1.2, 2.4), rand(-0.5, 0.5)), () => new Vector3(rand(-0.1, 0.1), rand(0.3, 0.6), rand(-0.1, 0.1)), 2, 0.28, { fade: 0.5 });
      extras.stream(10, 0x7dd3fc, () => new Vector3(rand(-0.8, 0.8), 1.5, rand(-0.6, 0.6)), () => new Vector3(0, -2.4, 0), 0.6, 0.14, { additive: true, fade: 0.7 });
      extras.glow(0x38bdf8, 2, 1.6, 2.4);
      return { body, head, jaw, armL, armR, legs, death: 'topple', wobble: jiggle(suds, 0.04, 3) };
    }

    case 'colossus': {
      // A towering heap of boxes, books and cables that learned to walk.
      const body = group();
      const card = mat3(0xc49a5c);
      const tape = mat3(0xe8d9a8);
      const torso = mesh(new BoxGeometry(1.5, 1.2, 1.0), card, 0, 1.45, 0);
      torso.rotation.y = 0.08;
      body.add(torso, mesh(new BoxGeometry(1.52, 0.12, 0.3), tape, 0, 1.45, 0.4));
      const hips = mesh(new BoxGeometry(1.2, 0.5, 0.85), mat3(0x9c7a46), 0, 0.75, 0);
      body.add(hips);
      const head = group('head', 0, 2.35, 0.05);
      head.add(mesh(new BoxGeometry(0.85, 0.7, 0.75), card));
      const e = eyes(0.2, 0.13, 0xff8a1f, { white: 0x1a1206, brow: 0x5a3a14, angle: 0.5 });
      e.position.set(0, 0.08, 0.38);
      head.add(e, group('', 0, -0.17, 0.38, mouth(0.24, 0.08, 5, 0x1a1206)));
      // The box lid flaps open like a mouth.
      const jaw = group('jaw', 0, 0.35, -0.37);
      const flap = mesh(new BoxGeometry(0.85, 0.04, 0.75), card, 0, 0, 0.37);
      jaw.add(flap);
      head.add(jaw);
      const bucket = await prop('d_barrel_small_stack', 0.32);
      bucket.name = 'bucket';
      bucket.position.set(0.1, 0.4, -0.1);
      head.add(bucket);
      body.add(head);
      const lamp = await prop('f_lamp_standing', 0.55);
      lamp.position.set(-0.45, 2, -0.45);
      lamp.rotation.z = 0.3;
      body.add(lamp);
      const box = await prop('d_box_stacked', 0.25);
      box.name = 'backbox';
      box.position.set(0.25, 1.6, -0.75);
      body.add(box);
      const books = [0xb91c1c, 0x1d4ed8, 0x15803d, 0xca8a04, 0x7c3aed];
      const bookArm = (name: string, x: number, hand?: Object3D, handName?: string) => {
        const pivot = group(name, x, 1.85, 0);
        for (let k = 0; k < 5; k++) pivot.add(mesh(new BoxGeometry(0.42, 0.2, 0.32), mat3(books[(k + (x > 0 ? 2 : 0)) % 5]), 0, -0.15 - k * 0.2, 0));
        const slot = group(handName ?? `${name}hand`, 0, -1.15, 0);
        if (hand) slot.add(hand);
        pivot.add(slot);
        return pivot;
      };
      const club = await prop('f_lamp_standing', 0.6);
      club.position.y = -0.1;
      const armR = bookArm('armR', 0.95, club, 'handslotr');
      const frame = await prop('f_pictureframe_large_A', 0.8);
      frame.name = 'offhand';
      frame.rotation.set(0, Math.PI / 2, 0);
      const armL = bookArm('armL', -0.95, frame);
      body.add(armL, armR);
      const legs = [-0.35, 0.35].map((x) => group('', x, 0.55, 0, mesh(new BoxGeometry(0.45, 0.6, 0.5), mat3(0x8a6a3a), 0, -0.25, 0)));
      body.add(...legs);
      for (const [x, y] of [[0.6, 1.0], [-0.6, 1.1], [0.2, 0.6]]) {
        const cb = cable(rand(0.4, 0.7));
        cb.position.set(x, y, 0.42);
        body.add(cb);
      }
      extras.stream(22, 0xb8ab98, () => new Vector3(rand(-1.1, 1.1), rand(0, 0.4), rand(-1.1, 1.1)), () => new Vector3(rand(-0.2, 0.2), rand(0.2, 0.5), rand(-0.2, 0.2)), 2.5, 0.7, { fade: 0.45 });
      extras.glow(0xffb347, 3.5, 2);
      return { body, head, jaw, jawMode: 'rot', armL, armR, legs, death: 'topple' };
    }

    case 'kraken': {
      // A dome of bathroom grime with eight tentacles and a toilet brush.
      const body = group();
      const grime = mat3(0x2f8f83, { flatShading: false, roughness: 0.25, emissive: new Color(0x062a26), emissiveIntensity: 0.6 });
      const dome = mesh(lumpy(new SphereGeometry(1.05, 24, 18), 0.05, 7), grime, 0, 1.55, 0);
      dome.scale.set(1, 1.15, 0.95);
      body.add(dome);
      const spots = mat3(0x1f5f57, { flatShading: false });
      for (let k = 0; k < 9; k++) {
        const a = rand(0, Math.PI * 2);
        const s = mesh(new SphereGeometry(rand(0.08, 0.16), 8, 6), spots, Math.sin(a) * 0.95, 1.55 + rand(-0.3, 0.8), Math.cos(a) * 0.9);
        body.add(s);
      }
      const head = group('head', 0, 1.5, 0.82);
      head.add(eyes(0.33, 0.22, 0xfacc15, { brow: 0x134e48, angle: 0.4 }));
      const jaw = group('jaw', 0, -0.42, 0.05, mouth(0.36, 0.16, 6, 0x081a18));
      head.add(jaw);
      body.add(head);
      const tails: Tail[] = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.2;
        const c = chain(5, 1.1, 0.16, 0.06, grime);
        c.root.position.set(Math.sin(a) * 0.75, 0.75, Math.cos(a) * 0.7);
        c.root.rotation.set(Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9);
        body.add(c.root);
        tails.push({ nodes: c.nodes, amp: 0.18, speed: 2.2, axis: k % 2 ? 'x' : 'z', phase: k });
      }
      const brush = new Group();
      brush.add(mesh(new CylinderGeometry(0.04, 0.04, 1.3, 6), mat3(0xf4f4f5), 0, 0.5, 0));
      brush.add(mesh(lumpy(new SphereGeometry(0.2, 8, 6), 0.2, 3), mat3(0x7a8a8a), 0, 1.2, 0));
      const armR = arm('armR', 1.0, 1.4, 1.0, 0.15, grime, brush, 'handslotr');
      const shower = await prop('k_pan_A', 0.6, [0xc0c8cc, 0.3]);
      shower.name = 'offhand';
      shower.rotation.x = Math.PI / 2;
      const armL = arm('armL', -1.0, 1.4, 1.0, 0.15, grime, shower);
      body.add(armL, armR);
      extras.stream(16, 0xccfbf1, () => new Vector3(rand(-1, 1), rand(0.3, 2.2), rand(-0.8, 0.8)), () => new Vector3(0, rand(0.3, 0.6), 0), 2.2, 0.3, { fade: 0.8 });
      extras.glow(0x2dd4bf, 4, 1.5);
      return { body, head, jaw, armL, armR, tails, death: 'melt', wobble: jiggle(dome, 0.025, 1.8) };
    }

    case 'dragon': {
      // A dragon sewn from a duvet: quilted, puffy, and breathing feathers.
      const body = group();
      const quilt = mat3(0x4f6bd8, { flatShading: false, roughness: 0.95 });
      const trim = mat3(0xf1f5ff, { flatShading: false });
      const torso = mesh(lumpy(new SphereGeometry(1, 20, 16), 0.07, 5), quilt, 0, 1.05, -0.1);
      torso.scale.set(1.15, 0.85, 1.2);
      body.add(torso);
      const belly = mesh(new SphereGeometry(0.8, 16, 12), trim, 0, 0.95, 0.4);
      belly.scale.set(0.9, 0.85, 0.6);
      body.add(belly);
      const neck = group('', 0, 1.5, 0.55);
      neck.rotation.x = 0.45;
      neck.add(mesh(new CapsuleGeometry(0.3, 0.7, 4, 10), quilt, 0, 0.45, 0));
      const head = group('head', 0, 1.0, 0.1);
      head.rotation.x = -0.45;
      const skull = mesh(new BoxGeometry(0.85, 0.55, 0.95), quilt, 0, 0, 0.15);
      head.add(skull);
      const pillow = await prop('f_pillow_A', 1.3);
      pillow.name = 'nightcap';
      pillow.position.set(0, 0.32, 0);
      head.add(pillow);
      for (const side of [-1, 1]) {
        const horn = mesh(new ConeGeometry(0.1, 0.4, 6), trim, side * 0.3, 0.35, -0.2);
        horn.rotation.x = -0.6;
        head.add(horn);
      }
      const e = eyes(0.24, 0.12, 0xf472b6, { brow: 0x1e2a6b, angle: 0.5 });
      e.position.set(0, 0.15, 0.55);
      head.add(e);
      const jaw = group('jaw', 0, -0.25, 0.05);
      jaw.add(mesh(new BoxGeometry(0.75, 0.15, 0.85), quilt, 0, -0.05, 0.2));
      for (let k = 0; k < 4; k++) jaw.add(mesh(new ConeGeometry(0.05, 0.14, 4), trim, (k - 1.5) * 0.17, 0.08, 0.55));
      head.add(jaw);
      neck.add(head);
      body.add(neck);
      // Wings like corners of a duvet.
      const wingMat = mat3(0x7b8ff0, { side: DoubleSide, flatShading: false });
      const wingL = group('armL', -0.85, 1.45, -0.3);
      const wingR = group('armR', 0.85, 1.45, -0.3);
      for (const [w, side] of [[wingL, -1], [wingR, 1]] as const) {
        for (let k = 0; k < 3; k++) {
          const panel = mesh(new BoxGeometry(0.5, 1.3 - k * 0.3, 0.05), wingMat, side * (0.3 + k * 0.42), 0.55 - k * 0.12, -k * 0.08);
          panel.rotation.set(-0.35, side * 0.25, side * -(0.5 + k * 0.25));
          w.add(panel);
        }
      }
      body.add(wingL, wingR);
      const tail = chain(6, 1.6, 0.25, 0.08, quilt, 1);
      tail.root.position.set(0, 0.7, -1.1);
      tail.root.rotation.x = -2.0;
      body.add(tail.root);
      const legs = [-0.5, 0.5].map((x) => group('', x, 0.45, 0.2, mesh(new CapsuleGeometry(0.2, 0.3, 4, 8), quilt, 0, -0.2, 0)));
      body.add(...legs);
      extras.stream(18, 0xffffff, () => new Vector3(rand(-1, 1), rand(0.5, 2.5), rand(-1, 1)), () => new Vector3(rand(-0.3, 0.3), rand(-0.3, -0.1), rand(-0.3, 0.3)), 3, 0.18, { fade: 0.9 });
      extras.glow(0x818cf8, 4, 1.6);
      return { body, head, jaw, jawMode: 'rot', armL: wingL, armR: wingR, legs, tails: [{ nodes: tail.nodes, amp: 0.2, speed: 2, axis: 'z', phase: 0 }], death: 'topple' };
    }

    case 'devil': {
      // A whirlwind of dust with a face in it.
      const body = group();
      const dust = mat3(0x9c9488, { transparent: true, opacity: 0.55, flatShading: false, roughness: 1, depthWrite: false });
      const rings: Mesh[] = [];
      for (let k = 0; k < 7; k++) {
        const r = 0.35 + k * 0.17;
        const ring = mesh(new TorusGeometry(r, 0.16 + k * 0.02, 8, 18), dust, 0, 0.25 + k * 0.33, 0);
        ring.rotation.x = Math.PI / 2;
        rings.push(ring);
        body.add(ring);
      }
      const core = mesh(new CylinderGeometry(1.1, 0.3, 2.3, 16, 1, true), mat3(0x6b6359, { transparent: true, opacity: 0.6, side: DoubleSide, flatShading: false }), 0, 1.3, 0);
      body.add(core);
      const head = group('head', 0, 1.8, 1.25);
      head.add(eyes(0.32, 0.2, 0xfde047, { white: 0x2a2620, brow: 0x3a352e, angle: 0.5 }));
      const jaw = group('jaw', 0, -0.4, 0, mouth(0.38, 0.16, 7, 0x0f0d0a));
      head.add(jaw);
      body.add(head);
      const tendril = (name: string, x: number) => {
        const c = chain(4, 1.1, 0.16, 0.07, dust);
        const pivot = group(name, x, 1.8, 0);
        pivot.add(c.root);
        const slot = group(`${name}hand`, 0, -0.3, 0);
        c.nodes[3].add(slot);
        return { pivot, nodes: c.nodes };
      };
      const l = tendril('armL', -1.0);
      const rr = tendril('armR', 1.0);
      body.add(l.pivot, rr.pivot);
      for (let k = 0; k < 5; k++) extras.orbit(await prop(['f_book_set', 'k_plate_dirty', 'f_pillow_B', 'k_bowl_dirty', 'f_chair_A'][k], k === 4 ? 0.35 : 0.6), 1.6 + (k % 2) * 0.3, 0.6 + k * 0.4, 2.2, k * 1.3, 0.2);
      extras.stream(30, 0xb8ab98, () => new Vector3(rand(-1.4, 1.4), rand(0, 2.6), rand(-1.4, 1.4)), () => new Vector3(rand(-0.5, 0.5), rand(0.2, 0.8), rand(-0.5, 0.5)), 2, 0.7, { fade: 0.4 });
      extras.glow(0xfde047, 3, 1.8);
      return {
        body,
        head,
        jaw,
        armL: l.pivot,
        armR: rr.pivot,
        tails: [
          { nodes: l.nodes, amp: 0.3, speed: 3, axis: 'z', phase: 0 },
          { nodes: rr.nodes, amp: 0.3, speed: 3, axis: 'z', phase: 2 },
        ],
        float: 0.1,
        death: 'vanish',
        wobble: (t, ag) => {
          rings.forEach((r, k) => {
            r.rotation.z = t * (3 + k * 0.6) * (1 + ag);
            r.position.x = Math.sin(t * 2 + k * 0.7) * 0.08 * k;
          });
          core.rotation.y = -t * 4;
        },
      };
    }

    case 'troll': {
      // A dustbin with arms. The lid is its mouth.
      const body = group();
      const tin = mat3(0x6b7f8a, { metalness: 0.5, roughness: 0.4 });
      const can = mesh(new CylinderGeometry(0.85, 0.72, 1.7, 16), tin, 0, 1.15, 0);
      body.add(can);
      for (let k = 0; k < 3; k++) {
        const ridge = mesh(new TorusGeometry(0.82 - k * 0.04, 0.04, 6, 20), tin, 0, 0.55 + k * 0.5, 0);
        ridge.rotation.x = Math.PI / 2;
        body.add(ridge);
      }
      const inside = mesh(new CylinderGeometry(0.8, 0.8, 0.05, 16), mat3(0x1a1206), 0, 2.0, 0);
      body.add(inside);
      const head = group('head', 0, 1.6, 0.8);
      head.add(eyes(0.28, 0.18, 0xa3e635, { brow: 0x26313a, angle: 0.55 }));
      body.add(head);
      // The lid hinges at the back and snaps open.
      const jaw = group('lid', 0, 2.02, -0.85);
      const lidMesh = mesh(new CylinderGeometry(0.92, 0.92, 0.12, 16), tin, 0, 0, 0.85);
      jaw.add(lidMesh, mesh(new BoxGeometry(0.4, 0.1, 0.12), tin, 0, 0.1, 0.85));
      for (let k = 0; k < 7; k++) {
        const a = -0.9 + k * 0.3;
        const fang = mesh(new ConeGeometry(0.07, 0.25, 4), mat3(0xf4efd8), Math.sin(a) * 0.75, -0.15, 0.85 + Math.cos(a) * 0.75);
        fang.rotation.x = Math.PI;
        jaw.add(fang);
      }
      body.add(jaw);
      const skin = mat3(0x5d7a3a);
      const lid = await prop('w_shield_round', 1.1);
      lid.name = 'offhand';
      const armL = arm('armL', -0.95, 1.6, 1.1, 0.18, skin, lid);
      const banana = new Group();
      banana.add(mesh(new CylinderGeometry(0.05, 0.06, 1.4, 6), mat3(0x7a5230), 0, 0.45, 0));
      banana.add(mesh(new BoxGeometry(0.5, 0.35, 0.08), mat3(0x2563eb), 0, 1.2, 0));
      const armR = arm('armR', 0.95, 1.6, 1.1, 0.18, skin, banana, 'handslotr');
      body.add(armL, armR);
      const legs = [-0.35, 0.35].map((x) => group('', x, 0.35, 0, mesh(new CapsuleGeometry(0.17, 0.2, 4, 8), skin, 0, -0.15, 0)));
      body.add(...legs);
      for (let k = 0; k < 3; k++) extras.orbit(await prop(['k_bowl_dirty', 'f_book_set', 'k_plate_dirty'][k], 0.6, [0x7a6a4a, 0.5]), 1.5, 2.2 + k * 0.2, 1.4, k * 2.1, 0.3);
      extras.swarm(head, 14);
      extras.stream(16, 0xa3b86a, () => new Vector3(rand(-0.6, 0.6), 2.1, rand(-0.6, 0.6)), () => new Vector3(rand(-0.1, 0.1), rand(0.4, 0.8), rand(-0.1, 0.1)), 2.4, 0.7, { fade: 0.35 });
      extras.glow(0xa3e635, 3.5, 1.6);
      return { body, head, jaw, jawMode: 'rot', armL, armR, legs, death: 'topple' };
    }

    // ---------------------------------------------------------------- minions
    case 'sock': {
      // A sock puppet with button eyes and a needle.
      const body = group();
      const wool = mat3(0xd94f8a, { flatShading: false });
      const stripe = mat3(0xfff1f7, { flatShading: false });
      const tube = mesh(new CapsuleGeometry(0.42, 1.1, 6, 14), wool, 0, 1.05, 0);
      body.add(tube);
      for (let k = 0; k < 3; k++) body.add(mesh(new CylinderGeometry(0.43, 0.43, 0.12, 16), stripe, 0, 0.55 + k * 0.32, 0));
      const head = group('head', 0, 1.6, 0.36);
      for (const side of [-1, 1]) {
        head.add(mesh(new CylinderGeometry(0.11, 0.11, 0.05, 10), mat3(0x1f1f1f), side * 0.17, 0.05, 0.02));
        (head.children[head.children.length - 1] as Mesh).rotation.x = Math.PI / 2;
        head.add(mesh(new SphereGeometry(0.035, 6, 4), glowMat(0xff4fa3, 3), side * 0.17, 0.05, 0.06));
      }
      const jaw = group('jaw', 0, -0.25, 0.03, mouth(0.24, 0.1, 4, 0x3a0a1e));
      head.add(jaw);
      body.add(head);
      const needle = new Group();
      needle.add(mesh(new CylinderGeometry(0.025, 0.005, 0.9, 5), mat3(0xd1d5db, { metalness: 0.6 }), 0, 0.35, 0));
      const armL = arm('armL', -0.45, 1.2, 0.45, 0.09, wool);
      const armR = arm('armR', 0.45, 1.2, 0.45, 0.09, wool, needle, 'handslotr');
      body.add(armL, armR);
      return { body, head, jaw, armL, armR, death: 'topple' };
    }

    case 'grease': {
      // A blob of kitchen grease with a fork.
      const body = group();
      const oil = mat3(0xc9a227, { roughness: 0.12, flatShading: false, emissive: new Color(0x3a2a00), emissiveIntensity: 0.4 });
      const blob = mesh(lumpy(new IcosahedronGeometry(0.62, 3), 0.08, 3), oil, 0, 0.62, 0);
      blob.scale.set(1.1, 0.9, 1);
      body.add(blob);
      const head = group('head', 0, 0.8, 0.66);
      head.add(eyes(0.2, 0.13, 0xd9f24a, { brow: 0x4a3600, angle: 0.5 }));
      const jaw = group('jaw', 0, -0.26, 0.02, mouth(0.22, 0.1, 5, 0x2a1a00));
      head.add(jaw);
      body.add(head);
      const fork = await prop('w_dagger', 0.9);
      const armL = arm('armL', -0.6, 0.75, 0.35, 0.1, oil);
      const armR = arm('armR', 0.6, 0.75, 0.35, 0.1, oil, fork, 'handslotr');
      body.add(armL, armR);
      return { body, head, jaw, armL, armR, death: 'melt', wobble: jiggle(blob, 0.05, 3) };
    }

    case 'dust': {
      // A dust bunny: a fluffy grey ball with long ears and a broken comb.
      const body = group();
      const fluff = mat3(0xa8a29e, { roughness: 1 });
      const ball = mesh(lumpy(new IcosahedronGeometry(0.75, 2), 0.18, 9), fluff, 0, 0.8, 0);
      body.add(ball);
      for (const side of [-1, 1]) {
        const ear = mesh(new CapsuleGeometry(0.12, 0.65, 4, 8), fluff, side * 0.3, 1.75, -0.05);
        ear.rotation.z = side * -0.25;
        body.add(ear);
        body.add(mesh(new CapsuleGeometry(0.06, 0.5, 4, 6), mat3(0xf0b8c0), side * 0.3, 1.78, 0.05));
        (body.children[body.children.length - 1] as Mesh).rotation.z = side * -0.25;
      }
      const head = group('head', 0, 0.95, 0.62);
      head.add(eyes(0.22, 0.13, 0xfff1c1, { brow: 0x57534e, angle: 0.55 }));
      const jaw = group('jaw', 0, -0.25, 0.02, mouth(0.2, 0.09, 4, 0x1c1917));
      head.add(jaw);
      body.add(head);
      const comb = await prop('w_axe_1handed', 0.8);
      const armL = arm('armL', -0.7, 0.85, 0.35, 0.1, fluff);
      const armR = arm('armR', 0.7, 0.85, 0.35, 0.1, fluff, comb, 'handslotr');
      body.add(armL, armR);
      extras.stream(8, 0xc8c2b8, () => new Vector3(rand(-0.6, 0.6), rand(0, 0.3), rand(-0.6, 0.6)), () => new Vector3(rand(-0.2, 0.2), rand(0.2, 0.4), rand(-0.2, 0.2)), 2, 0.4, { fade: 0.4 });
      return { body, head, jaw, armL, armR, death: 'vanish' };
    }

    case 'slug': {
      // A scum slug on eye stalks.
      const body = group();
      const slime = mat3(0x5eead4, { roughness: 0.15, flatShading: false, emissive: new Color(0x0f3d36), emissiveIntensity: 0.5 });
      const trunk = mesh(new CapsuleGeometry(0.45, 1.0, 6, 14), slime, 0, 0.5, 0);
      trunk.rotation.x = Math.PI / 2 - 0.5;
      body.add(trunk);
      const head = group('head', 0, 1.05, 0.55);
      for (const side of [-1, 1]) {
        const stalk = mesh(new CylinderGeometry(0.05, 0.07, 0.5, 6), slime, side * 0.18, 0.25, 0);
        stalk.rotation.z = side * -0.2;
        head.add(stalk, mesh(new SphereGeometry(0.12, 10, 8), mat3(0xffffff, { flatShading: false }), side * 0.23, 0.52, 0), mesh(new SphereGeometry(0.06, 8, 6), glowMat(0xf43f5e, 3), side * 0.23, 0.52, 0.09));
      }
      const jaw = group('jaw', 0, -0.2, 0.42, mouth(0.22, 0.09, 4, 0x052e2a));
      head.add(jaw);
      body.add(head);
      const sponge = mesh(new BoxGeometry(0.35, 0.2, 0.25), mat3(0xfacc15));
      sponge.position.y = 0.2;
      const armL = arm('armL', -0.45, 0.8, 0.3, 0.08, slime);
      const armR = arm('armR', 0.45, 0.8, 0.3, 0.08, slime, sponge, 'handslotr');
      body.add(armL, armR);
      return { body, head, jaw, armL, armR, death: 'melt', wobble: jiggle(trunk, 0.04, 3) };
    }

    case 'pillow': {
      // A pillow imp with horns and a feather spear.
      const body = group();
      const cotton = mat3(0xf8fafc, { flatShading: false, roughness: 0.95 });
      const p = mesh(lumpy(new BoxGeometry(1.0, 1.1, 0.55, 4, 4, 2), 0.06, 2), cotton, 0, 0.95, 0);
      body.add(p);
      for (const [x, y] of [[-0.5, 1.5], [0.5, 1.5], [-0.5, 0.4], [0.5, 0.4]]) body.add(mesh(new SphereGeometry(0.1, 6, 4), cotton, x, y, 0));
      for (const side of [-1, 1]) {
        const horn = mesh(new ConeGeometry(0.08, 0.3, 6), mat3(0xef4444), side * 0.3, 1.6, 0);
        horn.rotation.z = side * -0.3;
        body.add(horn);
      }
      const head = group('head', 0, 1.15, 0.3);
      head.add(eyes(0.2, 0.12, 0xef4444, { brow: 0x334155, angle: 0.5 }));
      const jaw = group('jaw', 0, -0.25, 0.02, mouth(0.22, 0.09, 4, 0x3f0a0a));
      head.add(jaw);
      body.add(head);
      const spear = new Group();
      spear.add(mesh(new CylinderGeometry(0.03, 0.03, 1.1, 5), mat3(0x7c5a3a), 0, 0.4, 0), mesh(new ConeGeometry(0.1, 0.35, 5), mat3(0xe0f2fe), 0, 1.05, 0));
      const armL = arm('armL', -0.6, 1.1, 0.35, 0.09, cotton);
      const armR = arm('armR', 0.6, 1.1, 0.35, 0.09, cotton, spear, 'handslotr');
      const legs = [-0.25, 0.25].map((x) => group('', x, 0.4, 0, mesh(new CapsuleGeometry(0.09, 0.2, 4, 6), cotton, 0, -0.18, 0)));
      body.add(armL, armR, ...legs);
      extras.stream(6, 0xffffff, () => new Vector3(rand(-0.6, 0.6), rand(0.5, 1.6), rand(-0.4, 0.4)), () => new Vector3(rand(-0.2, 0.2), -0.2, 0), 2.5, 0.12, { fade: 0.9 });
      return { body, head, jaw, armL, armR, legs, death: 'topple' };
    }

    case 'crumb': {
      // A biscuit beetle: a cookie on six legs.
      const body = group();
      const biscuit = mat3(0xc68a4a);
      const shell = mesh(lumpy(new SphereGeometry(0.7, 14, 10), 0.08, 4), biscuit, 0, 0.75, 0);
      shell.scale.set(1, 0.6, 1.1);
      body.add(shell);
      for (let k = 0; k < 7; k++) {
        const a = rand(0, Math.PI * 2);
        body.add(mesh(new BoxGeometry(0.14, 0.1, 0.14), mat3(0x3b2414), Math.sin(a) * 0.45, 1.05, Math.cos(a) * 0.5));
      }
      const legMat = mat3(0x3b2414);
      const legs: Object3D[] = [];
      for (let k = 0; k < 6; k++) {
        const side = k < 3 ? -1 : 1;
        const z = ((k % 3) - 1) * 0.4;
        const leg = group('', side * 0.55, 0.6, z, mesh(new CylinderGeometry(0.04, 0.03, 0.6, 5), legMat, side * 0.15, -0.25, 0));
        (leg.children[0] as Mesh).rotation.z = side * 0.5;
        legs.push(leg);
      }
      body.add(...legs);
      const head = group('head', 0, 0.8, 0.75);
      head.add(eyes(0.18, 0.11, 0xfb923c, { brow: 0x3b2414, angle: 0.5 }));
      const jaw = group('jaw', 0, -0.2, 0.05);
      for (const side of [-1, 1]) {
        const pincer = mesh(new ConeGeometry(0.06, 0.35, 5), legMat, side * 0.12, 0, 0.15);
        pincer.rotation.set(Math.PI / 2, 0, side * 0.5);
        jaw.add(pincer);
      }
      head.add(jaw);
      body.add(head);
      const armL = group('armL', -0.5, 0.9, 0.4);
      const armR = group('armR', 0.5, 0.9, 0.4, group('handslotr'));
      body.add(armL, armR);
      return { body, head, jaw, armL, armR, legs, death: 'topple' };
    }

    case 'rat': {
      // A bin rat in a tin-can helmet.
      const body = group();
      const fur = mat3(0x6b6561);
      const trunk = mesh(lumpy(new SphereGeometry(0.55, 14, 10), 0.06, 6), fur, 0, 0.8, 0);
      trunk.scale.set(0.9, 1.15, 1);
      body.add(trunk);
      const head = group('head', 0, 1.35, 0.25);
      const snout = mesh(new ConeGeometry(0.3, 0.6, 8), fur, 0, -0.05, 0.35);
      snout.rotation.x = Math.PI / 2;
      head.add(mesh(new SphereGeometry(0.38, 12, 10), fur), snout, mesh(new SphereGeometry(0.07, 6, 4), mat3(0xf9a8d4), 0, -0.05, 0.68));
      for (const side of [-1, 1]) head.add(mesh(new SphereGeometry(0.17, 10, 8), mat3(0xf9a8d4), side * 0.3, 0.32, -0.05));
      const e = eyes(0.15, 0.09, 0xef4444);
      e.position.set(0, 0.1, 0.3);
      head.add(e);
      const can = mesh(new CylinderGeometry(0.25, 0.25, 0.3, 12), mat3(0xb0b8bf, { metalness: 0.6, roughness: 0.3 }), 0, 0.38, 0);
      can.name = 'helmet';
      head.add(can);
      const jaw = group('jaw', 0, -0.2, 0.4, mouth(0.12, 0.06, 2, 0x1a0a0a));
      head.add(jaw);
      body.add(head);
      const tail = chain(5, 1.0, 0.05, 0.02, mat3(0xf9a8d4), 1);
      tail.root.position.set(0, 0.45, -0.45);
      tail.root.rotation.x = -2.2;
      body.add(tail.root);
      const knife = await prop('w_dagger', 0.8);
      const armL = arm('armL', -0.45, 1.0, 0.35, 0.08, fur);
      const armR = arm('armR', 0.45, 1.0, 0.35, 0.08, fur, knife, 'handslotr');
      const legs = [-0.22, 0.22].map((x) => group('', x, 0.35, 0, mesh(new CapsuleGeometry(0.08, 0.2, 4, 6), fur, 0, -0.15, 0)));
      body.add(armL, armR, ...legs);
      return { body, head, jaw, armL, armR, legs, tails: [{ nodes: tail.nodes, amp: 0.25, speed: 3, axis: 'z', phase: 0 }], death: 'topple' };
    }
  }
}

// ------------------------------------------------------------------ AI-made bodies

/**
 * A detailed model made with an AI 3D tool can replace any creature's body:
 * drop public/models/ai/<creature id>.glb in and list it in manifest.json,
 * e.g. { "king": { "turn": 0 } } (turn: extra rotation in degrees if it faces
 * the wrong way). It is sized to the body it replaces, keeps that creature's
 * flies, motes and orbiting junk, plays its own first animation as an idle if
 * it has one, and takes the same lunges, flinches and deaths as everyone else.
 */
interface AiEntry {
  turn?: number;
  /** Multiplies the fitted height. */
  scale?: number;
}

let aiList: Promise<Record<string, AiEntry>> | undefined;
function aiModels() {
  aiList ??= fetch('/models/ai/manifest.json')
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return aiList;
}

async function aiBody(id: CreatureId, fit: Box3): Promise<Pick<Rig, 'body' | 'wobble'> | undefined> {
  const entry = (await aiModels())[id];
  if (!entry) return undefined;
  const gltf = await new GLTFLoader().loadAsync(`/models/ai/${id}.glb`).catch(() => undefined);
  if (!gltf) return undefined;
  const model = gltf.scene;
  model.rotation.y = ((entry.turn ?? 0) * Math.PI) / 180;
  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const want = Math.max(0.5, fit.isEmpty() ? 2.2 : fit.max.y - Math.max(0, fit.min.y)) * (entry.scale ?? 1);
  const k = want / Math.max(0.001, size.y);
  model.scale.setScalar(k);
  const centre = box.getCenter(new Vector3());
  model.position.set(-centre.x * k, -box.min.y * k, -centre.z * k);
  model.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mat = m.material as MeshStandardMaterial;
    if (mat?.isMeshStandardMaterial) mat.envMapIntensity = 0.8;
  });
  const body = group('', 0, 0, 0, model);
  let mixer: AnimationMixer | undefined;
  if (gltf.animations.length) {
    mixer = new AnimationMixer(model);
    const idle = gltf.animations.find((a) => /idle|breath|stand/i.test(a.name)) ?? gltf.animations[0];
    mixer.clipAction(idle).setLoop(LoopRepeat, Infinity).play();
  }
  return { body, wobble: mixer ? (_t, ag, dt) => mixer.update(dt * (1 + ag * 0.6)) : undefined };
}

/** Builds a creature, ready to animate. */
export async function creature(id: CreatureId): Promise<Creature> {
  const root = new Group();
  const extras = new Extras(root);
  let rig = await build(id, extras);
  const fit = new Box3().setFromObject(rig.body);
  const ai = await aiBody(id, fit);
  // An AI-made body takes over; the creature keeps its aura and the way it dies.
  if (ai) {
    rig = { body: ai.body, wobble: ai.wobble, float: rig.float, death: rig.death === 'vanish' ? 'vanish' : 'topple' };
    // Its painted texture carries the colour, and it is bulkier than the body
    // the aura light was placed for: keep the light off its skin and softer.
    const light = extras.light;
    if (light) {
      const front = new Box3().setFromObject(ai.body).max.z;
      light.position.z = Math.max(light.position.z, front + 1.5);
      light.userData.base *= 0.5;
    }
  }
  const c = new Creature(rig, extras);
  if (root.children.length) c.root.add(...root.children);
  // Extras live on the creature's root; give them the right parent for updates.
  c.extras.root = c.root;
  c.model.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  c.loop('Idle', { fade: 0 });
  c.update(0);
  // Measure the body (not the swinging arms or tails) to know how close the hero may stand.
  c.root.updateMatrixWorld(true);
  const box = new Box3();
  const skip = new Set<Object3D>([rig.armL, rig.armR].filter((o): o is Object3D => !!o));
  rig.body.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    for (let p: Object3D | null = m; p; p = p.parent) if (skip.has(p)) return;
    box.expandByObject(m);
  });
  if (!box.isEmpty()) c.front = Math.max(0.5, Math.min(1.6, box.max.z, Math.max(box.max.x, -box.min.x)));
  return c;
}
