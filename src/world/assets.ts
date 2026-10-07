import { AnimationClip, Group, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Loads the KayKit models (built by tools/models.mjs) once and hands out clones.
 * Every character shares one rig, so one clip library animates them all.
 */

const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();

function load(url: string): Promise<GLTF> {
  let p = cache.get(url);
  if (!p) {
    p = loader.loadAsync(url);
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

function prepare(root: Object3D) {
  root.traverse((o) => {
    if ((o as Mesh).isMesh) {
      const m = o as Mesh;
      m.castShadow = true;
      m.receiveShadow = true;
      // Low-poly art reads best a little rough, with no metal sheen.
      const mat = m.material as MeshStandardMaterial;
      if (mat?.isMeshStandardMaterial) {
        mat.metalness = 0;
        mat.roughness = Math.max(mat.roughness, 0.75);
      }
    }
  });
  return root;
}

/** A character, cloned with its own skeleton so it can animate independently. */
export async function character(name: string): Promise<Group> {
  const gltf = await load(`/models/chars/${name}.glb`);
  return prepare(cloneSkinned(gltf.scene)) as Group;
}

/** A static piece (furniture, walls, weapons). */
export async function piece(name: string): Promise<Group> {
  const gltf = await load(`/models/env/${name}.glb`);
  return prepare(gltf.scene.clone(true)) as Group;
}

let clips: Promise<Map<string, AnimationClip>> | undefined;

export function animationClips(): Promise<Map<string, AnimationClip>> {
  clips ??= load('/models/anims.glb').then((g) => {
    const map = new Map<string, AnimationClip>();
    for (const c of g.animations) {
      // Root motion would drag characters off their marks; the game moves them itself.
      c.tracks = c.tracks.filter((t) => !/^root\.position/.test(t.name));
      map.set(c.name, c);
    }
    return map;
  });
  return clips;
}

/** Warm the cache while the player is on another screen. */
export function preload(names: string[]) {
  void animationClips();
  for (const n of names) void load(n.startsWith('/') ? n : `/models/chars/${n}.glb`).catch(() => undefined);
}
