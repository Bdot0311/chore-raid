import { unitWord } from '../game/bosses';
import type { BossDef, Profile, Raid } from '../game/types';

interface Props {
  bosses: BossDef[];
  profile: Profile;
  activeRaid?: Raid;
  onPick: (boss: BossDef) => void;
  onResume: (raid: Raid) => void;
  onAbandon: (raid: Raid) => void;
}

export function Hub({ bosses, profile, activeRaid, onPick, onResume, onAbandon }: Props) {
  const activeBoss = activeRaid && bosses.find((b) => b.id === activeRaid.bossId);

  return (
    <div className="safe-pad mx-auto flex min-h-full max-w-md flex-col gap-6">
      <header className="pt-4 text-center">
        <h1 className="font-display text-2xl leading-snug text-bone">Chore Raid</h1>
        <p className="mt-2 text-sm text-ash">The Dungeon. Every mess is a boss.</p>
      </header>

      <section className="rounded-2xl bg-dungeon-900 p-5 text-center ring-1 ring-dungeon-700">
        <p className="text-xs uppercase tracking-widest text-ash">Items conquered</p>
        <p className="mt-2 font-display text-4xl tabular-nums text-gold">{profile.totalItems}</p>
        <p className="mt-2 text-xs text-ash">
          {profile.raidsWon} {profile.raidsWon === 1 ? 'boss' : 'bosses'} slain
        </p>
      </section>

      {activeRaid && activeBoss && (
        <section className="rounded-2xl bg-dungeon-800 p-5 ring-2 ring-ember/70">
          <p className="text-sm font-semibold">Unfinished raid</p>
          <p className="mt-1 text-sm text-ash">
            {activeBoss.name} still has {activeRaid.hp} {unitWord(activeBoss, activeRaid.hp)} left of{' '}
            {activeRaid.maxHp}.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              className="flex-1 rounded-xl bg-ember px-4 py-3 font-semibold text-dungeon-950 active:brightness-90"
              onClick={() => onResume(activeRaid)}
            >
              Resume raid
            </button>
            <button
              className="rounded-xl bg-dungeon-700 px-4 py-3 text-sm text-ash active:bg-dungeon-600"
              onClick={() => {
                if (confirm(`Abandon the raid on ${activeBoss.name}?`)) onAbandon(activeRaid);
              }}
            >
              Abandon
            </button>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-widest text-ash">Choose your boss</p>
        {bosses.map((boss) => (
          <button
            key={boss.id}
            className="flex items-center gap-4 rounded-2xl bg-dungeon-900 p-4 text-left ring-1 ring-dungeon-700 active:bg-dungeon-800"
            onClick={() => onPick(boss)}
          >
            <span
              className="h-12 w-12 shrink-0 rounded-xl"
              style={{ background: `linear-gradient(135deg, hsl(${boss.hue} 70% 55%), hsl(${boss.hue} 60% 30%))` }}
            />
            <span>
              <span className="block font-semibold">{boss.name}</span>
              <span className="block text-sm text-ash">{boss.chore}</span>
            </span>
          </button>
        ))}
      </section>
    </div>
  );
}
