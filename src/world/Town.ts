import {
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three';
import { Actor } from './Actor';
import { animationClips, character, piece } from './assets';
import { hero as heroDef, HEROES } from './cast';
import { mergeStatic } from './lairs';
import { renderer } from './World';

/**
 * The walk to a lair: the hero sets off down the village road past houses and
 * cheering villagers, to the lair's gate. A short cutscene (tap to skip)
 * between picking a quest and its first step.
 */

export type TownRegion = 'laundry' | 'dishes' | 'clutter' | 'throne';

const S = 4; // Town pieces are map-sized; scaled up to walk among.
const HEX_W = 2 * S;
const ROW = 1.732 * S;

const GATE_COLOR: Record<TownRegion, number> = {
  laundry: 0x9b6bff,
  dishes: 0x5ad1f0,
  clutter: 0xf2a03d,
  throne: 0xffd24d,
};

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

let townCache: Promise<Group> | undefined;

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
  private startX = -HEX_W * 1.8;
  private gateX = HEX_W * 3.2;

  /** Resolves when the hero reaches the gate (or the scene is torn down). */
  async play(host: HTMLElement, o: TownOptions): Promise<void> {
    this.host = host;
    townCache ??= buildTown();
    townCache.catch(() => (townCache = undefined));
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
    await this.hero.walkTo(new Vector3(this.gateX + 6, 0, 0.5), 2.4, 'Walking_A');
  }

  destroy() {
    this.destroyed = true;
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
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.6 ? 58 : 44;
    this.camera.updateProjectionMatrix();
  }

  private frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    for (const a of this.actors) a.update(dt);
    // A low side-on tracking shot, a little ahead of the hero.
    const p = this.hero.root.position;
    this.camera.position.set(p.x - 2, 6.5, p.z + 17);
    this.camera.lookAt(p.x + 3, 2.2, p.z - 2);
    renderer().render(this.scene, this.camera);
  };
}
