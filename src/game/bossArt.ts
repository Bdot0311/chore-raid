import { portraitKey } from '../world/cast';
import type { BossDef } from './types';

/** The boss's portrait in menus: a render of its 3D model (tools/portraits.cjs). */
export function bossSpriteUrl(boss: BossDef): string {
  return `/art/portraits/${portraitKey(boss)}.webp`;
}

/** Painted treasure chest for the loot reveal. */
export const CHEST_ART: string | undefined = '/art/chest.webp';
