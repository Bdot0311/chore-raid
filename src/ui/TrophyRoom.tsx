import { useEffect, useState } from 'react';
import { allTrophies, RARITY_COLOR } from '../game/loot';
import { loadTrophies } from '../game/store';
import type { BossDef, LootItem, Raid } from '../game/types';
import { formatDuration } from '../lib/format';

interface Props {
  bosses: BossDef[];
  onBack: () => void;
}

export function TrophyRoom({ bosses, onBack }: Props) {
  const [data, setData] = useState<{ loot: LootItem[]; raids: Raid[] }>();
  useEffect(() => {
    void loadTrophies().then(setData);
  }, []);

  const earned = new Map<string, number>();
  for (const l of data?.loot ?? []) earned.set(`${l.bossKind}:${l.name}`, (earned.get(`${l.bossKind}:${l.name}`) ?? 0) + 1);
  const catalog = allTrophies().filter((t) => t.kind !== 'custom' || bosses.some((b) => b.kind === 'custom'));
  const bossName = (id: string) => bosses.find((b) => b.id === id)?.name ?? 'A forgotten boss';

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_50%_0%,#3a2d12,var(--color-dungeon-950)_60%)]">
      <div className="safe-pad mx-auto flex min-h-full max-w-md flex-col gap-5">
        <button className="self-start py-2 text-sm font-semibold text-ash" onClick={onBack}>
          ← Back
        </button>
        <header className="text-center">
          <h1 className="font-display text-4xl text-gold drop-shadow-[0_3px_0_#0d0b1a]">Trophy Room</h1>
          <p className="mt-1 text-sm text-ash">
            {earned.size} of {catalog.length} trophies found
          </p>
        </header>

        <section className="grid grid-cols-3 gap-2.5">
          {catalog.map((t) => {
            const count = earned.get(`${t.kind}:${t.name}`) ?? 0;
            const color = RARITY_COLOR[t.rarity];
            return (
              <div
                key={`${t.kind}:${t.name}`}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl p-2 text-center ring-1 ${count ? 'bg-black/40' : 'bg-black/20 ring-white/5'}`}
                style={count ? { ['--tw-ring-color' as string]: color, boxShadow: `inset 0 0 24px ${color}33` } : undefined}
              >
                <span className="text-2xl" style={{ filter: count ? undefined : 'grayscale(1) brightness(0.3)' }}>
                  {t.rarity === 'legendary' ? '👑' : t.rarity === 'epic' ? '💎' : t.rarity === 'rare' ? '🏆' : '🪙'}
                </span>
                <span className={`mt-1 text-[11px] font-semibold leading-tight ${count ? 'text-bone' : 'text-ash/40'}`}>{count ? t.name : '???'}</span>
                {count > 1 && <span className="absolute right-1.5 top-1 text-[10px] font-bold text-gold">×{count}</span>}
              </div>
            );
          })}
        </section>

        <section className="space-y-2 pb-2">
          <p className="text-xs font-bold uppercase tracking-widest text-ash">Raid history</p>
          {data && data.raids.length === 0 && <p className="text-sm text-ash">No bosses slain yet. The dungeon awaits.</p>}
          {data?.raids.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-2xl bg-black/30 px-4 py-3 ring-1 ring-white/10">
              <div>
                <p className="font-semibold">{bossName(r.bossId)}</p>
                <p className="text-xs text-ash">
                  {new Date(r.endedAt ?? r.startedAt).toLocaleDateString()} · {formatDuration((r.endedAt ?? r.startedAt) - r.startedAt)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-xl text-gold">{r.maxHp}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ash">items</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
