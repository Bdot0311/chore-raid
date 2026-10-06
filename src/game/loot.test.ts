import { describe, expect, it } from 'vitest';
import { RARITIES, allTrophies, rollLoot, rollRarity } from './loot';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

describe('loot', () => {
  it('more Loot Stars means rarer drops on average', () => {
    const avg = (stars: number) => {
      const rand = seeded(42);
      let sum = 0;
      for (let i = 0; i < 4000; i++) sum += RARITIES.indexOf(rollRarity(stars, rand));
      return sum / 4000;
    };
    for (let s = 1; s <= 5; s++) expect(avg(s)).toBeGreaterThan(avg(s - 1));
  });

  it('clamps out-of-range stars', () => {
    expect(RARITIES).toContain(rollRarity(-3));
    expect(RARITIES).toContain(rollRarity(99));
  });

  it('every boss kind has a trophy for every rarity', () => {
    const t = allTrophies();
    for (const kind of ['laundry', 'dishes', 'clutter', 'custom'])
      for (const rarity of RARITIES) expect(t.some((x) => x.kind === kind && x.rarity === rarity)).toBe(true);
    const item = rollLoot('dishes', 3, 'raid', 'loot', 0, seeded(1));
    expect(t.some((x) => x.name === item.name && x.rarity === item.rarity)).toBe(true);
  });
});
