import { useEffect, useState } from 'react';
import { comboDrain, currentMultiplier } from '../game/raidReducer';
import type { Raid } from '../game/types';

export function ComboMeter({ raid }: { raid: Raid }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let frame = 0;
    const loop = () => {
      setNow(Date.now());
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const drain = comboDrain(raid, now);
  const mult = drain > 0 ? currentMultiplier(raid) : 1;

  return (
    <div className="flex items-center gap-3">
      <span className={`font-display text-sm ${mult > 1 ? 'text-gold' : 'text-ash'}`}>×{mult}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-dungeon-800">
        <div className="h-full rounded-full bg-gold" style={{ width: `${drain * 100}%` }} />
      </div>
    </div>
  );
}
