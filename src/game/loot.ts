import type { BossKind, LootItem, Rarity } from './types';

export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#c9c3e6',
  rare: '#4fb3ff',
  epic: '#b46bff',
  legendary: '#ffc94d',
};

/**
 * Loot Stars (0–5) shift the odds: more stars, rarer drops. Weights per rarity,
 * common → legendary. Even 0 stars can roll rare; 5 stars can still roll common.
 */
const WEIGHTS: number[][] = [
  [80, 18, 2, 0],
  [65, 28, 6, 1],
  [45, 38, 14, 3],
  [25, 40, 27, 8],
  [12, 33, 38, 17],
  [5, 22, 43, 30],
];

export function rollRarity(stars: number, rand: () => number = Math.random): Rarity {
  const w = WEIGHTS[Math.max(0, Math.min(5, stars))];
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r < 0) return RARITIES[i];
  }
  return 'common';
}

const TROPHIES: Record<BossKind, Record<Rarity, string[]>> = {
  laundry: {
    common: ['Lint Ball', 'Orphaned Sock', 'Crumpled Receipt'],
    rare: ["Lich's Lost Sock", 'Static-Charged Sweater'],
    epic: ['Hoodie of Mild Contempt', 'Fitted Sheet, Defeated'],
    legendary: ['The Matching Pair'],
  },
  dishes: {
    common: ['Soggy Sponge', 'Bent Fork', 'Lonely Lid'],
    rare: ['Warlord Tooth (Fork)', 'Gleaming Ladle'],
    epic: ['Shield of the Sink', 'Grease-Proof Gauntlet'],
    legendary: ['The Empty Sink'],
  },
  clutter: {
    common: ['Mystery Cable', 'Single Battery', 'Pen (Dead)'],
    rare: ['Colossus Shoe', 'Box of Old Chargers'],
    epic: ['Lamp of Reclamation', 'Mug of Many Coffees'],
    legendary: ['The Visible Floor'],
  },
  bathroom: {
    common: ['Hair Clump (Retired)', 'Empty Shampoo Bottle', 'Soap Sliver'],
    rare: ['Kraken Tentacle (Rinsed)', 'Gleaming Tap'],
    epic: ['Grout of the Ancients', 'Squeegee of Clarity'],
    legendary: ['The Unfogged Mirror'],
  },
  bedroom: {
    common: ['Stray Hair Tie', 'Lone Pillowcase', 'Phone Charger (Short)'],
    rare: ["Dragon's Lost Slipper", 'Freshly Plumped Pillow'],
    epic: ['Duvet of Fierce Comfort', 'Hospital Corner'],
    legendary: ['The Made Bed'],
  },
  floors: {
    common: ['Single Raisin', 'Mystery Crumb', 'Lego Brick (Stepped On)'],
    rare: ['Devil Dust Pouch', 'Coin From Under the Sofa'],
    epic: ['Hoover of Holding', 'Bristle of the Broom Lord'],
    legendary: ['The Barefoot Floor'],
  },
  trash: {
    common: ['Bottle Top', 'Flattened Box', 'Twist Tie'],
    rare: ["Troll's Bin Lid", 'Perfectly Rinsed Tin'],
    epic: ['Bag That Did Not Split', 'Gauntlet of Recycling'],
    legendary: ['The Empty Bin'],
  },
  king: {
    common: ['Bottle Cap Jewel'],
    rare: ['Royal Plunger'],
    epic: ['Stained Bedsheet Cape'],
    legendary: ['The Laundry Basket Crown'],
  },
  custom: {
    common: ['Dust Mote', 'Small Victory'],
    rare: ['Essence of Tidiness'],
    epic: ['Elemental Core'],
    legendary: ['Order Itself'],
  },
};

export function rollLoot(
  bossKind: BossKind,
  stars: number,
  raidId: string,
  id: string,
  now: number,
  rand: () => number = Math.random,
): LootItem {
  const rarity = rollRarity(stars, rand);
  const names = TROPHIES[bossKind][rarity];
  return {
    id,
    type: 'trophy',
    name: names[Math.floor(rand() * names.length)],
    rarity,
    bossKind,
    earnedAt: now,
    raidId,
  };
}

/** Every trophy that exists, for the trophy room's silhouettes. */
export function allTrophies() {
  return (Object.keys(TROPHIES) as BossKind[]).flatMap((kind) =>
    RARITIES.flatMap((rarity) => TROPHIES[kind][rarity].map((name) => ({ kind, rarity, name }))),
  );
}
