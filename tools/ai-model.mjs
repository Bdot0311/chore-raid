// Installs an AI-made model (Meshy, Tripo, Rodin...) as a creature's body.
//   node tools/ai-model.mjs <file.glb> <creature id> [turn degrees]
// Creature ids: king lich warlord colossus kraken dragon devil troll
//               sock grease dust slug pillow crumb rat
// Shrinks textures to 1024px WebP and tidies the file so it loads fast on a
// phone, writes public/models/ai/<id>.glb and lists it in manifest.json.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, textureCompress, weld } from '@gltf-transform/functions';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const [src, id, turn] = process.argv.slice(2);
const IDS = ['king', 'lich', 'warlord', 'colossus', 'kraken', 'dragon', 'devil', 'troll', 'sock', 'grease', 'dust', 'slug', 'pillow', 'crumb', 'rat'];
if (!src || !IDS.includes(id)) {
  console.error(`usage: node tools/ai-model.mjs <file.glb> <${IDS.join('|')}> [turn degrees]`);
  process.exit(1);
}

const OUT = new URL('../public/models/ai/', import.meta.url).pathname;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
await doc.transform(
  weld(),
  dedup(),
  resample(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }),
);
const out = `${OUT}${id}.glb`;
await io.write(out, doc);

const manifestPath = `${OUT}manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest[id] = { turn: Number(turn ?? 0) };
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const kb = (f) => Math.round(statSync(f).size / 1024);
console.log(`${id}: ${kb(src)} KB -> ${kb(out)} KB, animations: ${doc.getRoot().listAnimations().map((a) => a.getName()).join(', ') || 'none'}`);
