// Builds the 3D models the game loads from the KayKit packs (CC0, Kay Lousberg).
//   node tools/models.mjs <folder with the cloned KayKit-* repos>
// Characters are written without animations; every clip lives once in anims.glb
// (all KayKit characters share one rig), trimmed to the clips the game plays.
import { NodeIO } from '@gltf-transform/core';
import { dedup, prune, resample } from '@gltf-transform/functions';
import { mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { globSync } from 'node:fs';

const SRC = process.argv[2];
const OUT = new URL('../public/models/', import.meta.url).pathname;
const io = new NodeIO();

export const CLIPS = [
  'Idle', 'Idle_Combat', '2H_Melee_Idle', 'Walking_A', 'Walking_B', 'Walking_D_Skeletons', 'Running_A',
  '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab',
  '1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Spin', '2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice',
  'Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab',
  'Spellcast_Shoot', 'Spellcast_Raise', 'Spellcast_Long', 'Spellcasting', 'Block', 'Block_Hit', 'Blocking',
  'Hit_A', 'Hit_B', 'Death_A', 'Death_B', 'Death_C_Skeletons', 'Spawn_Ground_Skeletons', 'Skeletons_Awaken_Floor',
  'Taunt', 'Cheer', 'Sit_Floor_Down', 'Sit_Floor_Idle', 'Sit_Floor_StandUp', 'Lie_Down', 'Lie_Idle', 'Lie_StandUp',
  'Dodge_Backward', 'Jump_Full_Short', 'Interact', 'PickUp', 'Use_Item', 'Unarmed_Melee_Attack_Punch_A',
];

function dropAnimations(doc, test) {
  for (const a of doc.getRoot().listAnimations()) {
    if (!test(a)) continue;
    // Samplers own the keyframe data; prune() then drops the orphaned accessors.
    for (const s of a.listSamplers()) s.dispose();
    for (const c of a.listChannels()) c.dispose();
    a.dispose();
  }
}

const find = (pattern) => globSync(join(SRC, pattern));

async function character(file, name) {
  const doc = await io.read(file);
  dropAnimations(doc, () => true);
  await doc.transform(prune(), dedup());
  await io.write(join(OUT, 'chars', `${name}.glb`), doc);
}

async function animations(file) {
  const doc = await io.read(file);
  dropAnimations(doc, (a) => !CLIPS.includes(a.getName()));
  // Keep only the rig: meshes are not needed in the clip library.
  for (const n of doc.getRoot().listNodes()) if (n.getMesh()) n.setMesh(null);
  await doc.transform(resample(), prune({ keepLeaves: true }), dedup());
  await io.write(join(OUT, 'anims.glb'), doc);
}

async function piece(file, name) {
  const doc = await io.read(file);
  await doc.transform(prune(), dedup());
  await io.write(join(OUT, 'env', `${name}.glb`), doc);
}

mkdirSync(join(OUT, 'chars'), { recursive: true });
mkdirSync(join(OUT, 'env'), { recursive: true });

for (const f of find('KayKit-Character-Pack-*/addons/*/Characters/gltf/*.glb')) await character(f, basename(f, '.glb'));
await animations(find('KayKit-Character-Pack-Skeletons-1.0/**/Characters/gltf/Skeleton_Warrior.glb')[0]);

// Environment pieces, by pack folder and file name.
const ENV = {
  'KayKit-Dungeon-Remastered-1.0': ['floor_tile_large', 'floor_wood_large', 'floor_dirt_large', 'wall', 'wall_arched', 'wall_doorway', 'wall_corner', 'pillar', 'pillar_decorated', 'column', 'torch_mounted', 'torch_lit', 'barrel_large', 'barrel_small_stack', 'crates_stacked', 'box_stacked', 'banner_patternA_red', 'banner_patternB_blue', 'banner_patternC_green', 'banner_thin_yellow', 'chest_gold', 'chest', 'stairs_wide', 'shelves', 'candle_triple', 'rubble_large', 'table_long_decorated_A', 'keg_decorated', 'trunk_large_A', 'coin_stack_large', 'bed_decorated', 'sword_shield_gold', 'bottle_A_green', 'bottle_B_brown', 'bottle_C_green', 'floor_tile_big_grate', 'floor_dirt_large_rocky', 'floor_wood_large_dark', 'wall_cracked', 'wall_broken', 'rubble_half', 'bed_floor', 'trunk_medium_A', 'stool', 'plate_stack', 'candle_lit', 'barrel_small'],
  'KayKit-Restaurant-Bits-1.0': ['floor_kitchen', 'kitchencounter_sink_backsplash', 'kitchencounter_straight_A_backsplash', 'kitchencounter_straight_decorated', 'stove_multi_decorated', 'fridge_A_decorated', 'dishrack_plates', 'plate_dirty', 'bowl_dirty', 'pot_A_stew', 'pan_A', 'kitchentable_A_large_decorated', 'shelf_papertowel_decorated', 'crate_tomatoes', 'wall', 'wall_window_closed', 'extractorhood', 'kitchencabinet', 'towelrail', 'papertowel', 'jar_A_large', 'jar_B_medium', 'jar_C_small', 'kitchentable_sink_large_decorated', 'food_ingredient_burger_trash', 'food_ingredient_ham_trash', 'crate', 'lid_large', 'pot_large'],
  'KayKit-Furniture-Bits-1.0': ['couch_pillows', 'armchair_pillows', 'bed_double_A', 'shelf_B_large_decorated', 'shelf_A_big', 'book_set', 'lamp_standing', 'table_medium_long', 'rug_rectangle_stripes_A', 'rug_oval_A', 'pillow_A', 'pillow_B', 'pictureframe_large_A', 'cabinet_medium_decorated', 'cactus_medium_A', 'chair_A', 'bed_double_B', 'bed_single_A', 'bed_single_B', 'cabinet_small_decorated', 'lamp_table', 'rug_oval_B', 'rug_rectangle_B', 'couch', 'table_low', 'shelf_A_small', 'armchair'],
  'KayKit-City-Builder-Bits-1.0': ['dumpster', 'trash_A', 'trash_B', 'box_A', 'box_B'],
  'KayKit-Medieval-Hexagon-Pack-1.0': ['hex_grass', 'hex_road_A', 'hex_road_B', 'hex_road_E', 'building_home_A_blue', 'building_home_B_red', 'building_home_A_yellow', 'building_tavern_green', 'building_market_red', 'building_well_blue', 'building_windmill_yellow', 'building_castle_red', 'building_blacksmith_blue', 'trees_A_large', 'trees_B_medium', 'tree_single_A', 'tree_single_B', 'hills_A_trees', 'mountain_A_grass_trees', 'fence_wood_straight', 'barrel', 'crate_A_big', 'sack', 'flag_red', 'tent', 'rock_single_A', 'cloud_big'],
};
for (const [pack, names] of Object.entries(ENV)) {
  for (const name of names) {
    const hit = [...find(`${pack}/**/gltf/**/${name}.gltf*`), ...find(`${pack}/**/gltf/**/${name}.glb`)][0];
    if (!hit) {
      console.warn('missing', pack, name);
      continue;
    }
    const prefix = { 'KayKit-Dungeon-Remastered-1.0': 'd_', 'KayKit-Restaurant-Bits-1.0': 'k_', 'KayKit-Furniture-Bits-1.0': 'f_', 'KayKit-Medieval-Hexagon-Pack-1.0': 't_', 'KayKit-City-Builder-Bits-1.0': 'c_' }[pack];
    await piece(hit, prefix + name);
  }
}
for (const f of find('KayKit-Character-Pack-Skeletons-1.0/**/Assets/gltf/Skeleton_*.gltf')) await piece(f, basename(f, '.gltf'));
for (const n of ['sword_1handed', 'sword_2handed', 'axe_1handed', 'axe_2handed', 'staff', 'dagger', 'shield_round']) {
  const f = find(`KayKit-Character-Pack-Adventures-1.0/**/Assets/gltf/${n}.gltf`)[0];
  if (f) await piece(f, 'w_' + n);
}
console.log('done');
