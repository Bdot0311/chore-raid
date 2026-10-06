import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { bossMaterial, loadArena, loadBossStages, loadWeapon } from '../game/bossArt';
import type { BossDef } from '../game/types';
import { RaidScene } from '../scene/RaidScene';

export type StageHandle = Pick<RaidScene, 'hit' | 'comboUp' | 'windup' | 'windupResult' | 'undo' | 'die' | 'setHp'>;

interface Props {
  boss: BossDef;
  hpPct: number;
  onBossAttack?: (big: boolean) => void;
}

/** Mounts the PixiJS raid scene behind the HUD and exposes its effect calls. */
export const RaidStage = forwardRef<StageHandle, Props>(function RaidStage({ boss, hpPct, onBossAttack }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<RaidScene | null>(null);
  const attackCb = useRef(onBossAttack);
  attackCb.current = onBossAttack;

  useEffect(() => {
    const s = new RaidScene();
    scene.current = s;
    let cancelled = false;
    void Promise.all([loadBossStages(boss), loadArena(boss), loadWeapon()]).then(([stages, arena, weapon]) => {
      if (cancelled || !host.current) return;
      return s.init(host.current, {
        hue: boss.hue,
        stages,
        arena,
        weapon,
        material: bossMaterial(boss),
        onBossAttack: (big) => attackCb.current?.(big),
      });
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
