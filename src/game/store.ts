import * as db from '../lib/db';
import { newId } from '../lib/id';
import { BUILT_IN_BOSSES } from './bosses';
import { createDuel, PACE, type Duel } from './duel';
import { createRaid } from './raidReducer';
import { createQuest } from './campaign';
import { rollLoot } from './loot';
import { touchStreak } from './progression';
import { markFreed } from './reclaim';
import { MAX_LOOT_STARS } from './tuning';
import type { BossDef, LootItem, Profile, Quest, Raid, RegionId } from './types';

const PROFILE_KEY = 'me';

export const DEFAULT_PROFILE: Profile = {
  totalItems: 0,
  raidsWon: 0,
  equippedSkin: 'default',
  settings: { muted: false, voiceHits: false, speech: true, volume: 0.8 },
  heroName: '',
  heroClass: 'Knight',
  storySeen: false,
  xp: 0,
  regionsCleared: [],
  regionFreedAt: {},
  kingDefeats: 0,
  streak: { days: 0, lastDate: '' },
};

/**
 * Fills in fields older saves lack. Regions cleared before the mess could
 * come back count as freed `now`, so nobody returns to a map already retaken.
 */
export function migrateProfile(saved: Partial<Profile> | undefined, now: number): Profile {
  const p: Profile = { ...DEFAULT_PROFILE, ...saved, settings: { ...DEFAULT_PROFILE.settings, ...saved?.settings } };
  return {
    ...p,
    regionFreedAt: saved?.regionFreedAt ?? Object.fromEntries(p.regionsCleared.map((id) => [id, now])),
    kingDefeats: saved?.kingDefeats ?? (p.regionsCleared.includes('throne') ? 1 : 0),
  };
}

export async function loadProfile(): Promise<Profile> {
  const saved = await db.get('profile', PROFILE_KEY);
  const profile = migrateProfile(saved, Date.now());
  // Save the migration straight away, or "now" would move on every load.
  if (saved && (saved.regionFreedAt === undefined || saved.kingDefeats === undefined)) await saveProfile(profile);
  return profile;
}

export function saveProfile(profile: Profile) {
  return db.put('profile', profile, PROFILE_KEY);
}

export async function loadBosses(): Promise<BossDef[]> {
  const custom = await db.getAll('bosses');
  return [...BUILT_IN_BOSSES, ...custom.sort((a, b) => a.createdAt - b.createdAt)];
}

export async function findActiveRaid(): Promise<Raid | undefined> {
  // Quest fights resume through their quest, not the quick-raid screen.
  const active = (await db.getAllByIndex('raids', 'status', 'active')).filter((r) => !r.questId);
  return active.sort((a, b) => b.startedAt - a.startedAt)[0];
}

export function getRaid(id: string) {
  return db.get('raids', id);
}

export function saveRaid(raid: Raid) {
  return db.put('raids', raid);
}

/** Only one raid runs at a time: any raid left active is abandoned. */
export async function startRaid(bossId: string, maxHp: number, questId?: string, duel?: Duel): Promise<Raid> {
  const now = Date.now();
  for (const old of await db.getAllByIndex('raids', 'status', 'active')) {
    await db.put('raids', { ...old, status: 'abandoned', endedAt: now });
  }
  const raid: Raid = { ...createRaid(newId(), bossId, maxHp, now, Math.random, duel ?? createDuel(now, PACE.bossFight)), questId };
  await db.put('raids', raid);
  return raid;
}

export async function abandonRaid(raid: Raid) {
  await db.put('raids', { ...raid, status: 'abandoned', endedAt: Date.now() });
}

/**
 * Called once when a raid is won: rolls the loot from the raid's Loot Stars,
 * links it to the raid and credits the lifetime totals. Safe to call twice:
 * a raid that already has loot keeps it.
 */
export async function finishRaid(raid: Raid, boss: BossDef): Promise<{ raid: Raid; loot: LootItem; profile: Profile }> {
  const existing = raid.lootId ? await db.get('loot', raid.lootId) : undefined;
  if (existing) return { raid, loot: existing, profile: await loadProfile() };

  // FLAWLESS: not a single blow taken in the fight earns an extra Loot Star.
  const flawless = !!raid.duel && raid.duel.hitsTaken === 0;
  const stars = flawless ? Math.min(MAX_LOOT_STARS, raid.lootStars + 1) : raid.lootStars;
  const loot = rollLoot(boss.kind, stars, raid.id, newId(), Date.now());
  const done: Raid = { ...raid, lootId: loot.id };
  await db.put('loot', loot);
  await db.put('raids', done);
  const profile = await loadProfile();
  const next: Profile = {
    ...profile,
    totalItems: profile.totalItems + raid.maxHp,
    raidsWon: profile.raidsWon + 1,
  };
  await saveProfile(next);
  return { raid: done, loot, profile: next };
}

export async function attachPhoto(raidId: string, which: 'beforePhotoId' | 'afterPhotoId', photoId: string) {
  const raid = await db.get('raids', raidId);
  if (!raid) return undefined;
  const next = { ...raid, [which]: photoId };
  await db.put('raids', next);
  return next;
}

export async function loadTrophies() {
  const [loot, raids] = await Promise.all([db.getAll('loot'), db.getAllByIndex('raids', 'status', 'won')]);
  return {
    loot: loot.sort((a, b) => b.earnedAt - a.earnedAt),
    raids: raids.sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)),
  };
}

export async function saveCustomBoss(boss: BossDef) {
  await db.put('bosses', boss);
}

// ------------------------------------------------------------------ campaign

export async function findActiveQuest(): Promise<Quest | undefined> {
  const active = await db.getAllByIndex('quests', 'status', 'active');
  return active.sort((a, b) => b.startedAt - a.startedAt)[0];
}

export function saveQuest(quest: Quest) {
  return db.put('quests', quest);
}

/** Only one quest runs at a time: starting a new one abandons the old. */
export async function startQuest(region: RegionId, levels: number, levelNames: string[]): Promise<Quest> {
  const now = Date.now();
  for (const old of await db.getAllByIndex('quests', 'status', 'active')) {
    await db.put('quests', { ...old, status: 'abandoned', endedAt: now });
  }
  const quest = createQuest(newId(), region, levels, levelNames, now);
  await db.put('quests', quest);
  return quest;
}

export async function abandonQuest(quest: Quest) {
  await db.put('quests', { ...quest, status: 'abandoned', endedAt: Date.now() });
}

/**
 * Adds XP, counts today toward the streak, and marks a region freed when its
 * quest is won (which restarts its regrow timer, and topples the King).
 */
export async function awardXp(xp: number, clearedRegion?: RegionId): Promise<Profile> {
  const profile = await loadProfile();
  const now = Date.now();
  const awarded: Profile = { ...profile, xp: profile.xp + xp, streak: touchStreak(profile.streak, now) };
  const next = clearedRegion ? markFreed(awarded, clearedRegion, now) : awarded;
  await saveProfile(next);
  return next;
}

/** Items from campaign fights count toward the lifetime total too. */
export async function addItems(items: number): Promise<Profile> {
  const profile = await loadProfile();
  const next = { ...profile, totalItems: profile.totalItems + items };
  await saveProfile(next);
  return next;
}
