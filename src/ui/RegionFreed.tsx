import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { speech } from '../audio/speech';
import { region } from '../game/campaign';
import { freedLines } from '../game/narration';
import { freedMode } from '../game/reclaim';
import type { Profile, RegionId } from '../game/types';
import { btn } from './ui';

interface Props {
  regionId: RegionId;
  profile: Profile;
  onDone: () => void;
}

/** The story beat after a region's boss falls, and the ending after the Mess King. */
export function RegionFreed({ regionId, profile, onDone }: Props) {
  const r = region(regionId);
  const hero = profile.heroName || 'Hero';
  const [now] = useState(Date.now);
  const { mode, remaining } = freedMode(regionId, profile, now);
  const ending = mode === 'ending';
  const throneNext = mode === 'throne-first' || mode === 'throne-again';

  const { title, text, spoken } = freedLines(r.name, mode, remaining, hero);

  useEffect(() => {
    speech.interrupt(spoken);
  }, [spoken]);

  return (
    <div className="relative h-full overflow-hidden bg-black">
      <motion.img
        src={ending ? '/art/story-2.webp' : throneNext ? '/art/arena-throne.webp' : r.arena}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        initial={{ scale: 1.15, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ scale: { duration: 8 }, opacity: { duration: 1 } }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/30" />
      <div className="safe-pad relative mx-auto flex h-full max-w-md flex-col justify-end gap-5 pb-4">
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
          <p className="font-display text-lg tracking-[0.3em] text-gold">{ending ? 'THE END · FOR NOW' : 'REGION FREED'}</p>
          {ending && <p className="text-xs font-bold uppercase tracking-widest text-white/60">Reign {profile.kingDefeats} toppled</p>}
          <h1 className="font-display text-5xl leading-tight text-white drop-shadow-lg">{title}</h1>
          <p className="mt-3 font-display text-2xl leading-snug text-white/90">{text}</p>
        </motion.div>
        <button className={btn.gold} onClick={onDone}>
          BACK TO THE MAP
        </button>
      </div>
    </div>
  );
}
