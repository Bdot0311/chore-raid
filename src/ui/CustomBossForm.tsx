import { useState } from 'react';
import type { BossDef } from '../game/types';
import { newId } from '../lib/id';

interface Props {
  onCreate: (boss: BossDef) => void;
  onBack: () => void;
}

/** Any chore can become a boss: a Mess Elemental tinted to the chosen color. */
export function CustomBossForm({ onCreate, onBack }: Props) {
  const [chore, setChore] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('thing');
  const [hue, setHue] = useState(140);
  const valid = chore.trim().length > 1 && unit.trim().length > 0;
  const input =
    'w-full rounded-2xl bg-black/40 px-4 py-3 text-bone ring-1 ring-white/10 outline-none placeholder:text-ash/50 focus:ring-2 focus:ring-gold';

  const create = () => {
    const u = unit.trim().toLowerCase();
    const boss: BossDef = {
      id: newId(),
      kind: 'custom',
      name: name.trim() || `The ${u.replace(/^\w/, (c) => c.toUpperCase())} Elemental`,
      chore: chore.trim().replace(/^\w/, (c) => c.toUpperCase()),
      unit: u,
      unitPlural: u.endsWith('s') ? u : `${u}s`,
      countPrompt: `Count every ${u}. The Elemental is watching.`,
      hue,
      createdAt: Date.now(),
      builtIn: false,
    };
    onCreate(boss);
  };

  return (
    <div className="min-h-full" style={{ background: `radial-gradient(circle at 50% 0%, hsl(${hue} 45% 18%), var(--color-dungeon-950) 65%)` }}>
      <div className="safe-pad mx-auto flex min-h-full max-w-md flex-col gap-5">
        <button className="self-start py-2 text-sm font-semibold text-ash" onClick={onBack}>
          ← Back
        </button>
        <header className="text-center">
          <h1 className="font-display text-4xl" style={{ color: `hsl(${hue} 80% 70%)` }}>
            Summon a boss
          </h1>
          <p className="mt-1 text-sm text-ash">Any chore with countable items can be fought.</p>
        </header>

        <div
          className="mx-auto h-36 w-36 rounded-[45%_55%_40%_60%] shadow-2xl"
          style={{ background: `radial-gradient(circle at 40% 35%, hsl(${hue} 75% 65%), hsl(${hue} 60% 25%))`, boxShadow: `0 0 60px hsl(${hue} 80% 50% / 0.5)` }}
        />

        <label className="space-y-1.5">
          <span className="text-sm font-semibold">The chore</span>
          <input className={input} placeholder="e.g. Water the plants" value={chore} onChange={(e) => setChore(e.target.value)} maxLength={40} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold">One item is a…</span>
          <input className={input} placeholder="plant" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={16} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold">Boss name (optional)</span>
          <input className={input} placeholder="The Thirsty Elemental" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold">Color</span>
          <input
            type="range"
            min={0}
            max={359}
            value={hue}
            onChange={(e) => setHue(Number(e.target.value))}
            className="h-3 w-full cursor-pointer appearance-none rounded-full"
            style={{ background: 'linear-gradient(90deg, hsl(0 80% 55%), hsl(60 80% 55%), hsl(120 80% 45%), hsl(180 80% 45%), hsl(240 80% 60%), hsl(300 80% 55%), hsl(359 80% 55%))' }}
          />
        </label>

        <div className="mt-auto pb-2">
          <button
            disabled={!valid}
            onClick={create}
            className="w-full rounded-2xl bg-gradient-to-b from-[#ff8a5c] to-ember py-5 font-display text-2xl text-dungeon-950 shadow-[0_6px_0_#a8391a] transition active:translate-y-1.5 active:shadow-none disabled:opacity-40"
          >
            SUMMON
          </button>
        </div>
      </div>
    </div>
  );
}
