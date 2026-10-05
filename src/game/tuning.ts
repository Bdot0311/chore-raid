/** Stops a wet palm from registering a double hit. Nobody folds a shirt in 0.7 s. */
export const HIT_COOLDOWN_MS = 700;

/** Each hit refills the combo meter; it drains to zero over this window. */
export const COMBO_WINDOW_MS = 20_000;

/** Streak length → multiplier, highest tier first. */
export const COMBO_TIERS: { streak: number; multiplier: number }[] = [
  { streak: 10, multiplier: 4 },
  { streak: 6, multiplier: 3 },
  { streak: 3, multiplier: 2 },
  { streak: 0, multiplier: 1 },
];

export const SCORE_PER_HIT = 10;

export const STARTING_LOOT_STARS = 2;
export const MAX_LOOT_STARS = 5;

export const MAX_HP = 999;

export function multiplierFor(streak: number): number {
  return COMBO_TIERS.find((t) => streak >= t.streak)!.multiplier;
}
