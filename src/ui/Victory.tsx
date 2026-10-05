import { motion } from 'motion/react';
import { unitWord } from '../game/bosses';
import type { BossDef, Raid } from '../game/types';

interface Props {
  boss: BossDef;
  raid: Raid;
  onDone: () => void;
}

export function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

export function Victory({ boss, raid, onDone }: Props) {
  const stats: [string, string][] = [
    [unitWord(boss, raid.maxHp), String(raid.maxHp)],
    ['Time', formatDuration((raid.endedAt ?? Date.now()) - raid.startedAt)],
    ['Best combo', `×${raid.bestCombo}`],
    ['Score', String(raid.score)],
  ];

  return (
    <div className="safe-pad mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-8 text-center">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
      >
        <p className="text-xs uppercase tracking-widest text-ash">Victory</p>
        <h1 className="mt-4 font-display text-xl leading-relaxed" style={{ color: `hsl(${boss.hue} 80% 70%)` }}>
          {boss.name} is defeated.
        </h1>
        <p className="mt-3 text-ash">It took the chore with it.</p>
      </motion.div>

      <dl className="grid w-full grid-cols-2 gap-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-dungeon-900 p-4 ring-1 ring-dungeon-700">
            <dt className="text-xs uppercase tracking-widest text-ash">{label}</dt>
            <dd className="mt-2 font-display text-xl tabular-nums text-gold">{value}</dd>
          </div>
        ))}
      </dl>

      <button
        className="w-full rounded-2xl bg-ember py-5 font-display text-sm text-dungeon-950 active:brightness-90"
        onClick={onDone}
      >
        Back to the dungeon
      </button>
    </div>
  );
}
