import { motion } from 'motion/react';
import { levelProgress } from '../game/progression';

/** Hero level badge and XP bar. */
export function XpBar({ xp, compact = false }: { xp: number; compact?: boolean }) {
  const p = levelProgress(xp);
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-[#ffe08a] to-gold font-display text-lg text-dungeon-950 shadow-[0_3px_0_#b8861c]">
        {p.level}
      </div>
      <div className="min-w-0 flex-1">
        {!compact && (
          <div className="mb-1 flex justify-between text-[11px] font-bold uppercase tracking-widest text-ash">
            <span>Hero level {p.level}</span>
            <span className="tabular-nums">
              {p.into}/{p.needed} XP
            </span>
          </div>
        )}
        <div className="h-3 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-gold to-[#fff1b8]"
            initial={false}
            animate={{ width: `${Math.max(3, p.pct * 100)}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          />
        </div>
      </div>
    </div>
  );
}
