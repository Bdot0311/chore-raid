import type { BossDef } from './types';

export const BUILT_IN_BOSSES: BossDef[] = [
  {
    id: 'laundry',
    kind: 'laundry',
    name: 'The Laundry Lich',
    chore: 'Fold the laundry',
    unit: 'item',
    unitPlural: 'items',
    countPrompt: 'Count the pile. Every sock counts.',
    hue: 265,
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'dishes',
    kind: 'dishes',
    name: 'The Sink Warlord',
    chore: 'Wash the dishes',
    unit: 'dish',
    unitPlural: 'dishes',
    countPrompt: 'Count the dishes. Forks count. Lids count.',
    hue: 190,
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'clutter',
    kind: 'clutter',
    name: 'The Clutter Colossus',
    chore: 'Put the clutter away',
    unit: 'thing',
    unitPlural: 'things',
    countPrompt: 'Count everything that is not where it lives.',
    hue: 25,
    createdAt: 0,
    builtIn: true,
  },
];

export function unitWord(boss: BossDef, n: number): string {
  return n === 1 ? boss.unit : boss.unitPlural;
}
