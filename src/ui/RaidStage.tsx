import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useRef } from 'react';
import { sfx } from '../audio/sfx';
import { weapon as weaponDef } from '../game/progression';
import type { BossDef } from '../game/types';
import { enemyFor } from '../world/cast';
import { World } from '../world/World';

export type StageHandle = Pick<World, 'hit' | 'comboUp' | 'windup' | 'windupResult' | 'undo' | 'die' | 'defeat' | 'setDormant' | 'setHp'>;

/** The player's chosen hero class, provided by the app. */
export const HeroContext = createContext<string | undefined>(undefined);

interface Props {
  boss: BossDef;
  hpPct: number;
  onBossAttack?: (big: boolean) => void;
  passive?: boolean;
  weaponId?: string;
  /** Which encounter along the lair hall: the quest step. */
  spot?: number;
}

/** Mounts the 3D fight behind the HUD and exposes its effect calls. */
export const RaidStage = forwardRef<StageHandle, Props>(function RaidStage({ boss, hpPct, onBossAttack, passive, weaponId, spot = 0 }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const attackCb = useRef(onBossAttack);
  attackCb.current = onBossAttack;
  const heroId = useContext(HeroContext);
  const hpRef = useRef(hpPct);
  hpRef.current = hpPct;

  useEffect(() => {
    const w = new World();
    world.current = w;
    void w
      .init(host.current!, {
        enemy: enemyFor(boss),
        hero: heroId,
        spot,
        passive,
        trail: weaponDef(weaponId ?? '').trail,
        onBossAttack: (big) => attackCb.current?.(big),
        onStomp: () => sfx.stomp(0.8, false),
        onRoar: () => sfx.roar(),
      })
      .then(() => w.setHp(hpRef.current))
      .catch((err) => console.error('3D scene failed to load', err));
    return () => {
      w.destroy();
      world.current = null;
    };
    // The scene is built once per enemy; the rest only matters at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boss]);

  useEffect(() => {
    world.current?.setHp(hpPct);
  }, [hpPct]);

  useImperativeHandle(ref, () => ({
    hit: (...a) => world.current?.hit(...a),
    comboUp: (...a) => world.current?.comboUp(...a),
    windup: (...a) => world.current?.windup(...a),
    windupResult: (...a) => world.current?.windupResult(...a),
    undo: () => world.current?.undo(),
    die: () => world.current?.die() ?? Promise.resolve(),
    defeat: () => world.current?.defeat() ?? Promise.resolve(),
    setDormant: (on) => world.current?.setDormant(on),
    setHp: (p) => world.current?.setHp(p),
  }));

  return <div ref={host} className="absolute inset-0 overflow-hidden bg-black" aria-hidden />;
});
