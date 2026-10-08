import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Object3D,
} from 'three';
import { Actor } from './Actor';
import { animationClips, character, piece } from './assets';
import { hero as heroDef, HEROES, type LairId } from './cast';
import { lairLook, mergeStatic } from './lairs';
import { environment, Motes, Post } from './post';
import { lair, renderer } from './World';

/**
 * The walk to a lair: the hero sets off down the village road past houses and
 * cheering villagers, to the lair's gate. A short cutscene (tap to skip)
 * between picking a quest and its first step.
 */

export type TownRegion = LairId;

const S = 4; // Town pieces are map-sized; scaled up to walk among.
const HEX_W = 2 * S;
const ROW = 1.732 * S;

const GATE_COLOR: Record<TownRegion, number> = {
  laundry: 0x9b6bff,
  dishes: 0x5ad1f0,
  clutter: 0xf2a03d,
  bathroom: 0x2dd4bf,
  bedroom: 0x818cf8,
  floors: 0xd6b56b,
  trash: 0x84cc16,
  throne: 0xffd24d,
};

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

let townCache: Promise<Group> | undefined;

let flame: CanvasTexture | undefined;
function flameTexture() {
  if (flame) return flame;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 44, 2, 16, 40, 30);
  grad.addColorStop(0, 'rgba(255,255,230,1)');
  grad.addColorStop(0.4, 'rgba(255,200,120,0.8)');
  grad.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(16, 40, 13, 24, 0, 0, Math.PI * 2);
  g.fill();
  flame = new CanvasTexture(c);
  return flame;
}

export function preloadTown(heroId?: string) {
  townCache ??= buildTown();
  townCache.catch(() => (townCache = undefined));
  void character(heroDef(heroId).id).catch(() => undefined);
}

async function buildTown(): Promise<Group> {
  const g = new Group();
  const jobs: Promise<unknown>[] = [];
  const put = (name: string, x: number, z: number, ry = 0, s = S) =>
    jobs.push(
      piece(name).then((p) => {
        p.position.set(x, 0, z);
        p.rotation.y = ry;
        p.scale.setScalar(s);
        g.add(p);
      }),
    );
  // Hex ground: pointy-top rows along x; the road runs down row 0.
  for (let r = -3; r <= 4; r++) {
    for (let c = -7; c <= 7; c++) {
      const x = c * HEX_W + (r & 1 ? HEX_W / 2 : 0);
      put(r === 0 ? 't_hex_road_A' : 't_hex_grass', x, r * ROW, 0);
    }
  }
  // Houses along the road, behind it and in front.
  const houses = ['t_building_home_A_blue', 't_building_home_B_red', 't_building_tavern_green', 't_building_home_A_yellow', 't_building_market_red', 't_building_blacksmith_blue', 't_building_well_blue', 't_building_home_B_red'];
  houses.forEach((h, i) => put(h, (i - 4) * HEX_W * 1.6 + HEX_W * 0.5, -ROW * 1.05, Math.PI * (i % 2 ? 0.1 : -0.1)));
  put('t_building_windmill_yellow', -HEX_W * 6, -ROW * 2.2, 0.4);
  put('t_building_castle_red', HEX_W * 2, -ROW * 3.3, 0);
  // Trees and hills behind the village; the near side stays open for the camera.
  for (let i = -6; i <= 6; i += 2) put(i % 4 ? 't_trees_A_large' : 't_trees_B_medium', i * HEX_W + 3, -ROW * 2.4, i);
  for (let i = -7; i <= 7; i += 3) put('t_mountain_A_grass_trees', i * HEX_W, -ROW * 4.1, i, S * 1.6);
  put('t_barrel', -HEX_W * 1.2, ROW * 0.45, 0, S * 2.5);
  put('t_crate_A_big', HEX_W * 0.6, -ROW * 0.42, 0.3, S * 2.5);
  put('t_sack', HEX_W * 2.5, ROW * 0.42, 0, S * 3);
  await Promise.all(jobs);
  return mergeStatic(g);
}

export interface TownOptions {
  hero: string | undefined;
  region: TownRegion;
}

export class Town {
  private host!: HTMLElement;
  private scene = new Scene();
  private camera = new PerspectiveCamera(46, 1, 0.5, 260);
  private actors: Actor[] = [];
  private hero!: Actor;
  private raf = 0;
  private last = 0;
  private destroyed = false;
  private resize?: ResizeObserver;
  private startX = -HEX_W * 0.8;
  private gateX = HEX_W * 3.2;
  /** Inside the lair: the hall, its torches and the chase camera. */
  private inside?: {
    scene: Scene;
    post: Post;
    door?: Object3D;
    motes: Motes;
    torches: { light: PointLight; flame: Sprite; z: number; on: number }[];
  };
  private time = 0;

  /** Resolves when the hero reaches the gate (or the scene is torn down). */
  async play(host: HTMLElement, o: TownOptions): Promise<void> {
    this.host = host;
    townCache ??= buildTown();
    townCache.catch(() => (townCache = undefined));
    void lair(o.region).catch(() => undefined);
    const h = heroDef(o.hero);
    const others = HEROES.filter((x) => x.id !== h.id && x.id !== 'Rogue_Hooded').slice(0, 3);
    const [town, clips, heroModel, gate, ...villagers] = await Promise.all([
      townCache,
      animationClips(),
      character(h.id),
      piece('d_wall_doorway'),
      ...others.map((v) => character(v.id)),
    ]);
    if (this.destroyed) return;

    this.scene.background = new Color(0x9fd3ff);
    this.scene.fog = new Fog(0x9fd3ff, 60, 170);
    const sun = new DirectionalLight(0xfff1d6, 2.6);
    sun.position.set(-30, 50, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -30;
    sc.right = 30;
    sc.top = 30;
    sc.bottom = -30;
    sc.far = 140;
    sun.shadow.normalBias = 0.05;
    this.scene.add(new HemisphereLight(0xdff2ff, 0x6a8f4e, 1.5), sun, sun.target);
    town.removeFromParent();
    this.scene.add(town);

    // The lair gate at the end of the road, hung with its region's color.
    gate.position.set(this.gateX + 6, 0, 0);
    gate.rotation.y = Math.PI / 2;
    gate.scale.setScalar(1.4);
    gate.traverse((m) => {
      const mesh = m as Mesh;
      if (mesh.isMesh) {
        const mat = (mesh.material as MeshStandardMaterial).clone();
        mat.emissive = new Color(GATE_COLOR[o.region]);
        mat.emissiveIntensity = 0.12;
        mesh.material = mat;
      }
    });
    this.scene.add(gate);

    this.hero = new Actor(heroModel, clips);
    this.hero.showOnly(h.carry, h.props);
    this.hero.root.position.set(this.startX, 0, 0.5);
    this.hero.root.rotation.y = Math.PI / 2;
    this.scene.add(this.hero.root);
    this.actors.push(this.hero);

    // Villagers line the road and cheer the hero on.
    villagers.forEach((model, i) => {
      const v = new Actor(model, clips);
      const def = others[i];
      v.showOnly([], def.props);
      v.idle = 'Idle';
      v.root.position.set(-HEX_W * 0.6 + i * HEX_W * 1.4, 0, i % 2 ? 3.2 : -3.2);
      v.face(new Vector3(v.root.position.x + 2, 0, 0.5));
      v.loop('Idle');
      this.scene.add(v.root);
      this.actors.push(v);
    });

    const canvas = renderer().domElement;
    canvas.className = 'world-canvas';
    canvas.style.opacity = '0';
    host.append(canvas);
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(host);
    this.fit();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    requestAnimationFrame(() => (canvas.style.opacity = '1'));

    // The walk itself.
    const walk = this.hero.walkTo(new Vector3(this.gateX, 0, 0.5), 5.2, 'Running_A');
    const cheer = async () => {
      for (const [i, v] of this.actors.slice(1).entries()) {
        await sleep(350 + i * 450);
        if (this.destroyed) return;
        void v.once(i % 2 ? 'Cheer' : 'Interact');
      }
    };
    void cheer();
    await walk;
    if (this.destroyed) return;
    await this.hero.walkTo(new Vector3(this.gateX + 4.5, 0, 0.5), 2.4, 'Walking_A');
    if (this.destroyed) return;
    await this.enterLair(o.region, canvas);
  }

  /** Through the gate: the hero walks into the lair hall as its torches flare up. */
  private async enterLair(region: TownRegion, canvas: HTMLCanvasElement) {
    canvas.style.transition = 'opacity 350ms ease-in';
    canvas.style.opacity = '0';
    const [built] = await Promise.all([lair(region), sleep(380)]);
    if (this.destroyed) return;
    const look = lairLook(region);
    const scene = new Scene();
    scene.background = new Color(look.fog);
    scene.fog = new Fog(look.fog, 6, look.fogFar);
    scene.add(new HemisphereLight(look.sky, look.ground, look.ambient * 0.7));
    built.root.removeFromParent();
    scene.add(built.root);
    // The entrance: an arch in a wall, torches either side.
    const [door, wl, wr, wl2, wr2] = await Promise.all(['d_wall_doorway', 'd_wall', 'd_wall', 'd_wall', 'd_wall'].map((n) => piece(n)));
    if (this.destroyed) return;
    door.position.set(0, 0, 10);
    wl.position.set(-4, 0, 10);
    wr.position.set(4, 0, 10);
    wl2.position.set(-8, 0, 10);
    wr2.position.set(8, 0, 10);
    scene.add(door, wl, wr, wl2, wr2);
    // Flagstones up to the door.
    const tiles = await Promise.all([-6, -2, 2, 6].flatMap((x) => [14, 18].map((z) => piece('d_floor_tile_large').then((t) => (t.position.set(x, 0, z), t)))));
    if (this.destroyed) return;
    scene.add(...tiles);

    const flameTex = flameTexture();
    const torches: NonNullable<Town['inside']>['torches'] = [];
    const inner = built.torches.filter((t) => t.z > -26);
    // Kitchens have lamps overhead instead of torches.
    const lamps = inner.length ? [] : [6, -3, -12, -21].map((z) => ({ x: 0, y: 5.5, z }));
    const spots = [{ x: -2.4, y: 3, z: 10.8 }, { x: 2.4, y: 3, z: 10.8 }, ...inner, ...lamps];
    for (const t of spots) {
      const light = new PointLight(look.torch, 0, 12, 1.6);
      light.position.set(t.x, t.y, t.z);
      const flame = new Sprite(new SpriteMaterial({ map: flameTex, color: look.torch, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0 }));
      flame.position.set(t.x, t.y - 0.2, t.z);
      flame.scale.setScalar(0.9);
      flame.visible = t.y < 5;
      scene.add(light, flame);
      torches.push({ light, flame, z: t.z, on: 0 });
    }
    const motes = new Motes(120, look.torch, { x: 0, y: 0.3, z: 0 }, [12, 5, 26], 0.13);
    scene.add(motes.points);

    this.hero.root.removeFromParent();
    scene.add(this.hero.root);
    this.hero.root.position.set(0.4, 0, 17);
    this.hero.root.rotation.y = Math.PI;
    scene.environment = environment(renderer());
    scene.environmentIntensity = 0.35;
    const post = new Post(renderer(), scene, this.camera, 0.7);
    this.inside = { scene, post, motes, torches, door: door.getObjectByName('wall_doorway_door') };
    this.fit();
    canvas.style.transition = 'opacity 450ms ease-out';
    canvas.style.opacity = '1';
    await this.hero.walkTo(new Vector3(0.4, 0, 2), 2.8, 'Walking_A');
  }

  destroy() {
    this.destroyed = true;
    this.inside?.post.dispose();
    cancelAnimationFrame(this.raf);
    this.resize?.disconnect();
    const canvas = renderer().domElement;
    if (canvas.parentElement === this.host) canvas.remove();
    for (const c of [...this.scene.children]) this.scene.remove(c);
  }

  private fit() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    renderer().setSize(w, h, false);
    this.inside?.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.6 ? 58 : 44;
    this.camera.updateProjectionMatrix();
  }

  private frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    const p = this.hero.root.position;
    if (this.inside) {
      this.hero.update(dt);
      const { post, motes, torches } = this.inside;
      // Torches flare up as the hero gets near them.
      for (const t of torches) {
        if (p.z - t.z < 9) t.on = Math.min(1, t.on + dt * 2.5);
        const flick = 0.85 + Math.sin(this.time * 13 + t.z) * 0.08 + Math.sin(this.time * 7.1 + t.z * 2) * 0.07;
        t.light.intensity = 16 * t.on * flick;
        (t.flame.material as SpriteMaterial).opacity = t.on * flick;
        t.flame.scale.set(0.7 * flick, 1.1 * flick, 1);
      }
      motes.update(this.time);
      // The door swings open as the hero walks up to it.
      const door = this.inside.door;
      if (door) door.rotation.y = -Math.min(1, Math.max(0, (16.5 - p.z) / 3)) * 1.75;
      // Following behind the hero, looking down the hall.
      // Low and centred through the doorway, then up once inside the hall.
      const camZ = p.z + 7;
      const inHall = Math.min(1, Math.max(0, (8.5 - camZ) / 3));
      this.camera.position.set(p.x + 0.3 + inHall * 1, 2.3 + inHall * 1.2, camZ);
      this.camera.lookAt(p.x - 0.2, 1.6 + inHall * 0.2, p.z - 6);
      post.render(dt);
      return;
    }
    for (const a of this.actors) a.update(dt);
    // A low side-on tracking shot, a little ahead of the hero.
    this.camera.position.set(p.x - 2, 6.5, p.z + 17);
    this.camera.lookAt(p.x + 3, 2.2, p.z - 2);
    renderer().render(this.scene, this.camera);
  };
}
