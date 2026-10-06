import { motion } from 'motion/react';
import { bossSpriteUrl } from '../game/bossArt';
import { unitWord } from '../game/bosses';
import type { BossDef, Profile, Raid } from '../game/types';

interface Props {
  bosses: BossDef[];
  profile: Profile;
  activeRaid?: Raid;
  onPick: (boss: BossDef) => void;
  onResume: (raid: Raid) => void;
  onAbandon: (raid: Raid) => void;
  onTrophies: () => void;
  onSummon: () => void;
}

function Portrait({ boss }: { boss: BossDef }) {
  const url = bossSpriteUrl(boss);
  return (
    <div
      className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/15"
      style={{ background: `radial-gradient(circle at 50% 35%, hsl(${boss.hue} 60% 40%), hsl(${boss.hue} 50% 12%))` }}
    >
      {url ? (
        <img src={url} alt="" className="absolute inset-0 h-full w-full scale-125 object-contain object-top" draggable={false} />
      ) : (
        <span className="absolute inset-0 grid place-items-center font-display text-3xl text-white/80">{boss.name.replace(/^The /, '')[0]}</span>
      )}
    </div>
  );
}

export function Hub({ bosses, profile, activeRaid, onPick, onResume, onAbandon, onTrophies, onSummon }: Props) {
  const activeBoss = activeRaid && bosses.find((b) => b.id === activeRaid.bossId);

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_50%_0%,#2c2752,var(--color-dungeon-950)_60%)]">
      <div className="safe-pad mx-auto flex min-h-full max-w-md flex-col gap-5">
        <header className="pt-4 text-center">
          <motion.h1
            className="font-display text-5xl leading-none text-bone drop-shadow-[0_4px_0_#0d0b1a]"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          >
            CHORE <span className="text-ember">RAID</span>
          </motion.h1>
          <p className="mt-2 text-sm font-semibold text-ash">Your home is a dungeon. Every mess is a boss.</p>
        </header>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-black/30 p-4 text-center ring-1 ring-white/10">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ash">Items conquered</p>
            <p className="mt-1 font-display text-4xl tabular-nums text-gold">{profile.totalItems.toLocaleString()}</p>
          </div>
          <button className="rounded-3xl bg-black/30 p-4 text-center ring-1 ring-white/10 active:scale-[0.98]" onClick={onTrophies}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-ash">Bosses slain</p>
            <p className="mt-1 font-display text-4xl tabular-nums text-bone">{profile.raidsWon}</p>
            <p className="text-xs font-semibold text-gold">Trophy room →</p>
          </button>
        </section>

        {activeRaid && activeBoss && (
          <motion.section
            className="rounded-3xl bg-gradient-to-b from-ember/25 to-dungeon-800 p-4 ring-2 ring-ember/70"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <div className="flex items-center gap-3">
              <Portrait boss={activeBoss} />
              <div className="min-w-0 text-left">
                <p className="font-display text-lg text-ember">Raid in progress</p>
                <p className="text-sm text-bone">
                  {activeBoss.name} has {activeRaid.hp} {unitWord(activeBoss, activeRaid.hp)} left of {activeRaid.maxHp}.
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-3">
              <button
                className="flex-1 rounded-2xl bg-gradient-to-b from-[#ff8a5c] to-ember py-3 font-display text-lg text-dungeon-950 shadow-[0_4px_0_#a8391a] active:translate-y-1 active:shadow-none"
                onClick={() => onResume(activeRaid)}
              >
                RESUME
              </button>
              <button
                className="rounded-2xl bg-dungeon-700 px-4 py-3 text-sm font-semibold text-ash active:bg-dungeon-600"
                onClick={() => {
                  if (confirm(`Abandon the raid on ${activeBoss.name}?`)) onAbandon(activeRaid);
                }}
              >
                Abandon
              </button>
            </div>
          </motion.section>
        )}

        <section className="flex flex-col gap-3 pb-2">
          <p className="text-xs font-bold uppercase tracking-widest text-ash">Choose your boss</p>
          {bosses.map((boss, i) => (
            <motion.button
              key={boss.id}
              className="group flex items-center gap-4 rounded-3xl bg-gradient-to-r from-dungeon-800 to-dungeon-900 p-3 pr-4 text-left ring-1 ring-white/10 transition active:scale-[0.98]"
              style={{ boxShadow: `inset 3px 0 0 hsl(${boss.hue} 80% 60%)` }}
              onClick={() => onPick(boss)}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.05 * i }}
            >
              <Portrait boss={boss} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-xl leading-tight">{boss.name}</span>
                <span className="block text-sm text-ash">{boss.chore}</span>
              </span>
              <span className="font-display text-2xl text-ash/60 group-active:text-bone">›</span>
            </motion.button>
          ))}
          <button
            className="rounded-3xl border-2 border-dashed border-white/15 p-4 font-display text-lg text-ash transition active:scale-[0.98] active:border-white/30"
            onClick={onSummon}
          >
            + Summon a boss
          </button>
        </section>
      </div>
    </div>
  );
}
