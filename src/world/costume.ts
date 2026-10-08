import {
  AdditiveBlending,
  CanvasTexture,
  Box3,
  CapsuleGeometry,
  PlaneGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
  type Object3D,
} from 'three';
import type { Actor } from './Actor';
import { piece } from './assets';

/**
 * Each boss dressed in its own lair: the Lich floats in a ghostly robe with
 * socks circling it, the Warlord wears a stew pot and swings a frying pan,
 * the Colossus is a walking heap of boxes and books, and the Mess King is a
 * bloated, slime-stained king in a crown, crawling with flies, junk orbiting
 * him and a stink cloud rising off him.
 *
 * Pieces worn on the body are placed in world space next to a bone and then
 * parented to it, so they follow the animation without knowing bone axes.
 */

export type CostumeId = 'lich' | 'warlord' | 'colossus' | 'king';

export interface Costume {
  /** Animated bits: orbiting junk, flies, drips, suds. */
  update(dt: number, t: number): void;
  /** The costume's own glow (slime, suds, ghost light). */
  light?: PointLight;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function std(color: number, o: Partial<MeshStandardMaterial> = {}) {
  return new MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
}

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

/** Gives a prop its own materials (pieces share theirs across clones). */
function own(obj: Object3D, f?: (m: MeshStandardMaterial) => void) {
  obj.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as MeshStandardMaterial).clone();
    f?.(mat);
    m.material = mat;
    m.castShadow = true;
  });
  return obj;
}

/** Stains a material: keeps its texture, shifts its color toward grime. */
function grime(color: number, amount = 1) {
  return (m: MeshStandardMaterial) => {
    m.color = new Color(0xffffff).lerp(new Color(color), amount);
  };
}

function sock(color: number) {
  const g = new Group();
  const mat = std(color);
  const leg = new Mesh(new CapsuleGeometry(0.07, 0.28, 4, 8), mat);
  const foot = new Mesh(new CapsuleGeometry(0.07, 0.14, 4, 8), mat);
  foot.rotation.z = Math.PI / 2;
  foot.position.set(0.08, -0.17, 0);
  const cuff = new Mesh(new TorusGeometry(0.07, 0.025, 6, 12), std(0xffffff));
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = 0.17;
  g.add(leg, foot, cuff);
  g.traverse((o) => ((o as Mesh).castShadow = true));
  return g;
}

function crown() {
  const g = new Group();
  g.name = 'crown';
  const gold = std(0xffc53d, { metalness: 0.6, roughness: 0.35, emissive: new Color(0x5a3a00), emissiveIntensity: 0.6 });
  const band = new Mesh(new CylinderGeometry(0.3, 0.27, 0.2, 14, 1, true), gold);
  band.material.side = DoubleSide;
  g.add(band);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const spike = new Mesh(new ConeGeometry(0.06, 0.22, 6), gold);
    spike.position.set(Math.sin(a) * 0.29, 0.2, Math.cos(a) * 0.29);
    g.add(spike);
    const gem = new Mesh(new SphereGeometry(0.035, 8, 6), std(i % 2 ? 0x22c55e : 0xff2d2d, { emissive: new Color(i % 2 ? 0x22c55e : 0xff2d2d), emissiveIntensity: 2 }));
    gem.position.set(Math.sin(a) * 0.31, 0.32, Math.cos(a) * 0.31);
    g.add(gem);
  }
  // Something sticky dripped down one side.
  const goo = new Mesh(new CapsuleGeometry(0.03, 0.12, 4, 6), std(0x6b8f1a, { emissive: new Color(0x2a3a00), roughness: 0.3 }));
  goo.position.set(0.28, -0.06, 0.08);
  g.add(goo);
  g.traverse((o) => ((o as Mesh).castShadow = true));
  return g;
}

function plunger() {
  const g = new Group();
  const stick = new Mesh(new CylinderGeometry(0.045, 0.05, 1.7, 8), std(0x8a5a2b));
  stick.position.y = 0.55;
  const cup = new Mesh(new SphereGeometry(0.26, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xc0262d, { roughness: 0.45 }));
  cup.material.side = DoubleSide;
  cup.rotation.x = Math.PI;
  cup.position.y = 1.5;
  const slime = new Mesh(new SphereGeometry(0.12, 8, 6), std(0x7ba828, { emissive: new Color(0x3a5a00), roughness: 0.2 }));
  slime.position.y = 1.5;
  slime.scale.set(1.2, 0.5, 1.2);
  g.add(stick, cup, slime);
  g.traverse((o) => ((o as Mesh).castShadow = true));
  return g;
}

/** A tangle of cables hanging off the Colossus. */
function cable(len: number) {
  const g = new Group();
  const mat = std(0x1d1d1d, { roughness: 0.5 });
  let y = 0;
  for (let i = 0; i < 5; i++) {
    const seg = new Mesh(new CylinderGeometry(0.025, 0.025, len / 5, 6), mat);
    seg.position.set(Math.sin(i * 1.7) * 0.06, y - len / 10, Math.cos(i * 1.3) * 0.06);
    seg.rotation.z = Math.sin(i) * 0.4;
    y -= len / 5;
    g.add(seg);
  }
  const plug = new Mesh(new CylinderGeometry(0.06, 0.06, 0.12, 6), std(0xe6e6e6));
  plug.position.y = y;
  g.add(plug);
  return g;
}

interface Floater {
  obj: Object3D;
  radius: number;
  height: number;
  speed: number;
  phase: number;
  bob: number;
  spin: Vector3;
}

class Kit implements Costume {
  floaters: Floater[] = [];
  motes: { s: Sprite; vel: Vector3; life: number; max: number; from: () => Vector3; size: number; fade: number }[] = [];
  flies: { m: Mesh; phase: number; r: number; speed: number }[] = [];
  flyCenter?: Object3D;
  light?: PointLight;
  hover = 0;
  hoverBase = 0;
  readonly actor: Actor;
  constructor(actor: Actor) {
    this.actor = actor;
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
      this.actor.root.worldToLocal(c);
      for (const f of this.flies) {
        const a = t * f.speed + f.phase;
        f.m.position.set(c.x + Math.cos(a) * f.r, c.y + Math.sin(a * 1.7) * 0.25 + 0.15, c.z + Math.sin(a * 1.3) * f.r);
      }
    }
    if (this.hover) this.actor.model.position.y = this.hoverBase + this.hover * (0.5 + Math.sin(t * 1.8) * 0.5);
    if (this.light) this.light.intensity = this.light.userData.base * (0.8 + Math.sin(t * 5) * 0.12 + Math.sin(t * 13) * 0.08);
  }

  orbit(obj: Object3D, radius: number, height: number, speed: number, phase: number, bob = 0.15) {
    this.actor.root.add(obj);
    this.floaters.push({ obj, radius, height, speed, phase, bob, spin: new Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)) });
  }

  /** A stream of soft sprites: suds, dust, stink. */
  stream(n: number, color: number, from: () => Vector3, vel: () => Vector3, life: number, size: number, opts: { additive?: boolean; fade?: number } = {}) {
    for (let i = 0; i < n; i++) {
      const s = new Sprite(
        new SpriteMaterial({ map: dotTexture(), color, transparent: true, depthWrite: false, blending: opts.additive ? AdditiveBlending : undefined, opacity: 0 }),
      );
      s.position.copy(from());
      this.actor.root.add(s);
      this.motes.push({ s, vel: vel(), life: rand(0, life), max: life, from, size, fade: opts.fade ?? 0.8 });
    }
  }

  swarm(center: Object3D, n: number) {
    this.flyCenter = center;
    const mat = std(0x111111, { roughness: 0.4 });
    const geo = new SphereGeometry(0.05, 5, 4);
    for (let i = 0; i < n; i++) {
      const m = new Mesh(geo, mat);
      this.actor.root.add(m);
      this.flies.push({ m, phase: rand(0, Math.PI * 2), r: rand(0.35, 0.8), speed: rand(4, 9) * (Math.random() < 0.5 ? -1 : 1) });
    }
  }

  glowLight(color: number, intensity: number, y: number) {
    const l = new PointLight(color, intensity, 7, 1.6);
    l.userData.base = intensity;
    l.position.set(0, y, 1.6);
    this.actor.root.add(l);
    this.light = l;
  }
}

/** Where a bone is, in the actor's own (unscaled) space. */
function boneAt(actor: Actor, name: string) {
  const b = actor.part(name)!;
  const p = new Vector3();
  b.getWorldPosition(p);
  return actor.root.worldToLocal(p);
}

/**
 * Wears a piece on a bone: placed at an offset from the bone (actor space,
 * scaled by actor size), then parented so it moves with the animation.
 */
function wear(actor: Actor, bone: string, obj: Object3D, offset: [number, number, number], scale: number, rot: [number, number, number] = [0, 0, 0], name?: string) {
  const at = boneAt(actor, bone).add(new Vector3(...offset));
  obj.position.copy(at);
  obj.rotation.set(...rot);
  obj.scale.setScalar(scale);
  if (name) obj.name = name;
  actor.root.add(obj);
  actor.root.updateMatrixWorld(true);
  actor.part(bone)!.attach(obj);
  return obj;
}

function hide(actor: Actor, names: string[]) {
  for (const n of names) {
    const p = actor.part(n);
    if (p) p.visible = false;
  }
}

/** Recolors every body mesh, keeping the texture. */
function stainBody(actor: Actor, color: number, amount: number, skip: string[] = []) {
  actor.model.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || skip.some((s) => m.name.startsWith(s) || m.parent?.name.startsWith(s))) return;
    const mat = (m.material as MeshStandardMaterial).clone();
    grime(color, amount)(mat);
    m.material = mat;
  });
}

export async function dress(actor: Actor, id: CostumeId): Promise<Costume> {
  // Pose it first, so pieces sit where the body really is.
  actor.loop('Idle_Combat', { fade: 0 });
  actor.update(0.01);
  actor.root.updateMatrixWorld(true);
  const kit = new Kit(actor);
  const head = boneAt(actor, 'head');
  const H = head.y; // roughly the height of the neck
  // The skull is big (chibi proportions): hats sit on its top, not at the neck.
  const skull = actor.model.getObjectByName(actor.model.getObjectByName('Skeleton_Mage_Skull') ? 'Skeleton_Mage_Skull' : 'Skeleton_Warrior_Head')!;
  const box = new Box3().setFromObject(skull);
  const scale = actor.root.getWorldScale(new Vector3()).y;
  const top = (box.max.y - actor.root.getWorldPosition(new Vector3()).y) / scale - H;

  if (id === 'lich') {
    // A ghostly robe of washing-day sheets instead of legs, floating.
    const robeH = H * 0.95;
    const robe = new Mesh(
      new CylinderGeometry(0.42, 0.95, robeH, 20, 3, true),
      std(0x4c1d95, { transparent: true, opacity: 0.85, emissive: new Color(0x6d28d9), emissiveIntensity: 0.55, side: DoubleSide }),
    );
    // Ragged hem: pull every other bottom vertex up.
    const pos = robe.geometry.attributes.position;
    for (let v = 0; v < pos.count; v++) if (pos.getY(v) < -robeH / 2 + 0.01 && v % 2) pos.setY(v, pos.getY(v) + 0.25);
    wear(actor, 'hips', robe, [0, -robeH / 2 + 0.15, 0], 1);
    hide(actor, ['Skeleton_Mage_LegLeft', 'Skeleton_Mage_LegRight']);
    kit.hover = 0.25;
    kit.hoverBase = 0.35;
    // A sock draped over the hat, and a ring of socks circling the Lich.
    wear(actor, 'head', sock(0xff7eb6), [0.35, top * 0.75, 0.1], 1.6, [0, 0, -1.2], 'hatsock');
    const colors = [0xff7eb6, 0x60a5fa, 0xfacc15, 0x4ade80, 0xf97316, 0xe5e7eb];
    colors.forEach((c, i) => kit.orbit(sock(c), 1.15, H * 0.75, 1.1, (i / colors.length) * Math.PI * 2, 0.25));
    kit.stream(14, 0xc4b5fd, () => new Vector3(rand(-0.6, 0.6), rand(0, 0.4), rand(-0.6, 0.6)), () => new Vector3(0, rand(0.3, 0.7), 0), 2.2, 0.45, { additive: true, fade: 0.6 });
    kit.glowLight(0xa78bfa, 6, H * 0.8);
  }

  if (id === 'warlord') {
    hide(actor, ['Skeleton_Warrior_Helmet']);
    // A stew pot for a helmet, still dripping.
    const pot = own(await piece('k_pot_A_stew'), grime(0x9fb8c0, 0.3));
    wear(actor, 'head', pot, [0, top + 0.02, 0], 0.75, [Math.PI, 0.3, 0.12], 'pothelm');
    // Bowls for shoulder plates.
    wear(actor, 'upperarm.l', own(await piece('k_bowl_dirty')), [0.05, 0.12, 0], 0.9, [0, 0, 0.5]);
    wear(actor, 'upperarm.r', own(await piece('k_bowl_dirty')), [-0.05, 0.12, 0], 0.9, [0, 0, -0.5]);
    // A frying pan to swing and a dirty plate for a shield.
    const pan = own(await piece('k_pan_A'));
    pan.scale.setScalar(0.75);
    pan.rotation.set(Math.PI / 2, 0, 0);
    pan.position.set(0, 0.1, 0);
    actor.part('handslot.r')?.add(pan);
    const plate = own(await piece('k_plate_dirty'));
    plate.name = 'offhand';
    plate.scale.setScalar(1.05);
    plate.rotation.set(0, 0, Math.PI / 2);
    actor.part('handslot.l')?.add(plate);
    // Soap suds bubbling off it, and the odd drip.
    kit.stream(18, 0xe0f7ff, () => new Vector3(rand(-0.5, 0.5), rand(H * 0.2, H * 1.1), rand(-0.4, 0.4)), () => new Vector3(rand(-0.1, 0.1), rand(0.25, 0.6), rand(-0.1, 0.1)), 2, 0.28, { fade: 0.9 });
    kit.stream(8, 0x7dd3fc, () => new Vector3(rand(-0.4, 0.4), H * 0.9, rand(-0.3, 0.3)), () => new Vector3(0, -2.2, 0), 0.6, 0.12, { additive: true, fade: 0.7 });
    kit.glowLight(0x38bdf8, 5, H * 0.9);
  }

  if (id === 'colossus') {
    hide(actor, ['Skeleton_Warrior_Helmet']);
    // Built out of the clutter it guards.
    const box = own(await piece('d_box_stacked'));
    wear(actor, 'chest', box, [0, H * 0.05, -0.35], 0.24, [0, 0.4, 0.1], 'backbox');
    const lamp = own(await piece('f_lamp_standing'), (m) => (m.emissive = new Color(0x4a3000)));
    wear(actor, 'chest', lamp, [-0.2, H * 0.15, -0.35], 0.45, [0, 0, 0.35]);
    wear(actor, 'upperarm.l', own(await piece('f_book_set')), [0.1, 0.2, 0], 0.8, [0, 0.3, 0.4]);
    wear(actor, 'upperarm.r', own(await piece('f_book_set')), [-0.1, 0.2, 0], 0.8, [0, -0.3, -0.4]);
    const bucket = own(await piece('d_barrel_small_stack'));
    wear(actor, 'head', bucket, [0, top - 0.05, 0], 0.32, [0, 0.5, 0.08], 'bucket');
    for (const [bone, x] of [['lowerarm.l', 0.05], ['lowerarm.r', -0.05], ['hips', 0.25], ['hips', -0.25]] as const) {
      wear(actor, bone, cable(rand(0.3, 0.5)), [x, 0, 0.05], 1);
    }
    // Swings a lamp; a picture frame for a shield.
    const club = own(await piece('f_lamp_standing'));
    club.scale.setScalar(0.55);
    club.rotation.set(0, 0, 0);
    club.position.set(0, -0.1, 0);
    actor.part('handslot.r')?.add(club);
    const frame = own(await piece('f_pictureframe_large_A'));
    frame.name = 'offhand';
    frame.scale.setScalar(0.8);
    frame.rotation.set(0, Math.PI / 2, 0);
    actor.part('handslot.l')?.add(frame);
    kit.stream(20, 0xb8ab98, () => new Vector3(rand(-0.9, 0.9), rand(0, 0.3), rand(-0.9, 0.9)), () => new Vector3(rand(-0.2, 0.2), rand(0.2, 0.5), rand(-0.2, 0.2)), 2.5, 0.6, { fade: 0.45 });
    kit.glowLight(0xffb347, 4, H * 0.9);
  }

  if (id === 'king') {
    hide(actor, ['Skeleton_Mage_Hat']);
    // Bloated and stained with every spill in the kingdom.
    actor.model.scale.set(1.4, 1, 1.3);
    stainBody(actor, 0x5f7a1c, 0.9);
    actor.glow('Skeleton_Mage_Eyes', 0xff1a0a, 6);
    wear(actor, 'head', crown(), [0.06, top - 0.02, 0], 1.3, [0.1, 0, -0.25], 'crown');
    // A tattered, filthy cape.
    const capeMat = std(0x3b2a1a, { side: DoubleSide, roughness: 0.95 });
    const cape = new Mesh(new PlaneGeometry(1.3, H * 0.95, 6, 4), capeMat);
    const cp = cape.geometry.attributes.position;
    for (let v = 0; v < cp.count; v++) {
      const y = cp.getY(v);
      cp.setZ(v, Math.sin(cp.getX(v) * 3) * 0.08 - (y < 0 ? y * 0.25 : 0));
      if (y < -H * 0.4 && v % 2) cp.setY(v, y + 0.2);
    }
    wear(actor, 'chest', cape, [0, -H * 0.3, -0.38], 1, [0.12, 0, 0]);
    // A puddle of slime wherever he stands.
    const puddle = new Mesh(new CylinderGeometry(1.25, 1.25, 0.02, 24), std(0x4d7c0f, { emissive: new Color(0x365314), emissiveIntensity: 0.9, roughness: 0.1, transparent: true, opacity: 0.85 }));
    puddle.position.y = 0.02;
    actor.root.add(puddle);
    // A gut of garbage around the middle.
    const gut: [string, [number, number, number], number, [number, number, number]][] = [
      ['k_plate_dirty', [0, 0.05, 0.42], 0.75, [1.3, 0, 0.2]],
      ['k_bowl_dirty', [0.38, 0.15, 0.2], 1.1, [0.4, 0, -0.8]],
      ['f_pillow_B', [-0.38, 0.1, 0.18], 1.0, [0.3, 0.4, 1.2]],
      ['k_pan_A', [0.3, -0.15, -0.25], 0.6, [0.6, 1.2, 0.4]],
      ['f_book_set', [-0.3, -0.12, -0.3], 0.6, [0.3, -0.6, 0.2]],
    ];
    let i = 0;
    for (const [name, off, s, rot] of gut) {
      const p = own(await piece(name), grime(0x7a8a3a, 0.7));
      wear(actor, 'spine', p, off, s, rot, `gut${i++}`);
    }
    // Slime dribbling off his chin and robe.
    const slime = std(0x84cc16, { emissive: new Color(0x365314), emissiveIntensity: 0.8, roughness: 0.15 });
    for (let k = 0; k < 6; k++) {
      const d = new Mesh(new CapsuleGeometry(0.035, rand(0.12, 0.3), 4, 6), slime);
      wear(actor, k < 2 ? 'head' : 'chest', d, [rand(-0.25, 0.25), k < 2 ? -0.12 : rand(-0.1, 0.2), 0.28], 1);
    }
    const p = plunger();
    actor.part('handslot.r')?.add(p);
    // Junk circling him, a cloud of flies and a stink you can see.
    const junk = ['k_plate_dirty', 'f_pillow_A', 'k_bowl_dirty', 'f_book_set'];
    for (let j = 0; j < 4; j++) kit.orbit(own(await piece(junk[j]), grime(0x9aa860, 0.4)), 1.4, H * (0.55 + (j % 2) * 0.35), 0.8, j * (Math.PI / 2), 0.2);
    for (let j = 0; j < 3; j++) kit.orbit(sock([0x6b7f2a, 0x8a6a3a, 0x4a4a4a][j]), 1.6, H * 0.4, -0.6, j * 2.1, 0.3);
    kit.swarm(actor.part('head')!, 26);
    kit.stream(22, 0x9bc53d, () => new Vector3(rand(-0.8, 0.8), rand(0, H * 0.6), rand(-0.6, 0.6)), () => new Vector3(rand(-0.1, 0.1), rand(0.35, 0.8), rand(-0.1, 0.1)), 2.6, 0.75, { fade: 0.42 });
    kit.stream(10, 0x84cc16, () => new Vector3(rand(-0.5, 0.5), H * rand(0.5, 0.9), rand(0.1, 0.4)), () => new Vector3(0, -2, 0), 0.7, 0.14, { fade: 0.9 });
    kit.glowLight(0x84cc16, 4, H * 0.3);
  }

  return kit;
}
