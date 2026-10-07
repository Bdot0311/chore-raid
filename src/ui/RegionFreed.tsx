import { motion } from 'motion/react';
import { useEffect } from 'react';
import { speech } from '../audio/speech';
import { region, throneUnlocked } from '../game/campaign';
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
  const ending = regionId === 'throne';
  const throneNext = !ending && throneUnlocked(profile.regionsCleared);
  const remaining = 3 - profile.regionsCleared.filter((id) => id !== 'throne').length;

  const title = ending ? 'The home is yours' : `${r.name} is free`;
  const text = ending
    ? `The Mess King packed one small bag and left. He will be back; he always is. But tonight, ${hero}, every room is yours. Well played.`
    : throneNext
      ? `All three lairs are free. The Mess King has run out of places to hide. The throne room is open, ${hero}.`
      : `One less lair for the Mess King. ${remaining} to go, ${hero}. He is pretending not to notice.`;

  useEffect(() => {
    speech.interrupt(`${title}. ${text}`);
  }, [title, text]);

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
