import { useState } from 'react';
import { unitWord } from '../game/bosses';
import { MAX_HP } from '../game/tuning';
import type { BossDef } from '../game/types';

interface Props {
  boss: BossDef;
  onBegin: (count: number) => void;
  onBack: () => void;
}

export function BossSetup({ boss, onBegin, onBack }: Props) {
  // Raw text so the field can be cleared while typing.
  const [raw, setRaw] = useState('10');
  const clamp = (n: number) => Math.max(1, Math.min(MAX_HP, Math.round(n) || 1));
  const count = clamp(Number(raw));
  const step = (d: number) => setRaw(String(clamp(count + d)));
  const stepBtn =
    'h-16 w-16 rounded-2xl bg-dungeon-800 text-3xl font-bold text-bone ring-1 ring-dungeon-600 active:bg-dungeon-700';

  return (
    <div className="safe-pad mx-auto flex min-h-full max-w-md flex-col gap-8">
      <button className="self-start py-2 text-sm text-ash" onClick={onBack}>
        ← Back
      </button>

      <header className="text-center">
        <p className="text-xs uppercase tracking-widest text-ash">{boss.chore}</p>
        <h1 className="mt-3 font-display text-lg leading-relaxed" style={{ color: `hsl(${boss.hue} 80% 70%)` }}>
          {boss.name}
        </h1>
        <p className="mt-4 text-ash">{boss.countPrompt}</p>
      </header>

      <div className="flex items-center justify-center gap-4">
        <button className={stepBtn} onClick={() => step(-1)} aria-label="One fewer">
          −
        </button>
        <input
          className="w-32 rounded-2xl bg-dungeon-900 py-3 text-center font-display text-4xl tabular-nums text-bone ring-1 ring-dungeon-600 outline-none focus:ring-2 focus:ring-gold"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_HP}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => setRaw(String(count))}
          onFocus={(e) => e.target.select()}
          aria-label={`Number of ${boss.unitPlural}`}
        />
        <button className={stepBtn} onClick={() => step(1)} aria-label="One more">
          +
        </button>
      </div>
      <p className="-mt-4 text-center text-sm text-ash">
        {count} {unitWord(boss, count)} = {count} HP
      </p>

      <div className="mt-auto pb-4">
        <button
          className="w-full rounded-2xl bg-ember py-5 font-display text-sm text-dungeon-950 shadow-lg shadow-ember/30 active:brightness-90"
          onClick={() => onBegin(count)}
        >
          Begin raid
        </button>
      </div>
    </div>
  );
}
