import { motion } from 'motion/react';
import { useEffect } from 'react';
import { speech } from '../audio/speech';
import { bossSpriteUrl } from '../game/bossArt';
import { enemy, levelName, region, REGIONS, stepsFor, throneUnlocked, type RegionDef } from '../game/campaign';
import { say } from '../game/narration';
import { dailyBounty } from '../game/progression';
import type { Profile, Quest, RegionId } from '../game/types';
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

/** Where each lair sits on the painted map, in percent of the map's size. */
const NODE_POS: Record<RegionId, { x: number; y: number }> = {
  laundry: { x: 50, y: 79 },
  dishes: { x: 24, y: 45 },
  clutter: { x: 75, y: 44 },
  throne: { x: 50, y: 13 },
};

function Node({ r, cleared, locked, bounty, active, onClick, delay }: {
  r: RegionDef;
  cleared: boolean;
  locked: boolean;
  bounty: boolean;
  active: boolean;
  onClick: () => void;
  delay: number;
}) {
  const pos = NODE_POS[r.id];
  const boss = enemy(r.bossId);
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
        className="relative h-20 w-20 overflow-hidden rounded-full ring-4"
        style={{
          background: `radial-gradient(circle at 50% 40%, hsl(${r.hue} 60% 35%), hsl(${r.hue} 50% 10%))`,
          ['--tw-ring-color' as string]: cleared ? '#ffc94d' : locked ? '#3d3670' : `hsl(${r.hue} 85% 60%)`,
          boxShadow: locked ? 'none' : `0 0 ${active ? 40 : 24}px hsl(${r.hue} 90% 55% / 0.7)`,
          filter: locked ? 'grayscale(1) brightness(0.5)' : undefined,
        }}
        animate={active ? { scale: [1, 1.08, 1] } : undefined}
        transition={{ duration: 1.6, repeat: Infinity }}
      >
        <img src={bossSpriteUrl(boss)} alt="" className="absolute inset-0 h-full w-full scale-125 object-contain object-top" draggable={false} />
        {cleared && (
          <div className="absolute inset-0 grid place-items-center bg-black/40 font-display text-3xl text-gold">✓</div>
        )}
        {locked && <div className="absolute inset-0 grid place-items-center text-3xl">🔒</div>}
      </motion.div>
      <div className="mt-1.5 rounded-full bg-black/70 px-3 py-1 text-center backdrop-blur">
        <p className="whitespace-nowrap font-display text-sm leading-tight text-white">{r.name}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cleared ? '#ffc94d' : `hsl(${r.hue} 85% 72%)` }}>
          {locked ? 'Defeat all three bosses' : active ? 'Quest in progress' : cleared ? 'Freed · play again' : r.chore}
        </p>
      </div>
      {bounty && !locked && (
        <span className="absolute -right-3 -top-2 rounded-full bg-gold px-2 py-0.5 font-display text-xs text-dungeon-950 shadow-lg">2× XP</span>
      )}
    </motion.button>
  );
}

export function WorldMap({ profile, activeQuest, onRegion, onContinue, onQuickRaid, onTrophies, onArmory, onStory }: Props) {
  const bounty = dailyBounty(Date.now());
  const throneOpen = throneUnlocked(profile.regionsCleared);
  const active = activeQuest && region(activeQuest.region);
  const cleared = profile.regionsCleared.filter((id) => id !== 'throne').length;

  // The narrator greets each return to the map (queued, so a welcome line finishes first).
  const throneLeft = throneOpen && !profile.regionsCleared.includes('throne');
  useEffect(() => {
    speech.say(say.map(cleared, throneLeft));
  }, [cleared, throneLeft]);

  return (
    <div className="relative h-full overflow-hidden bg-dungeon-950">
      <img src="/art/world-map.webp" alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80" />

      <div className="absolute inset-x-0 top-[13%] bottom-[22%]">
        {REGIONS.map((r, i) => (
          <Node
            key={r.id}
            r={r}
            cleared={profile.regionsCleared.includes(r.id)}
            locked={r.id === 'throne' && !throneOpen}
            bounty={r.id === bounty}
            active={activeQuest?.region === r.id}
            onClick={() => (activeQuest?.region === r.id ? onContinue(activeQuest) : onRegion(r.id))}
            delay={0.1 + i * 0.12}
          />
        ))}
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
