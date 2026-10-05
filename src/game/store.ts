import * as db from '../lib/db';
import { newId } from '../lib/id';
import { BUILT_IN_BOSSES } from './bosses';
import { createRaid } from './raidReducer';
import type { BossDef, Profile, Raid } from './types';

const PROFILE_KEY = 'me';

export const DEFAULT_PROFILE: Profile = {
  totalItems: 0,
  raidsWon: 0,
  equippedSkin: 'default',
  settings: { muted: false, voiceHits: false, speech: true, volume: 0.8 },
};

export async function loadProfile(): Promise<Profile> {
  const saved = await db.get('profile', PROFILE_KEY);
  return { ...DEFAULT_PROFILE, ...saved, settings: { ...DEFAULT_PROFILE.settings, ...saved?.settings } };
}

export function saveProfile(profile: Profile) {
  return db.put('profile', profile, PROFILE_KEY);
}

export async function loadBosses(): Promise<BossDef[]> {
  const custom = await db.getAll('bosses');
  return [...BUILT_IN_BOSSES, ...custom.sort((a, b) => a.createdAt - b.createdAt)];
}

export async function findActiveRaid(): Promise<Raid | undefined> {
  const active = await db.getAllByIndex('raids', 'status', 'active');
  return active.sort((a, b) => b.startedAt - a.startedAt)[0];
}

export function getRaid(id: string) {
  return db.get('raids', id);
}

export function saveRaid(raid: Raid) {
  return db.put('raids', raid);
}

/** Only one raid runs at a time: any raid left active is abandoned. */
export async function startRaid(bossId: string, maxHp: number): Promise<Raid> {
  const now = Date.now();
  for (const old of await db.getAllByIndex('raids', 'status', 'active')) {
    await db.put('raids', { ...old, status: 'abandoned', endedAt: now });
  }
  const raid = createRaid(newId(), bossId, maxHp, now);
  await db.put('raids', raid);
  return raid;
}

export async function abandonRaid(raid: Raid) {
  await db.put('raids', { ...raid, status: 'abandoned', endedAt: Date.now() });
}

/** Called once when a raid is won: credits the lifetime totals. */
export async function recordWin(raid: Raid): Promise<Profile> {
  const profile = await loadProfile();
  const next: Profile = {
    ...profile,
    totalItems: profile.totalItems + raid.maxHp,
    raidsWon: profile.raidsWon + 1,
  };
  await saveProfile(next);
  return next;
}
