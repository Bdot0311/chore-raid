import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PointLight,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { Actor } from './Actor';
import { animationClips, character, piece } from './assets';
import { hero as heroDef, type EnemyDef, type HeroDef } from './cast';
import { Fx } from './fx';
import { buildLair, lairLook, SPOT_GAP, type BuiltLair } from './lairs';

/**
 * The 3D fight: the hero and an enemy in a lair, with real animated combat.
 * React owns the HUD and the input and drives this through the same small set
 * of calls the old 2D stage had (hit, windup, die...), so the game rules never
 * know which renderer they are talking to.
 */

export type Move = 'slash' | 'backslash' | 'thrust' | 'smash' | 'spin';

export interface WorldOptions {
  enemy: EnemyDef;
  hero: string | undefined;
  /** Which encounter along the lair hall (quest step). */
  spot: number;
  /** Calm mode for task and timer steps: the enemy never attacks. */
  passive?: boolean;
  /** Equipped weapon look. */
  trail: number;
  onBossAttack?: (big: boolean) => void;
  onStomp?: () => void;
  onRoar?: () => void;
}

interface Tween {
  t: number;
  dur: number;
  step: (k: number) => void;
  done?: () => void;
}

let sharedRenderer: WebGLRenderer | undefined;
/** One WebGL context for the whole app: phones cap how many a page may open. */
export function renderer() {
  if (!sharedRenderer) {
    sharedRenderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    sharedRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    sharedRenderer.outputColorSpace = SRGBColorSpace;
    sharedRenderer.toneMapping = ACESFilmicToneMapping;
    sharedRenderer.toneMappingExposure = 1.15;
    sharedRenderer.shadowMap.enabled = true;
    sharedRenderer.shadowMap.type = PCFSoftShadowMap;
  }
  return sharedRenderer;
}

const lairCache = new Map<string, Promise<BuiltLair>>();
function lair(id: EnemyDef['lair']) {
  let p = lairCache.get(id);
  if (!p) {
    p = buildLair(id);
    p.catch(() => lairCache.delete(id));
    lairCache.set(id, p);
  }
  return p;
}

/** Start building a lair and its cast before the fight screen opens. */
export function preloadWorld(enemy: EnemyDef, heroId?: string) {
  void lair(enemy.lair).catch(() => undefined);
  void animationClips().catch(() => undefined);
  void character(enemy.model).catch(() => undefined);
  void character(heroDef(heroId).id).catch(() => undefined);
}

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class World {
  private host!: HTMLElement;
  private overlay = document.createElement('div');
  private hurtEl = document.createElement('div');
  private flashEl = document.createElement('div');
  private o!: WorldOptions;
  private scene = new Scene();
  private camera = new PerspectiveCamera(50, 1, 0.1, 120);
  private fx = new Fx(this.scene);
  private hero!: Actor;
  private heroDef!: HeroDef;
  private enemy!: Actor;
  private key = new DirectionalLight(0xffffff, 2.2);
  private hemi = new HemisphereLight(0xffffff, 0x222222, 1);
  private torchLights: PointLight[] = [];
  private enemyLight = new PointLight(0xff3b30, 0, 9, 1.6);
  private heroLight = new PointLight(0xffc94d, 0, 6, 1.6);
  private resize?: ResizeObserver;
  private raf = 0;
  private last = 0;
  private destroyed = false;
  private ready = false;
  private tweens: Tween[] = [];

  private heroMark = new Vector3();
  private enemyMark = new Vector3();
  private camBase = new Vector3();
  private camLook = new Vector3();
  private camFollow = new Vector3();
  private shake = 0;
  private hitStop = 0;
  private slowMo = 1;
  private slowUntil = 0;
  private time = 0;

  private attackIdx = 0;
  private busy = false;
  private queued: { mult: number; gained: number }[] = [];
  private lastHitAt = 0;
  private nextAttackIn = 9;
  private counterUntil = 0;
  private windupOn = false;
  private healGlow = 0;
  private dormant = false;
  private dead = false;
  private broken = 0;
  private enemyMats: MeshStandardMaterial[] = [];
  private flashLevel = 0;
  private debris: { obj: Object3D; vel: Vector3; spin: Vector3 }[] = [];
  private zzz = 0;
  private nextTaunt = 6;
  private entering = true;

  async init(host: HTMLElement, o: WorldOptions) {
    this.host = host;
    this.o = o;
    this.heroDef = heroDef(o.hero);
    const look = lairLook(o.enemy.lair);

    const [built, clips, heroModel, enemyModel] = await Promise.all([
      lair(o.enemy.lair),
      animationClips(),
      character(this.heroDef.id),
      character(o.enemy.model),
    ]);
    if (this.destroyed) return;

    // --- lights and atmosphere
    this.scene.background = new Color(look.fog);
    this.scene.fog = new Fog(look.fog, look.fogNear, look.fogFar);
    this.hemi.color.set(look.sky);
    this.hemi.groundColor.set(look.ground);
    this.hemi.intensity = look.ambient;
    this.key.color.set(look.key);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    const sc = this.key.shadow.camera;
    sc.left = -9;
    sc.right = 9;
    sc.top = 9;
    sc.bottom = -9;
    sc.near = 1;
    sc.far = 40;
    this.key.shadow.bias = -0.0008;
    this.key.shadow.normalBias = 0.04;
    this.scene.add(this.hemi, this.key, this.key.target, this.enemyLight, this.heroLight);
    for (let i = 0; i < 2; i++) {
      const l = new PointLight(look.torch, 0, 14, 1.5);
      this.torchLights.push(l);
      this.scene.add(l);
    }
    built.root.removeFromParent();
    this.scene.add(built.root);

    // --- marks along the hall
    const z0 = -o.spot * SPOT_GAP;
    const big = o.enemy.boss;
    this.heroMark.set(-1.2, 0, z0 + 2.2);
    this.enemyMark.set(0.3, 0, z0 - (big ? 2.4 : 1.7));
    // A three-quarter view from behind the hero's right shoulder, framing both fighters.
    const mid = this.heroMark.clone().lerp(this.enemyMark, 0.55);
    const far = big ? 1.25 : 1.1;
    // Aim at the floor just in front of them, so the fighters sit above the HUD.
    this.camLook.set(mid.x + 0.2, big ? 1.5 : 1, mid.z + 1.4);
    this.camBase.set(mid.x + 2.2 * far, 5.6 * far, mid.z + 11.5 * far);
    this.key.position.set(-6, 14, z0 + 8);
    this.key.target.position.set(0, 0, z0 - 1);
    const near = built.torches
      .map((t) => ({ t, d: Math.abs(t.z - z0) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    near.forEach(({ t }, i) => {
      this.torchLights[i].position.set(t.x, t.y, t.z);
      this.torchLights[i].intensity = 14;
    });
    if (!near.length) {
      // Kitchens have ceiling lights instead of torches.
      this.torchLights[0].position.set(0, 6, z0 + 1);
      this.torchLights[0].intensity = 18;
    }

    // --- hero
    this.hero = new Actor(heroModel, clips);
    this.hero.idle = this.heroDef.idle;
    this.hero.showOnly(this.heroDef.carry, this.heroDef.props);
    this.scene.add(this.hero.root);

    // --- enemy
    this.enemy = new Actor(enemyModel, clips);
    this.enemy.root.scale.setScalar(o.enemy.size);
    this.enemy.idle = 'Idle_Combat';
    for (const [part, color] of o.enemy.tints) this.enemy.tint(part, color);
    for (const [part, color] of o.enemy.glows) this.enemy.glow(part, color, 2.5);
    const [weapon, offhand] = await Promise.all([
      o.enemy.weapon ? piece(o.enemy.weapon) : undefined,
      o.enemy.offhand ? piece(o.enemy.offhand) : undefined,
    ]);
    if (this.destroyed) return;
    if (weapon) this.enemy.attach(weapon, 'handslot.r');
    if (offhand) {
      offhand.name = 'offhand';
      this.enemy.attach(offhand, 'handslot.l');
    }
    // Every enemy gets its own materials, so it can flash white when struck.
    enemyModel.traverse((obj) => {
      const m = obj as Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as MeshStandardMaterial).clone();
      m.material = mat;
      this.enemyMats.push(mat);
    });
    this.scene.add(this.enemy.root);

    // --- DOM layers: floating text, hurt vignette, white flash
    this.overlay.className = 'world-overlay';
    this.hurtEl.className = 'world-hurt';
    this.flashEl.className = 'world-flash';
    const canvas = renderer().domElement;
    canvas.className = 'world-canvas';
    canvas.style.opacity = '0';
    host.append(canvas, this.hurtEl, this.flashEl, this.overlay);
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(host);
    this.fit();

    this.ready = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    requestAnimationFrame(() => (canvas.style.opacity = '1'));
    void this.enter();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.resize?.disconnect();
    if (!this.ready) return;
    const canvas = renderer().domElement;
    if (canvas.parentElement === this.host) canvas.remove();
    this.overlay.remove();
    this.hurtEl.remove();
    this.flashEl.remove();
    // The lair is cached for the next fight; everything else goes.
    for (const c of [...this.scene.children]) this.scene.remove(c);
  }

  private fit() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    renderer().setSize(w, h, false);
    this.camera.aspect = w / h;
    // Portrait phones need a wider view to keep both fighters in frame.
    this.camera.fov = w / h < 0.6 ? 52 : 42;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ entrance

  /** The hero walks up from the last encounter; the enemy rises or marches in. */
  private async enter() {
    const fromZ = this.heroMark.z + SPOT_GAP;
    this.hero.root.position.set(this.heroMark.x - 0.8, 0, fromZ);
    this.camFollow.set(0, 0, SPOT_GAP);
    const boss = this.o.enemy.boss;
    if (boss) {
      this.enemy.root.position.set(this.enemyMark.x, 0, this.enemyMark.z - 9);
      this.enemy.face(this.heroMark);
      this.enemy.loop(this.enemy.idle);
      void this.enemy.walkTo(this.enemyMark, 1.6, 'Walking_D_Skeletons').then(() => this.enemy.face(this.heroMark));
    } else {
      this.enemy.root.position.copy(this.enemyMark);
      this.enemy.face(this.heroMark);
      this.enemy.root.visible = false;
    }
    this.hero.loop('Walking_A');
    this.tween(SPOT_GAP / 3.2, (k) => this.camFollow.set(0, 0, this.entering ? SPOT_GAP * (1 - k) : 0));
    await this.hero.walkTo(this.heroMark, 3.2, 'Running_A');
    if (this.destroyed || !this.entering) return;
    this.hero.face(this.enemyMark);
    if (!boss) {
      this.enemy.root.visible = true;
      this.fx.burst(this.enemyMark.clone().setY(0.2), { count: 26, speed: 4, colors: [0x9a948a, 0xd9cfc0, 0x5c544b], gravity: -6, life: 0.8, size: 0.35 });
      this.o.onStomp?.();
      await this.enemy.once('Spawn_Ground_Skeletons');
      if (!this.entering) return;
    } else {
      this.shake = 0.12;
      this.o.onStomp?.();
      await this.enemy.once('Taunt');
      this.o.onRoar?.();
    }
    this.entering = false;
    this.lastHitAt = this.time;
  }

  // ------------------------------------------------------------ inputs

  setHp(pct: number) {
    if (!this.ready || this.dead) return;
    const breaks = this.o.enemy.breaks;
    const due = Math.floor((1 - pct) * (breaks.length + 1) + 1e-6);
    while (this.broken < Math.min(due, breaks.length)) this.breakOff(breaks[this.broken++]);
  }

  hit(_x: number, _y: number, multiplier: number, gained: number): { move: Move; bolt: boolean } | undefined {
    if (!this.ready || this.dead) return undefined;
    this.lastHitAt = this.time;
    this.nextAttackIn = rand(7, 12);
    const countered = this.time < this.counterUntil;
    this.counterUntil = 0;
    const bolt = multiplier >= 3 && (multiplier === 4 || Math.random() < 0.5);
    if (this.busy) {
      // Taps faster than the animation queue one follow-up swing.
      if (this.queued.length < 1) this.queued.push({ mult: multiplier, gained });
      else this.popNumber(`+${gained}`, multiplier);
    } else void this.strike(multiplier, gained, countered, bolt);
    const moves: Move[] = ['slash', 'backslash', 'thrust', 'smash'];
    return { move: countered ? 'smash' : moves[this.attackIdx % moves.length], bolt };
  }

  comboUp(multiplier: number) {
    if (!this.ready) return;
    const label = ({ 2: 'COMBO ×2', 3: 'TRIPLE ×3', 4: 'UNSTOPPABLE ×4' } as Record<number, string>)[multiplier];
    if (label) this.text(label, 0.5, 0.3, '#ffc94d', 46, 1.4);
    this.heroLight.color.set(multiplier >= 3 ? 0xffc94d : 0xffffff);
    this.tween(0.5, (k) => (this.heroLight.intensity = 4 * (1 - k)));
    this.fx.rise(this.hero.root.position.clone(), 0.7, 14, [0xffc94d, 0xff8a3d, 0xffffff], 2.4);
    if (multiplier >= 3) this.lightning();
  }

  windup(on: boolean) {
    this.windupOn = on;
    if (!on || !this.ready || this.dead) return;
    this.text('WIND-UP!', 0.5, 0.3, '#ff5a4d', 56, 1.6);
    this.shake = Math.max(this.shake, 0.15);
    const casting = this.o.enemy.model === 'Skeleton_Mage';
    this.enemy.idle = casting ? 'Spellcasting' : 'Blocking';
    this.enemy.loop(this.enemy.idle, { fade: 0.2 });
    this.o.onRoar?.();
  }

  windupResult(beaten: boolean, bonus = 0) {
    if (!this.ready || this.dead) return;
    this.windupOn = false;
    this.enemy.idle = 'Idle_Combat';
    if (beaten) {
      void this.bigStrike(async () => {
        this.text('PARRY!', 0.5, 0.26, '#7dd3fc', 44, 1.4);
        this.text('CRITICAL!', 0.5, 0.33, '#ffc94d', 64, 1.8);
        if (bonus) this.text(`+${bonus}`, 0.5, 0.4, '#ffc94d', 42, 1.6);
        this.fx.burst(this.enemyChest(), { count: 60, speed: 9, colors: [0xffc94d, 0xffffff, 0xff6b3d], additive: true, gravity: -4, life: 0.8, size: 0.25 });
        await this.enemy.once('Hit_B', { speed: 0.8 });
      });
    } else {
      this.healGlow = 1;
      this.enemy.loop(this.enemy.idle);
      void this.enemy.once('Spellcast_Raise');
      this.fx.rise(this.enemy.root.position.clone(), 1.2 * this.o.enemy.size, 40, [0x4ade80, 0xbbf7d0], 2);
      this.text('WARD HEALED', 0.5, 0.3, '#4ade80', 40, 1.6);
      window.setTimeout(() => this.enemyAttack(true), 900);
    }
  }

  undo() {
    if (this.ready) this.text('UNDO', 0.5, 0.36, '#9a93bd', 30, 1);
  }

  /** A quick step is done: one strike and the minion collapses into bones. */
  async defeat(): Promise<void> {
    if (!this.ready || this.dead) return;
    this.dead = true;
    await this.waitForEntrance();
    await this.attackRun(this.heroDef.attacks[0], 1.4, () => {
      this.impact(4, 1.2);
      void this.enemy.once(this.o.enemy.boss ? 'Death_A' : 'Death_C_Skeletons', { hold: true });
      this.fx.burst(this.enemyChest(), { count: 40, speed: 6, colors: [...this.o.enemy.material, 0xffffff], shards: true, gravity: -14, life: 1, size: 0.22 });
    });
    this.hero.face(this.enemyMark);
    await sleep(700);
  }

  /** The finisher: a leaping strike in slow motion, and the boss falls. */
  async die(): Promise<void> {
    if (!this.ready || this.dead) return;
    this.dead = true;
    this.windupOn = false;
    await this.waitForEntrance();
    await this.bigStrike(async () => {
      this.slow(0.25, 700);
      this.text('FINISHED!', 0.5, 0.3, '#ffc94d', 68, 2);
      this.flash(0.9);
      this.fx.burst(this.enemyChest(), { count: 90, speed: 11, colors: [...this.o.enemy.material, 0xffffff], shards: true, gravity: -14, life: 1.3, size: 0.28 });
      this.fx.burst(this.enemyChest(), { count: 50, speed: 7, colors: [0xffc94d, 0xffffff], additive: true, gravity: 0, life: 0.9, size: 0.3 });
      for (const b of this.o.enemy.breaks.slice(this.broken)) this.breakOff(b, true);
      await this.enemy.once(this.o.enemy.model.startsWith('Skeleton') ? 'Death_C_Skeletons' : 'Death_A', { hold: true });
    }, this.heroDef.finisher);
    void this.hero.once('Cheer');
    await sleep(1300);
  }

  /** Machine cycle running: the enemy naps, the hero sits and waits. */
  setDormant(on: boolean) {
    if (on === this.dormant) return;
    this.dormant = on;
    if (!this.ready || this.dead) return;
    void this.waitForEntrance().then(async () => {
      if (this.dormant !== on || this.dead) return;
      if (on) {
        this.enemy.idle = 'Lie_Idle';
        void this.enemy.once('Lie_Down', { hold: true }).then(() => this.dormant && this.enemy.loop('Lie_Idle'));
        this.hero.idle = 'Sit_Floor_Idle';
        void this.hero.once('Sit_Floor_Down', { hold: true }).then(() => this.dormant && this.hero.loop('Sit_Floor_Idle'));
      } else {
        this.enemy.idle = 'Idle_Combat';
        void this.enemy.once('Lie_StandUp');
        this.hero.idle = this.heroDef.idle;
        void this.hero.once('Sit_Floor_StandUp');
      }
    });
  }

  // ------------------------------------------------------------ combat

  /** Player finished before the entrance did: skip straight to the fight. */
  private async waitForEntrance() {
    if (!this.entering) return;
    this.entering = false;
    void this.hero.walkTo(this.heroMark, 1000);
    this.hero.root.position.copy(this.heroMark);
    this.hero.face(this.enemyMark);
    this.camFollow.set(0, 0, 0);
    void this.enemy.walkTo(this.enemyMark, 1000, 'Walking_D_Skeletons');
    this.enemy.root.position.copy(this.enemyMark);
    this.enemy.root.visible = true;
    this.enemy.face(this.heroMark);
    this.enemy.loop(this.enemy.idle, { fade: 0.1 });
    await sleep(30);
  }

  private async strike(mult: number, gained: number, countered: boolean, bolt: boolean) {
    this.busy = true;
    await this.waitForEntrance();
    if (this.destroyed || this.dead) {
      this.busy = false;
      return;
    }
    const attacks = this.heroDef.attacks;
    const clip = countered ? this.heroDef.special : attacks[this.attackIdx++ % attacks.length];
    const speed = countered ? 1.3 : 1.7;
    await this.attackRun(clip, speed, () => {
      this.impact(mult, countered ? 1.5 : 1);
      this.popNumber(`+${gained}`, mult);
      if (countered) this.text('COUNTER!', 0.5, 0.27, '#7dd3fc', 52, 1.4);
      if (bolt) this.lightning();
      if (!this.dormant && !this.dead) void this.enemy.once(Math.random() < 0.5 ? 'Hit_A' : 'Hit_B', { speed: 1.4 });
    });
    const next = this.queued.shift();
    if (next && !this.dead && !this.destroyed) {
      void this.strike(next.mult, next.gained, false, false);
      return;
    }
    this.busy = false;
  }

  /** Dashes in (or casts from range), plays the attack, calls impact mid-swing, steps back. */
  private async attackRun(clip: string, speed: number, onImpact: () => void) {
    const reach = 1.5 + this.o.enemy.size * 0.45;
    const toEnemy = this.enemyMark.clone().sub(this.heroMark).setY(0).normalize();
    const lungeTo = this.heroDef.ranged ? this.heroMark.clone() : this.enemyMark.clone().addScaledVector(toEnemy, -reach);
    const from = this.hero.root.position.clone();
    this.hero.face(this.enemyMark);
    this.tween(0.13, (k) => this.hero.root.position.lerpVectors(from, lungeTo, 1 - (1 - k) * (1 - k)));
    const dur = this.hero.duration(clip) / speed;
    const impactAt = dur * (this.heroDef.ranged ? 0.5 : 0.42);
    const playing = this.hero.once(clip, { speed });
    window.setTimeout(() => {
      if (this.destroyed) return;
      if (this.heroDef.ranged) this.bolt(onImpact);
      else onImpact();
    }, impactAt * 1000);
    await playing;
    if (this.destroyed) return;
    const back = this.hero.root.position.clone();
    await new Promise<void>((resolve) =>
      this.tween(0.22, (k) => this.hero.root.position.lerpVectors(back, this.heroMark, k), resolve),
    );
  }

  /** Parries and finishers: a special move with a held impact beat. */
  private async bigStrike(onImpact: () => Promise<void>, clip = this.heroDef.special) {
    while (this.busy && !this.destroyed) await sleep(40);
    this.busy = true;
    let impact: Promise<void> = Promise.resolve();
    await this.attackRun(clip, 1.15, () => {
      this.impact(5, 1.8);
      impact = onImpact();
    });
    await impact;
    this.busy = false;
  }

  /** The mage's spell: a glowing bolt from the staff to the enemy. */
  private bolt(onImpact: () => void) {
    const from = this.hero.root.position.clone().add(new Vector3(0.3, 1.8, -0.4));
    const to = this.enemyChest();
    const light = new PointLight(0x9fd8ff, 10, 5, 1.5);
    this.scene.add(light);
    this.tween(
      0.18,
      (k) => {
        const p = from.clone().lerp(to, k);
        light.position.copy(p);
        this.fx.burst(p, { count: 4, speed: 0.6, colors: [0x9fd8ff, 0xffffff, 0xc084fc], additive: true, gravity: 0, life: 0.35, size: 0.3 });
      },
      () => {
        this.scene.remove(light);
        onImpact();
      },
    );
  }

  private impact(mult: number, power: number) {
    const chest = this.enemyChest();
    this.fx.slash(chest, this.camera.position, rand(-1.2, 1.2), mult >= 3 ? 0xffc94d : this.o.trail, 0.8 + this.o.enemy.size * 0.35);
    this.fx.burst(chest, { count: 12 + mult * 5, speed: 6 + mult, colors: this.o.enemy.material, shards: true, gravity: -14, life: 0.9, size: 0.16 });
    this.fx.burst(chest, { count: 10 + mult * 3, speed: 5, colors: [0xffffff, 0xffe9a8], additive: true, gravity: 0, life: 0.35, size: 0.22 });
    this.hitStop = 0.05 + mult * 0.012 * power;
    this.shake = Math.max(this.shake, 0.06 + mult * 0.025 * power);
    this.flashLevel = 1;
    // Knocked back a step, then it plants its feet again.
    const away = this.enemyMark.clone().sub(this.heroMark).setY(0).normalize().multiplyScalar(0.25 * power);
    const base = this.enemyMark.clone();
    this.tween(0.35, (k) => {
      const push = Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k * 0.3);
      this.enemy.root.position.copy(base).addScaledVector(away, push);
    });
  }

  /** The enemy lunges at the hero, who blocks. Purely cosmetic: HP never changes. */
  private enemyAttack(big: boolean) {
    if (!this.ready || this.dead || this.dormant || this.busy) return;
    const caster = this.o.enemy.attack.startsWith('Spellcast');
    const toHero = this.heroMark.clone().sub(this.enemyMark).setY(0).normalize();
    const lunge = caster ? this.enemyMark.clone() : this.heroMark.clone().addScaledVector(toHero, -(1.3 + this.o.enemy.size * 0.5));
    const from = this.enemy.root.position.clone();
    this.tween(0.18, (k) => this.enemy.root.position.lerpVectors(from, lunge, k));
    const clip = this.o.enemy.attack;
    const speed = 1.2;
    void this.enemy.once(clip, { speed }).then(() => {
      const back = this.enemy.root.position.clone();
      this.tween(0.3, (k) => this.enemy.root.position.lerpVectors(back, this.enemyMark, k));
    });
    window.setTimeout(() => {
      if (this.destroyed || this.dead) return;
      void this.hero.once('Block_Hit', { speed: 1.2 });
      this.fx.burst(this.hero.root.position.clone().add(new Vector3(0.2, 1.4, -0.5)), { count: 18, speed: 5, colors: [0xffffff, 0xffd36b], additive: true, gravity: -6, life: 0.4, size: 0.18 });
      this.shake = Math.max(this.shake, big ? 0.3 : 0.2);
      this.hurt(big ? 1 : 0.7);
      this.counterUntil = this.time + 1.6;
      this.o.onBossAttack?.(big);
    }, (this.enemy.duration(clip) / speed) * 0.45 * 1000);
  }

  private lightning() {
    this.flash(0.7);
    const top = this.enemyChest().clone().setY(9);
    for (let i = 0; i < 10; i++) {
      const p = top.clone().lerp(this.enemyChest(), i / 9);
      p.x += rand(-0.4, 0.4);
      this.fx.burst(p, { count: 3, speed: 0.5, colors: [0xc7e9ff, 0xffffff], additive: true, gravity: 0, life: 0.3, size: 0.5 });
    }
    this.enemyLight.color.set(0xc7e9ff);
    this.tween(0.3, (k) => (this.enemyLight.intensity = 30 * (1 - k)));
  }

  /** A piece of armor (shield, helmet, hat) breaks off and clatters to the floor. */
  private breakOff(name: string, quiet = false) {
    const part = name === 'offhand' ? this.enemy.model.getObjectByName('offhand') : this.enemy.part(name);
    if (!part || !part.parent) return;
    part.updateWorldMatrix(true, false);
    const pos = new Vector3();
    part.getWorldPosition(pos);
    const scale = new Vector3();
    part.getWorldScale(scale);
    this.scene.attach(part);
    const away = this.enemyMark.clone().sub(this.heroMark).setY(0).normalize();
    this.debris.push({
      obj: part,
      vel: new Vector3(rand(-2, 2), rand(4, 6), 0).addScaledVector(away, rand(1, 2.5)),
      spin: new Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)),
    });
    if (quiet) return;
    this.text('BROKEN!', 0.5, 0.2, '#ffffff', 50, 1.3);
    this.fx.burst(pos, { count: 30, speed: 7, colors: this.o.enemy.material, shards: true, gravity: -14, life: 1, size: 0.2 });
    this.shake = Math.max(this.shake, 0.25);
    this.hitStop = Math.max(this.hitStop, 0.12);
    void this.enemy.once('Hit_B', { speed: 0.9 });
  }

  // ------------------------------------------------------------ frame

  private frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (performance.now() > this.slowUntil) this.slowMo = 1;

    // Hit-stop freezes the fighters for a beat; the camera keeps shaking.
    const frozen = this.hitStop > 0;
    this.hitStop = Math.max(0, this.hitStop - dt);
    const sdt = frozen ? dt * 0.04 : dt * this.slowMo;
    this.time += sdt;

    this.hero.update(sdt);
    this.enemy.update(sdt);
    this.fx.update(sdt);
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += sdt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.step(k);
      if (k >= 1) {
        this.tweens.splice(i, 1);
        tw.done?.();
      }
    }
    for (const d of this.debris) {
      if (d.obj.position.y <= 0.15 && d.vel.y <= 0) continue;
      d.vel.y -= 16 * sdt;
      d.obj.position.addScaledVector(d.vel, sdt);
      d.obj.rotation.x += d.spin.x * sdt;
      d.obj.rotation.z += d.spin.z * sdt;
      if (d.obj.position.y < 0.15) {
        d.obj.position.y = 0.15;
        d.vel.set(0, 0, 0);
      }
    }

    this.behave(sdt);
    this.lights(dt);
    this.placeCamera(dt);
    renderer().render(this.scene, this.camera);
  };

  /** What the enemy does between your hits: taunts, attacks when you stall. */
  private behave(dt: number) {
    if (this.entering || this.dead) return;
    if (this.dormant) {
      this.zzz -= dt;
      if (this.zzz <= 0) {
        this.zzz = rand(1.1, 1.7);
        const p = this.project(this.enemy.root.position.clone().add(new Vector3(0.4, 1.4 * this.o.enemy.size, 0)));
        this.text(Math.random() < 0.5 ? 'z' : 'Z', p.x, p.y, '#c7d2fe', rand(28, 40), 2.2, true);
      }
      return;
    }
    if (!this.o.passive && !this.windupOn && !this.busy && this.time - this.lastHitAt > this.nextAttackIn) {
      this.lastHitAt = this.time;
      this.nextAttackIn = rand(8, 14);
      this.enemyAttack(false);
      return;
    }
    this.nextTaunt -= dt;
    if (this.nextTaunt <= 0 && !this.busy && !this.windupOn) {
      this.nextTaunt = rand(5, 9);
      void this.enemy.once('Taunt');
    }
  }

  private lights(dt: number) {
    const t = this.time;
    this.torchLights.forEach((l, i) => {
      if (l.intensity > 0) l.intensity = (i === 0 && !this.torchLights[1].intensity ? 18 : 14) * (0.85 + Math.sin(t * 13 + i * 3) * 0.07 + Math.sin(t * 7.3 + i) * 0.06);
    });
    this.healGlow = Math.max(0, this.healGlow - dt * 0.6);
    const chest = this.enemyChest();
    if (this.windupOn) {
      this.enemyLight.color.set(0xff3b30);
      this.enemyLight.intensity = 10 + Math.sin(t * 9) * 5;
    } else if (this.healGlow > 0.05) {
      this.enemyLight.color.set(0x4ade80);
      this.enemyLight.intensity = 14 * this.healGlow;
    } else if (this.enemyLight.color.getHex() !== 0xc7e9ff) {
      this.enemyLight.intensity *= 0.9;
    }
    this.enemyLight.position.set(chest.x, chest.y + 0.5, chest.z + 1.2);
    this.heroLight.position.copy(this.hero.root.position).add(new Vector3(0, 1.6, 0.6));
    this.flashLevel = Math.max(0, this.flashLevel - dt * 9);
    for (const m of this.enemyMats) {
      m.emissive.setRGB(this.flashLevel, this.flashLevel, this.flashLevel);
    }
  }

  private placeCamera(dt: number) {
    const s = this.shake;
    this.shake = Math.max(0, this.shake - dt * 1.2);
    const sway = Math.sin(this.time * 0.4) * 0.12;
    this.camera.position.set(this.camBase.x + sway + rand(-s, s), this.camBase.y + rand(-s, s), this.camBase.z + this.camFollow.z);
    this.camera.lookAt(this.camLook.x, this.camLook.y, this.camLook.z + this.camFollow.z * 0.9);
  }

  // ------------------------------------------------------------ helpers

  private enemyChest() {
    return this.enemy.root.position.clone().add(new Vector3(0, 1.25 * this.o.enemy.size, 0));
  }

  private tween(dur: number, step: (k: number) => void, done?: () => void) {
    this.tweens.push({ t: 0, dur, step, done });
  }

  private slow(scale: number, ms: number) {
    this.slowMo = scale;
    this.slowUntil = performance.now() + ms;
  }

  private flash(level: number) {
    this.flashEl.style.transition = 'none';
    this.flashEl.style.opacity = String(level);
    requestAnimationFrame(() => {
      this.flashEl.style.transition = 'opacity 450ms ease-out';
      this.flashEl.style.opacity = '0';
    });
  }

  private hurt(level: number) {
    this.hurtEl.style.transition = 'none';
    this.hurtEl.style.opacity = String(level);
    requestAnimationFrame(() => {
      this.hurtEl.style.transition = 'opacity 700ms ease-out';
      this.hurtEl.style.opacity = '0';
    });
  }

  /** World point to 0–1 screen coordinates. */
  private project(p: Vector3) {
    const v = p.clone().project(this.camera);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  private popNumber(text: string, mult: number) {
    const p = this.project(this.enemyChest().add(new Vector3(rand(-0.6, 0.6), 0.6, 0)));
    this.text(text, p.x, p.y, mult >= 3 ? '#ffc94d' : '#ffffff', 34 + mult * 5, 1);
  }

  /** Floating text over the scene, in screen fractions. */
  private text(text: string, x: number, y: number, color: string, size: number, hold = 1, drift = false) {
    const el = document.createElement('div');
    el.className = drift ? 'world-float world-float-drift' : 'world-float';
    el.textContent = text;
    el.style.left = `${x * 100}%`;
    el.style.top = `${y * 100}%`;
    el.style.color = color;
    el.style.fontSize = `${size}px`;
    el.style.animationDuration = `${900 * hold}ms`;
    this.overlay.appendChild(el);
    window.setTimeout(() => el.remove(), 900 * hold + 50);
  }
}

