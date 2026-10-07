import { BufferGeometry, Color, Group, Mesh, MeshStandardMaterial, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { piece } from './assets';
import type { LairId } from './cast';

/**
 * The four lairs, built from KayKit pieces as a long hall the hero walks down.
 * Each quest step is fought at the next spot along the hall, so a level feels
 * like pushing deeper into the lair. Static pieces are merged per material,
 * which keeps the whole hall to a handful of draw calls on a phone.
 */

/** Distance between encounter spots along the hall (toward -z). */
export const SPOT_GAP = 9;
export const SPOTS = 7;
const HALF_W = 8;
const LENGTH = SPOT_GAP * SPOTS + 16;

export interface LairLook {
  fog: number;
  fogNear: number;
  fogFar: number;
  sky: number;
  ground: number;
  key: number;
  torch: number;
  /** Ambient strength, a little brighter for homier lairs. */
  ambient: number;
}

interface LairDef {
  look: LairLook;
  floor: string;
  floorY: number;
  wall: string[];
  /** Big props along the walls, picked at random. */
  side: string[];
  /** Small clutter scattered on the floor near the walls. */
  scatter: string[];
  /** Hung on the walls between props. */
  wallDecor: string[];
  torches: boolean;
  end: (g: Group, z: number) => Promise<void>;
}

const at = async (g: Group, name: string, x: number, y: number, z: number, ry = 0, s = 1) => {
  const p = await piece(name);
  p.position.set(x, y, z);
  p.rotation.y = ry;
  p.scale.setScalar(s);
  g.add(p);
  return p;
};

const LAIRS: Record<LairId, LairDef> = {
  laundry: {
    look: { fog: 0x1b1233, fogNear: 10, fogFar: 42, sky: 0xb8a6ff, ground: 0x2a1d3d, key: 0xffe2c4, torch: 0xff9a3c, ambient: 1.1 },
    floor: 'd_floor_tile_large',
    floorY: 0,
    wall: ['d_wall', 'd_wall', 'd_wall_arched'],
    side: ['d_barrel_large', 'd_crates_stacked', 'd_box_stacked', 'd_trunk_large_A', 'd_barrel_small_stack', 'd_bed_decorated', 'f_cabinet_medium_decorated'],
    scatter: ['f_pillow_A', 'f_pillow_B', 'f_pillow_A', 'f_rug_oval_A'],
    wallDecor: ['d_banner_patternB_blue', 'd_banner_patternA_red', 'd_shelves'],
    torches: true,
    end: async (g, z) => {
      await at(g, 'd_wall_doorway', 0, 0, z);
      await at(g, 'd_stairs_wide', 0, 0, z + 0.6, Math.PI, 0.8);
    },
  },
  dishes: {
    look: { fog: 0x0d2230, fogNear: 10, fogFar: 44, sky: 0xc9f0ff, ground: 0x23343a, key: 0xfff1d6, torch: 0x9fe8ff, ambient: 1.3 },
    floor: 'k_floor_kitchen',
    floorY: -0.5,
    wall: ['k_wall', 'k_wall_window_closed'],
    side: ['k_kitchencounter_sink_backsplash', 'k_stove_multi_decorated', 'k_fridge_A_decorated', 'k_kitchencounter_straight_decorated', 'k_kitchentable_A_large_decorated', 'k_crate_tomatoes', 'k_kitchencounter_straight_A_backsplash'],
    scatter: ['k_plate_dirty', 'k_bowl_dirty', 'k_pot_A_stew', 'k_pan_A', 'k_dishrack_plates', 'k_plate_dirty'],
    wallDecor: ['k_shelf_papertowel_decorated', 'k_kitchencabinet'],
    torches: false,
    end: async (g, z) => {
      for (let i = -3; i <= 3; i += 2) await at(g, i === 1 ? 'k_kitchencounter_sink_backsplash' : 'k_kitchencounter_straight_decorated', i, 0, z + 1.2);
      await at(g, 'k_wall', -2, 0, z);
      await at(g, 'k_wall', 2, 0, z);
    },
  },
  clutter: {
    look: { fog: 0x1f1712, fogNear: 10, fogFar: 42, sky: 0xe8e4ff, ground: 0x2e2420, key: 0xfff4e6, torch: 0xffc27a, ambient: 1.1 },
    floor: 'd_floor_wood_large',
    floorY: 0,
    wall: ['d_wall', 'd_wall', 'd_wall_arched'],
    side: ['f_couch_pillows', 'f_armchair_pillows', 'f_cabinet_medium_decorated', 'f_table_medium_long', 'f_lamp_standing', 'd_box_stacked', 'd_crates_stacked', 'f_bed_double_A'],
    scatter: ['f_book_set', 'f_rug_rectangle_stripes_A', 'f_pillow_B', 'f_cactus_medium_A', 'f_chair_A'],
    wallDecor: ['f_pictureframe_large_A', 'f_shelf_B_large_decorated', 'd_shelves'],
    torches: true,
    end: async (g, z) => {
      await at(g, 'd_wall_doorway', 0, 0, z);
      await at(g, 'd_box_stacked', -4, 0, z + 2);
      await at(g, 'd_crates_stacked', 4, 0, z + 2, 0.4);
    },
  },
  throne: {
    look: { fog: 0x1d0c26, fogNear: 12, fogFar: 46, sky: 0xffd9a8, ground: 0x2b1533, key: 0xffe8c0, torch: 0xffb347, ambient: 1.05 },
    floor: 'd_floor_tile_large',
    floorY: 0,
    wall: ['d_wall', 'd_wall_arched'],
    side: ['d_pillar_decorated', 'd_coin_stack_large', 'd_chest_gold', 'd_pillar_decorated', 'd_keg_decorated', 'd_table_long_decorated_A'],
    scatter: ['d_coin_stack_large', 'd_candle_triple', 'f_pillow_A'],
    wallDecor: ['d_banner_patternA_red', 'd_banner_thin_yellow', 'd_sword_shield_gold'],
    torches: true,
    end: async (g, z) => {
      await at(g, 'd_stairs_wide', 0, 0, z + 0.2, 0, 1);
      const throne = await at(g, 'f_armchair_pillows', 0, 5.1, z + 2.2, 0, 1.8);
      throne.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh) {
          const mat = (m.material as MeshStandardMaterial).clone();
          mat.color = new Color(0xffd24d);
          m.material = mat;
        }
      });
      await at(g, 'd_banner_patternA_red', -3, 0, z - 0.4);
      await at(g, 'd_banner_patternA_red', 3, 0, z - 0.4);
    },
  },
};

export const lairLook = (id: LairId) => LAIRS[id].look;

/** A tiny seeded random, so a lair looks the same on every visit. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BuiltLair {
  root: Group;
  /** Wall torch positions, for the flickering lights. */
  torches: { x: number; y: number; z: number }[];
}

export async function buildLair(id: LairId): Promise<BuiltLair> {
  const def = LAIRS[id];
  const g = new Group();
  const rand = rng(id.length * 7919 + id.charCodeAt(0));
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const jobs: Promise<unknown>[] = [];
  const torches: BuiltLair['torches'] = [];
  const zStart = 10;
  const zEnd = -LENGTH;

  // Floor.
  for (let z = zStart; z > zEnd - 4; z -= 4) {
    for (let x = -HALF_W + 2; x < HALF_W; x += 4) jobs.push(at(g, def.floor, x, def.floorY, z));
  }
  // Side walls, facing in.
  for (let z = zStart; z > zEnd; z -= 4) {
    jobs.push(at(g, pick(def.wall), -HALF_W, 0, z - 2, Math.PI / 2));
    jobs.push(at(g, pick(def.wall), HALF_W, 0, z - 2, -Math.PI / 2));
  }
  // Props along both walls, leaving the middle of the hall clear for fights.
  for (let z = zStart - 2; z > zEnd + 4; z -= 3.2) {
    for (const side of [-1, 1]) {
      const r = rand();
      if (r < 0.55) jobs.push(at(g, pick(def.side), side * (HALF_W - 1.6), def.floorY > 0 ? def.floorY : 0, z + rand() - 0.5, side < 0 ? Math.PI / 2 : -Math.PI / 2));
      else if (r < 0.85) {
        for (let i = 0; i < 2; i++) {
          jobs.push(at(g, pick(def.scatter), side * (HALF_W - 1.5 - rand() * 2.5), 0, z + rand() * 2 - 1, rand() * Math.PI * 2));
        }
      }
    }
  }
  // Decorations on the walls, and torches between them.
  for (let z = zStart - 4; z > zEnd + 4; z -= 6) {
    for (const side of [-1, 1]) {
      const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      if (def.torches && Math.round(z) % 12 === 0) {
        jobs.push(at(g, 'd_torch_mounted', side * (HALF_W - 0.5), 2.4, z, ry));
        torches.push({ x: side * (HALF_W - 1.2), y: 3, z });
      } else {
        jobs.push(at(g, pick(def.wallDecor), side * (HALF_W - 0.5), def.wallDecor[0].startsWith('d_banner') ? 0 : 2.2, z, ry));
      }
    }
  }
  jobs.push(def.end(g, zEnd));
  await Promise.all(jobs);

  return { root: mergeStatic(g), torches };
}

/** Merges every mesh that shares a material into one, baking transforms in. */
export function mergeStatic(src: Group): Group {
  src.updateMatrixWorld(true);
  const byMat = new Map<string, { mat: Material; geos: BufferGeometry[] }>();
  src.traverse((o: Object3D) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const mat = m.material as MeshStandardMaterial;
    // Pieces from one pack share a texture atlas and a material name.
    const key = `${mat.name}|${mat.color?.getHexString()}`;
    const geo = m.geometry.clone();
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) return;
    const indexed = geo.index ? geo : geo;
    indexed.applyMatrix4(m.matrixWorld);
    let entry = byMat.get(key);
    if (!entry) {
      entry = { mat, geos: [] };
      byMat.set(key, entry);
    }
    entry.geos.push(indexed.index ? indexed : indexed.toNonIndexed());
  });
  const out = new Group();
  for (const { mat, geos } of byMat.values()) {
    const indexed = geos.filter((g) => g.index);
    const plain = geos.filter((g) => !g.index);
    for (const set of [indexed, plain]) {
      if (!set.length) continue;
      const merged = mergeGeometries(set, false);
      if (!merged) continue;
      const mesh = new Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      out.add(mesh);
    }
    for (const g of geos) g.dispose();
  }
  return out;
}
