import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { speech } from '../audio/speech';
import { bossSpriteUrl } from '../game/bossArt';
import { enemy, LAIR_IDS, levelName, region, REGIONS, stepsFor, type RegionDef } from '../game/campaign';
import { say } from '../game/narration';
import { dailyBounty } from '../game/progression';
import { KING_RETURNS_AT, kingReturned, lairState, messLevel, reign, retakenLairs, throneOpen, type RegionState } from '../game/reclaim';
import type { Profile, Quest, RegionId } from '../game/types';
import { ReclaimNotice } from './ReclaimNotice';
import { btn } from './ui';
import { XpBar } from './XpBar';

interface Props {
  profile: Profile;
  activeQuest?: Quest;
  onRegion: (id: RegionId) => void;
  onContinue: (quest: Quest) => void;
  onQuickRaid: () => void;
  onTrophies: () => void;
  onArmory: () => void;
  onStory: () => void;
}

/**
 * Where each lair sits on the map, in percent of the map's size: a winding
 * road from the Laundry Lair at the bottom, two lairs a row, up to the throne.
 * Sized for a portrait phone; the columns leave room for the longest names.
 */
const NODE_POS: Record<RegionId, { x: number; y: number }> = {
  laundry: { x: 50, y: 91 },
  dishes: { x: 25, y: 70 },
  trash: { x: 75, y: 72 },
  clutter: { x: 26, y: 50 },
  floors: { x: 74, y: 52 },
  bathroom: { x: 25, y: 29 },
  bedroom: { x: 75, y: 31 },
  throne: { x: 50, y: 10 },
};

const RETAKEN_RED = '#f87171';

function Node({ r, state, mess, locked, lockedLabel, retakenLabel, bounty, active, onClick, delay }: {
  r: RegionDef;
  state: RegionState;
  mess: number;
  locked: boolean;
  lockedLabel: string;
  retakenLabel: string;
  bounty: boolean;
  active: boolean;
  onClick: () => void;
  delay: number;
}) {
  const pos = NODE_POS[r.id];
  const boss = enemy(r.bossId);
  const cleared = state === 'free' || state === 'creeping';
  const retaken = state === 'retaken';
  const status = locked
    ? lockedLabel
    : active
      ? 'Quest in progress'
      : retaken
        ? retakenLabel
        : state === 'creeping'
          ? 'Mess creeping back'
          : cleared
            ? 'Freed · play again'
            : r.chore;
  return (
    <motion.button
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      onClick={onClick}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 15 }}
      whileTap={{ scale: 0.92 }}
    >
      <motion.div
        className="relative h-14 w-14 overflow-hidden rounded-full ring-4 [@media(max-height:700px)]:h-11 [@media(max-height:700px)]:w-11"
        style={{
          background: `radial-gradient(circle at 50% 40%, hsl(${r.hue} 60% 35%), hsl(${r.hue} 50% 10%))`,
          ['--tw-ring-color' as string]: retaken ? RETAKEN_RED : cleared ? '#ffc94d' : locked ? '#3d3670' : `hsl(${r.hue} 85% 60%)`,
          boxShadow: locked ? 'none' : `0 0 ${active ? 40 : 24}px hsl(${r.hue} 90% 55% / 0.7)`,
          filter: locked ? 'grayscale(1) brightness(0.5)' : undefined,
        }}
        animate={active || retaken ? { scale: [1, 1.08, 1] } : undefined}
        transition={{ duration: 1.6, repeat: Infinity }}
      >
        <img src={bossSpriteUrl(boss)} alt="" className="absolute inset-0 h-full w-full scale-125 object-contain object-top" draggable={false} />
        {state === 'free' && !locked && (
          <div className="absolute inset-0 grid place-items-center bg-black/40 font-display text-3xl text-gold">✓</div>
        )}
        {locked && <div className="absolute inset-0 grid place-items-center text-3xl">🔒</div>}
      </motion.div>
      <div className="mt-1 rounded-full bg-black/70 px-3 py-0.5 text-center backdrop-blur">
        <p className="whitespace-nowrap font-display text-sm leading-tight text-white">{r.name}</p>
        <p
          className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider"
          style={{ color: retaken ? RETAKEN_RED : cleared ? '#ffc94d' : `hsl(${r.hue} 85% 72%)` }}
        >
          {status}
        </p>
        {/* The mess meter: how far the minions have crept back since it was freed. */}
        {cleared && r.id !== 'throne' && (
          <div className="mx-auto mb-0.5 mt-0.5 h-1 w-16 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.round(mess * 100)}%`, background: state === 'creeping' ? '#ff8a5c' : '#ffc94d' }}
            />
          </div>
        )}
      </div>
      {retaken && !active && (
        <motion.span
          className="absolute -left-4 -top-2 rounded-full px-2 py-0.5 font-display text-xs text-white shadow-lg"
          style={{ background: RETAKEN_RED }}
          animate={{ rotate: [-6, 6, -6] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          Retaken!
        </motion.span>
      )}
      {bounty && !locked && (
        <span className="absolute -right-3 -top-2 rounded-full bg-gold px-2 py-0.5 font-display text-xs text-dungeon-950 shadow-lg">2× XP</span>
      )}
    </motion.button>
  );
}

export function WorldMap({ profile, activeQuest, onRegion, onContinue, onQuickRaid, onTrophies, onArmory, onStory }: Props) {
  // One clock per visit, so the map does not shift under the player's thumb.
  const [now] = useState(Date.now);
  const bounty = dailyBounty(now, profile.regionFreedAt);
  const throne = throneOpen(profile, now);
  const kingBack = kingReturned(profile, now);
  const active = activeQuest && region(activeQuest.region);
  const cleared = LAIR_IDS.filter((id) => profile.regionsCleared.includes(id)).length;
  const retaken = retakenLairs(profile, now);
  const throneLocked =
    profile.kingDefeats === 0
      ? `Defeat all ${LAIR_IDS.length} bosses`
      : `Toppled ×${profile.kingDefeats} · back at ${KING_RETURNS_AT} lost lairs`;

  // The narrator greets each return to the map (queued, so a welcome line finishes first).
  const line = say.map({ cleared, throneOpen: throne && profile.kingDefeats === 0, kingBack, retaken });
  useEffect(() => {
    speech.say(line);
  }, [line]);

  return (
    <div className="relative h-full overflow-hidden bg-dungeon-950">
      <img src="/art/world-map.webp" alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80" />

      <div className="absolute inset-x-0 top-[15%] bottom-[23%]">
        {REGIONS.map((r, i) => {
          const isActive = activeQuest?.region === r.id;
          const locked = r.id === 'throne' && !throne && !isActive;
          // The throne's state is the King's: retaken when he is back on it.
          const state: RegionState =
            r.id !== 'throne' ? lairState(profile, r.id, now) : kingBack ? 'retaken' : profile.kingDefeats > 0 ? 'free' : 'never';
          return (
            <Node
              key={r.id}
              r={r}
              state={state}
              mess={messLevel(r.id, profile.regionFreedAt[r.id], now)}
              locked={locked}
              lockedLabel={throneLocked}
              retakenLabel={r.id === 'throne' ? `The King returns · Reign ${reign(profile)}` : 'Retaken! Win it back'}
              bounty={r.id === bounty}
              active={isActive}
              onClick={() => (isActive ? onContinue(activeQuest!) : !locked && onRegion(r.id))}
              delay={0.1 + i * 0.08}
            />
          );
        })}
      </div>

      <div className="safe-pad pointer-events-none relative flex h-full flex-col">
        <header className="pointer-events-auto rounded-3xl bg-black/55 p-3 ring-1 ring-white/10 backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between">
            <button className="text-left" onClick={onStory}>
              <p className="font-display text-xl leading-none text-white">{profile.heroName || 'Hero'}</p>
              <p className="text-[11px] font-semibold text-ash">{profile.totalItems.toLocaleString()} items conquered</p>
            </button>
            {profile.streak.days > 0 && (
              <div className="rounded-full bg-ember/20 px-3 py-1 font-display text-ember ring-1 ring-ember/40">🔥 {profile.streak.days}-day streak</div>
            )}
          </div>
          <XpBar xp={profile.xp} />
        </header>

        <div className="flex-1" />

        <div className="pointer-events-auto space-y-3">
          {/* Nothing in progress? Then the most urgent lair to win back. */}
          {!activeQuest && <ReclaimNotice profile={profile} now={now} onGo={onRegion} />}
          {activeQuest && active && (
            <motion.button
              className="w-full rounded-3xl bg-gradient-to-r from-ember/90 to-[#c2410c]/90 p-4 text-left shadow-xl ring-2 ring-[#ffb38f]"
              onClick={() => onContinue(activeQuest)}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              whileTap={{ scale: 0.98 }}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-white/80">Continue quest · {active.name}</p>
              <p className="font-display text-xl text-white">
                {levelName(activeQuest, activeQuest.level)} · Step {activeQuest.step + 1}/{stepsFor(activeQuest).length}
              </p>
            </motion.button>
          )}
          <div className="grid grid-cols-3 gap-2">
            {[
              ['⚔️', 'Quick raid', onQuickRaid],
              ['🏆', 'Trophies', onTrophies],
              ['🗡️', 'Armory', onArmory],
            ].map(([icon, label, fn]) => (
              <button key={label as string} className={`${btn.secondary} !py-3 !text-base`} onClick={fn as () => void}>
                <span className="block text-xl leading-none">{icon as string}</span>
                {label as string}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
