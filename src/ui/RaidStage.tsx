import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { bossMaterial, loadBossTexture } from '../game/bossArt';
import type { BossDef } from '../game/types';
import { RaidScene } from '../scene/RaidScene';

export type StageHandle = Pick<RaidScene, 'hit' | 'comboUp' | 'windup' | 'windupResult' | 'undo' | 'die' | 'setHp'>;

interface Props {
  boss: BossDef;
  hpPct: number;
}

/** Mounts the PixiJS raid scene behind the HUD and exposes its effect calls. */
export const RaidStage = forwardRef<StageHandle, Props>(function RaidStage({ boss, hpPct }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<RaidScene | null>(null);

  useEffect(() => {
    const s = new RaidScene();
    scene.current = s;
    let cancelled = false;
    void loadBossTexture(boss).then((texture) => {
      if (cancelled || !host.current) return;
      return s.init(host.current, { hue: boss.hue, texture, material: bossMaterial(boss) });
    });
    return () => {
      cancelled = true;
      s.destroy();
      scene.current = null;
    };
  }, [boss]);

  useEffect(() => {
    scene.current?.setHp(hpPct);
  }, [hpPct]);

  useImperativeHandle(ref, () => ({
    hit: (...a) => scene.current?.hit(...a),
    comboUp: (...a) => scene.current?.comboUp(...a),
    windup: (...a) => scene.current?.windup(...a),
    windupResult: (...a) => scene.current?.windupResult(...a),
    undo: () => scene.current?.undo(),
    die: () => scene.current?.die() ?? Promise.resolve(),
    setHp: (p) => scene.current?.setHp(p),
  }));

  return <div ref={host} className="absolute inset-0" aria-hidden />;
});
