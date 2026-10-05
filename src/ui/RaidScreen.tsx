import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { unitWord } from '../game/bosses';
import type { RaidEvent } from '../game/raidReducer';
import type { BossDef, Raid } from '../game/types';
import { useRaid } from '../game/useRaid';
import { BossArt } from './BossArt';
import { ComboMeter } from './ComboMeter';
import { HpBar } from './HpBar';

interface Props {
  boss: BossDef;
  initial: Raid;
  onWin: (raid: Raid) => void;
  onLeave: () => void;
}

interface Floater {
  id: number;
  text: string;
  x: number;
  y: number;
}

let floaterSeq = 0;

export function RaidScreen({ boss, initial, onWin, onLeave }: Props) {
  const [hitKey, setHitKey] = useState(0);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const lastPoint = useRef({ x: 50, y: 40 });

  const handleEvents = (events: RaidEvent[], raid: Raid) => {
    for (const e of events) {
      if (e.type === 'hit') {
        setHitKey((k) => k + 1);
        navigator.vibrate?.(15);
        const id = ++floaterSeq;
        setFloaters((f) => [...f.slice(-6), { id, text: `+${e.gained}`, ...lastPoint.current }]);
        window.setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 900);
      } else if (e.type === 'dead') {
        // Let the last hit land before the screen changes.
        window.setTimeout(() => onWin(raid), 600);
      }
    }
  };

  const { raid, dispatch, flush } = useRaid(initial, handleEvents);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        dispatch({ type: 'HIT', source: 'key' });
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        dispatch({ type: 'UNDO' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    lastPoint.current = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
    dispatch({ type: 'HIT', source: 'tap' });
  };

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  const hpPct = raid.hp / raid.maxHp;
  const done = raid.maxHp - raid.hp;

  return (
    <div
      className="tap-surface safe-pad relative flex h-full flex-col overflow-hidden"
      onPointerDown={onPointerDown}
      style={{ background: `radial-gradient(circle at 50% 35%, hsl(${boss.hue} 40% 16%), var(--color-dungeon-950) 70%)` }}
    >
      <header className="flex items-center justify-between gap-2">
        <button
          className="rounded-lg bg-dungeon-800/80 px-4 py-3 text-sm font-semibold text-ash active:bg-dungeon-700"
          onPointerDown={stop}
          onClick={async () => {
            await flush();
            onLeave();
          }}
        >
          Pause
        </button>
        <h1 className="truncate text-center font-display text-[10px] leading-relaxed text-ash">{boss.name}</h1>
        <button
          className="rounded-lg bg-dungeon-800/80 px-4 py-3 text-sm font-semibold text-ash active:bg-dungeon-700 aria-disabled:opacity-30"
          // aria-disabled, not disabled: a disabled button can let the tap fall through as a hit.
          aria-disabled={done === 0}
          onPointerDown={stop}
          onClick={() => dispatch({ type: 'UNDO' })}
        >
          Undo
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center py-4">
        <BossArt boss={boss} hpPct={hpPct} hitKey={hitKey} />
      </div>

      <div className="space-y-3 pb-2">
        <div className="flex items-end justify-between">
          <p className="font-display text-3xl tabular-nums">{raid.hp}</p>
          <p className="text-right text-sm text-ash">
            {unitWord(boss, raid.hp)} left
            <br />
            <span className="tabular-nums">{raid.score} pts</span>
          </p>
        </div>
        <HpBar hp={raid.hp} max={raid.maxHp} hue={boss.hue} />
        <ComboMeter raid={raid} />
        <p className="pt-2 text-center text-xs uppercase tracking-widest text-ash/70">
          Tap anywhere when one {boss.unit} is done
        </p>
      </div>

      <AnimatePresence>
        {floaters.map((f) => (
          <motion.span
            key={f.id}
            className="pointer-events-none absolute font-display text-xl text-gold drop-shadow"
            style={{ left: `${f.x}%`, top: `${f.y}%` }}
            initial={{ opacity: 1, y: 0, x: '-50%', scale: 0.6 }}
            animate={{ opacity: 0, y: -80, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          >
            {f.text}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
