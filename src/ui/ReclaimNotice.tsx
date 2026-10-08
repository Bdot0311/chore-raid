import { motion } from 'motion/react';
import { bossSpriteUrl } from '../game/bossArt';
import { enemy, region } from '../game/campaign';
import { backIn, creepingInto } from '../game/narration';
import { kingReturned, reclaimTargets, reign } from '../game/reclaim';
import type { Profile, RegionId } from '../game/types';

/** What to fight next, if anything: the King's return, a retaken lair, or mess creeping back. */
function reclaimNews(profile: Profile, now: number): { id: RegionId; headline: string; text: string; urgent: boolean } | undefined {
  const targets = reclaimTargets(profile, now);
  if (kingReturned(profile, now)) {
    return {
      id: 'throne',
      headline: `The Mess King returns · Reign ${reign(profile)}`,
      text: `${targets.filter((t) => t.state === 'retaken').length} lairs have fallen. Free some back, or go straight for the throne.`,
      urgent: true,
    };
  }
  const first = targets[0];
  if (!first) return undefined;
  const retaken = first.state === 'retaken';
  return {
    id: first.id,
    headline: retaken ? 'Lair retaken!' : 'Mess creeping back',
    text: retaken ? backIn(first.id) : creepingInto(first.id),
    urgent: retaken,
  };
}

/** The card on the home screens that says which lair needs you. */
export function ReclaimNotice({ profile, now, onGo }: { profile: Profile; now: number; onGo: (id: RegionId) => void }) {
  const news = reclaimNews(profile, now);
  if (!news) return null;
  const r = region(news.id);
  const foe = enemy(news.id === 'throne' ? r.bossId : r.minionId);
  return (
    <motion.button
      className={`flex w-full items-center gap-3 rounded-3xl p-3 text-left shadow-xl ring-2 ${
        news.urgent ? 'bg-gradient-to-r from-[#7f1d1d]/95 to-dungeon-900/95 ring-[#f87171]' : 'bg-black/70 ring-white/15'
      }`}
      onClick={() => onGo(news.id)}
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      whileTap={{ scale: 0.98 }}
    >
      <div
        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl"
        style={{ background: `radial-gradient(circle at 50% 40%, hsl(${r.hue} 60% 35%), hsl(${r.hue} 50% 10%))` }}
      >
        <img src={bossSpriteUrl(foe)} alt="" className="absolute inset-0 h-full w-full scale-125 object-contain object-top" draggable={false} />
      </div>
      <span className="min-w-0 flex-1">
        <span className={`block text-xs font-bold uppercase tracking-widest ${news.urgent ? 'text-[#fca5a5]' : 'text-ash'}`}>{news.headline}</span>
        <span className="block font-display text-lg leading-tight text-white">{news.text}</span>
      </span>
      <span className="font-display text-2xl text-white/70">›</span>
    </motion.button>
  );
}
