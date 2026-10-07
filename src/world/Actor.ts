import {
  AnimationAction,
  AnimationMixer,
  Color,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type AnimationClip,
  type Object3D,
} from 'three';

/**
 * One animated character: a KayKit model, its animation mixer, and the few
 * moves the game asks of it (play a clip, play one and wait, walk somewhere).
 */

interface PlayOptions {
  fade?: number;
  speed?: number;
  /** Hold the last frame instead of returning to the idle loop. */
  hold?: boolean;
}

interface Walk {
  from: Vector3;
  to: Vector3;
  t: number;
  dur: number;
  resolve: () => void;
  face: boolean;
}

export class Actor {
  readonly root = new Group();
  readonly model: Group;
  private mixer: AnimationMixer;
  private clips: Map<string, AnimationClip>;
  private actions = new Map<string, AnimationAction>();
  private current?: AnimationAction;
  private waiting = new Map<AnimationAction, () => void>();
  private walk?: Walk;
  idle = 'Idle';
  /** Uniform size; enemies get bigger as they get more important. */
  size = 1;

  constructor(model: Group, clips: Map<string, AnimationClip>) {
    this.model = model;
    this.clips = clips;
    this.root.add(model);
    this.mixer = new AnimationMixer(model);
    this.mixer.addEventListener('finished', (e) => {
      const action = e.action as AnimationAction;
      this.waiting.get(action)?.();
    });
  }

  private action(name: string) {
    let a = this.actions.get(name);
    if (!a) {
      const clip = this.clips.get(name);
      if (!clip) throw new Error(`No animation ${name}`);
      a = this.mixer.clipAction(clip);
      this.actions.set(name, a);
    }
    return a;
  }

  has(name: string) {
    return this.clips.has(name);
  }

  duration(name: string) {
    return this.clips.get(name)?.duration ?? 0;
  }

  /** Crossfades to a looping clip. */
  loop(name: string, o: PlayOptions = {}) {
    const a = this.action(name);
    if (this.current === a && a.isRunning()) return a;
    a.reset();
    a.setLoop(LoopRepeat, Infinity);
    a.timeScale = o.speed ?? 1;
    a.clampWhenFinished = false;
    this.fadeTo(a, o.fade ?? 0.25);
    return a;
  }

  /** Plays a clip once; resolves when it ends, then returns to idle unless held. */
  once(name: string, o: PlayOptions = {}): Promise<void> {
    const a = this.action(name);
    a.reset();
    a.setLoop(LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = o.speed ?? 1;
    this.fadeTo(a, o.fade ?? 0.12);
    // A clip interrupted by another one (or restarted) counts as finished.
    for (const [other, done] of this.waiting) {
      this.waiting.delete(other);
      done();
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (this.waiting.get(a) === finish) this.waiting.delete(a);
        if (!o.hold && this.current === a) this.loop(this.idle, { fade: 0.2 });
        resolve();
      };
      this.waiting.set(a, finish);
      // Never leave a caller hanging, whatever happens to the mixer.
      window.setTimeout(finish, ((a.getClip().duration / Math.max(0.1, a.timeScale)) * 1000) / 0.2 + 500);
    });
  }

  private fadeTo(a: AnimationAction, fade: number) {
    const prev = this.current;
    a.enabled = true;
    a.setEffectiveWeight(1);
    a.play();
    if (prev && prev !== a) a.crossFadeFrom(prev, fade, false);
    this.current = a;
  }

  /** Walks (or runs) to a point on the floor, turning to face where it is going. */
  walkTo(to: Vector3, speed = 1.6, clip = 'Walking_A', face = true): Promise<void> {
    const from = this.root.position.clone();
    const dist = from.distanceTo(to);
    if (dist < 0.01) return Promise.resolve();
    this.walk?.resolve();
    this.loop(clip, { fade: 0.2, speed: clip.startsWith('Running') ? 1 : 1.1 });
    return new Promise((resolve) => {
      this.walk = { from, to: to.clone(), t: 0, dur: dist / speed, resolve, face };
    });
  }

  /** Turns to look at a point (yaw only). */
  face(target: Vector3) {
    const d = target.clone().sub(this.root.position);
    this.root.rotation.y = Math.atan2(d.x, d.z);
  }

  /** Finds a bone or part by its name in the model file. */
  part(name: string): Object3D | undefined {
    // GLTFLoader strips dots from node names ("handslot.r" becomes "handslotr").
    return this.model.getObjectByName(name.replace(/\./g, ''));
  }

  /** Shows only the listed props among the ones the model ships with. */
  showOnly(props: string[], all: string[]) {
    for (const name of all) {
      const p = this.part(name);
      if (p) p.visible = props.includes(name);
    }
  }

  /** Puts a prop (weapon, shield) in a hand. */
  attach(prop: Object3D, bone = 'handslot.r') {
    this.part(bone)?.add(prop);
  }

  /** Dyes a part (cloak, hat) a solid color, without new textures. */
  tint(partName: string, color: number) {
    const p = this.part(partName);
    p?.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      // Cloth in the atlas is dark, so a dye replaces the color rather than multiplying it.
      const mat = (m.material as MeshStandardMaterial).clone();
      mat.map = null;
      mat.color = new Color(color).convertSRGBToLinear();
      m.material = mat;
    });
  }

  /** Makes a part glow (eyes, crown). */
  glow(partName: string, color: number, intensity = 2) {
    const p = this.part(partName);
    p?.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as MeshStandardMaterial).clone();
      mat.emissive = new Color(color);
      mat.emissiveIntensity = intensity;
      m.material = mat;
    });
  }

  update(dt: number) {
    this.mixer.update(dt);
    const w = this.walk;
    if (w) {
      w.t += dt;
      const k = Math.min(1, w.t / w.dur);
      this.root.position.lerpVectors(w.from, w.to, k);
      if (w.face) {
        const d = w.to.clone().sub(w.from);
        const target = Math.atan2(d.x, d.z);
        let diff = target - this.root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.root.rotation.y += diff * Math.min(1, dt * 10);
      }
      if (k >= 1) {
        this.walk = undefined;
        this.loop(this.idle, { fade: 0.25 });
        w.resolve();
      }
    }
  }

  get walking() {
    return !!this.walk;
  }
}
