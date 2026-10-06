import { useEffect, useState } from 'react';
import { activeWindup } from '../game/raidReducer';
import type { Raid } from '../game/types';

/** The wind-up countdown: what the boss demands and how long is left. */
export function WindupBanner({ raid, unit }: { raid: Raid; unit: (n: number) => string }) {
  const windup = activeWindup(raid);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!windup) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [windup]);
  if (!windup) return null;

  const total = windup.deadline - windup.startedAt;
  const leftMs = Math.max(0, windup.deadline - now);
  const secs = Math.ceil(leftMs / 1000);
  const need = windup.target - windup.progress;
  const urgent = secs <= 5;

  return (
    <div
      className={`rounded-2xl border-2 bg-gradient-to-b from-red-600/90 to-red-900/90 px-4 py-3 shadow-lg shadow-red-900/50 ${
        urgent ? 'animate-pulse border-red-200' : 'border-red-400/70'
      }`}
    >
      <div className="flex items-center justify-between font-display text-white">
        <span className="text-lg tracking-wide">WIND-UP</span>
        <span className="text-2xl tabular-nums">{secs}s</span>
      </div>
      <p className="mt-0.5 text-sm font-semibold text-red-100">
        {need} more {unit(need)} to break it
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
        <div className="h-full rounded-full bg-white" style={{ width: `${(leftMs / total) * 100}%` }} />
      </div>
    </div>
  );
}
