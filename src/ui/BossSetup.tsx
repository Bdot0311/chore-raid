import { useState } from 'react';
import { voiceSupported } from '../audio/voice';
import { unitWord } from '../game/bosses';
import { MAX_HP } from '../game/tuning';
import type { BossDef, Settings } from '../game/types';

interface Props {
  boss: BossDef;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onBegin: (count: number) => void;
  onBack: () => void;
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl bg-dungeon-900/80 px-4 py-3 text-left ring-1 ring-white/10"
    >
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs text-ash">{hint}</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-ember' : 'bg-dungeon-700'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

export function BossSetup({ boss, settings, onSettings, onBegin, onBack }: Props) {
  // Raw text so the field can be cleared while typing.
  const [raw, setRaw] = useState('10');
  const clamp = (n: number) => Math.max(1, Math.min(MAX_HP, Math.round(n) || 1));
  const count = clamp(Number(raw));
  const step = (d: number) => setRaw(String(clamp(count + d)));
  const stepBtn =
    'h-16 w-16 rounded-2xl bg-gradient-to-b from-dungeon-600 to-dungeon-800 text-3xl font-bold text-bone shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_4px_0_#0d0b1a] active:translate-y-1 active:shadow-none transition';
  const accent = `hsl(${boss.hue} 80% 70%)`;

  return (
    <div
      className="min-h-full"
      style={{ background: `radial-gradient(circle at 50% 0%, hsl(${boss.hue} 45% 18%), var(--color-dungeon-950) 65%)` }}
    >
      <div className="safe-pad mx-auto flex min-h-full max-w-md flex-col gap-7">
        <button className="self-start py-2 text-sm font-semibold text-ash" onClick={onBack}>
          ← Back
        </button>

        <header className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-ash">{boss.chore}</p>
          <h1 className="mt-2 font-display text-4xl leading-tight drop-shadow-lg" style={{ color: accent }}>
            {boss.name}
          </h1>
          <p className="mt-3 text-ash">{boss.countPrompt}</p>
        </header>

        <div className="flex items-center justify-center gap-4">
          <button className={stepBtn} onClick={() => step(-1)} aria-label="One fewer">
            −
          </button>
          <input
            className="w-36 rounded-2xl bg-black/40 py-3 text-center font-display text-6xl tabular-nums text-bone ring-2 ring-white/10 outline-none focus:ring-gold"
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
        <p className="-mt-3 text-center font-semibold text-ash">
          {count} {unitWord(boss, count)} = <span style={{ color: accent }}>{count} HP</span>
        </p>

        <div className="space-y-2">
          <Toggle
            label="Spoken updates"
            hint="The boss narrates your progress, so you can keep your eyes on the chore."
            on={settings.speech}
            onChange={(speech) => onSettings({ ...settings, speech })}
          />
          {voiceSupported() && (
            <Toggle
              label="Voice hits"
              hint="Say “hit”, “done” or “next” instead of tapping. Works best in Chrome."
              on={settings.voiceHits}
              onChange={(voiceHits) => onSettings({ ...settings, voiceHits })}
            />
          )}
        </div>

        <div className="mt-auto pb-2">
          <button
            className="w-full rounded-2xl bg-gradient-to-b from-[#ff8a5c] to-ember py-5 font-display text-2xl tracking-wide text-dungeon-950 shadow-[inset_0_2px_0_rgba(255,255,255,0.4),0_6px_0_#a8391a,0_12px_30px_rgba(255,107,61,0.35)] transition active:translate-y-1.5 active:shadow-[inset_0_2px_0_rgba(255,255,255,0.4),0_0_0_#a8391a]"
            onClick={() => onBegin(count)}
          >
            BEGIN RAID
          </button>
        </div>
      </div>
    </div>
  );
}
