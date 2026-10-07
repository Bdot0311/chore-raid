import { motion } from 'motion/react';
import { useContext, useEffect, useRef } from 'react';
import { region } from '../game/campaign';
import type { RegionId } from '../game/types';
import { Town } from '../world/Town';
import { HeroContext } from './RaidStage';

interface Props {
  regionId: RegionId;
  onDone: () => void;
}

/** The hero runs through the village to the lair gate. Tap anywhere to skip. */
export function TownWalk({ regionId, onDone }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const heroId = useContext(HeroContext);
  const done = useRef(onDone);
  done.current = onDone;
  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    done.current();
  };

  useEffect(() => {
    const town = new Town();
    town
      .play(host.current!, { hero: heroId, region: regionId })
      .then(finish)
      .catch((err) => {
        console.error('Town failed to load', err);
        finish();
      });
    return () => town.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = region(regionId);
  return (
    <div className="relative h-full overflow-hidden bg-sky-300" onClick={finish}>
      <div ref={host} className="absolute inset-0" aria-hidden />
      <div className="safe-pad pointer-events-none relative flex h-full flex-col justify-between">
        <motion.div className="text-center" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
          <p className="font-display text-lg tracking-[0.3em] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">TO</p>
          <h1 className="font-display text-4xl text-white drop-shadow-[0_3px_0_#0d0b1a]">{r.name}</h1>
        </motion.div>
        <p className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-white/80 drop-shadow">Tap to skip</p>
      </div>
    </div>
  );
}
