import { AnimatePresence, motion } from 'motion/react';
import { useContext, useEffect, useState } from 'react';
import { chargeLeft, isCharging, type Duel } from '../game/duel';
import { HeroContext } from './RaidStage';

/** The hero's health: a portrait and a bar that shakes when a blow lands. */
export function HeroHealth({ duel }: { duel: Duel }) {
  const heroId = useContext(HeroContext) ?? 'Knight';
  const pct = duel.heroHp / duel.heroMax;
  const color = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#facc15' : '#ef4444';
  return (
    <motion.div
      key={duel.hitsTaken}
      className="flex items-center gap-2"
      animate={duel.hitsTaken ? { x: [0, -8, 7, -5, 3, 0] } : undefined}
      transition={{ duration: 0.45 }}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-black/50 ring-2 ring-white/15">
        <img src={`/art/portraits/${heroId}.webp`} alt="" className="absolute inset-0 h-full w-full scale-[1.6] object-cover object-top" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between text-[11px] font-bold uppercase tracking-widest">
          <span className="text-white/80">Your health</span>
          <span className="tabular-nums" style={{ color }}>
            {duel.heroHp}/{duel.heroMax}
          </span>
        </div>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
          <motion.div className="h-full rounded-full" style={{ background: color }} animate={{ width: `${pct * 100}%` }} transition={{ type: 'spring', stiffness: 160, damping: 20 }} />
        </div>
      </div>
    </motion.div>
  );
}

/** While the enemy charges: what is coming and how to stop it, with a draining bar. */
export function ChargeWarning({ duel, task }: { duel: Duel | undefined; task?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const on = !!duel && isCharging(duel, now);
  const left = duel ? chargeLeft(duel, now) : 0;
  const secs = duel ? Math.ceil((duel.nextAttackAt - now) / 1000) : 0;
  return (
    <AnimatePresence>
      {on && (
        <motion.div
          className="rounded-2xl bg-gradient-to-b from-red-600/95 to-red-800/95 p-3 text-white shadow-[0_0_30px_rgba(239,68,68,0.6)] ring-2 ring-red-300/70"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [1, 1.03, 1], opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ scale: { repeat: Infinity, duration: 0.6 } }}
        >
          <div className="flex items-baseline justify-between">
            <p className="font-display text-xl tracking-wider">⚠ INCOMING BLOW</p>
            <p className="font-display text-2xl tabular-nums">{secs}s</p>
          </div>
          <p className="text-sm font-semibold text-white/90">{task ? 'Finish this step to strike first!' : 'Finish an item to strike first!'}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
            <div className="h-full rounded-full bg-white" style={{ width: `${left * 100}%` }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
