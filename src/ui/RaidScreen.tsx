import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { sfx } from '../audio/sfx';
import { speech } from '../audio/speech';
import { VoiceHits, voiceSupported } from '../audio/voice';
import { unitWord } from '../game/bosses';
import { activeWindup, type RaidEvent } from '../game/raidReducer';
import { lines } from '../game/speechLines';
import type { BossDef, Raid, Settings } from '../game/types';
import { useRaid } from '../game/useRaid';
import { holdWakeLock } from '../lib/wakeLock';
import { ComboMeter } from './ComboMeter';
import { HpBar } from './HpBar';
import { LootStars } from './LootStars';
import { enemyFor } from '../world/cast';
import { ChargeWarning, HeroHealth } from './HeroHealth';
import { RaidStage, type StageHandle } from './RaidStage';
import { WindupBanner } from './WindupBanner';

interface Props {
  boss: BossDef;
  initial: Raid;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onWin: (raid: Raid) => void;
  onLeave: () => void;
  /** Shown above the boss name inside a quest: "Load 2 of 3 · Step 5/6". */
  stepLabel?: string;
  weaponId?: string;
  /** Which encounter along the lair hall (quest step). */
  spot?: number;
}

const HEARTBEAT_BELOW = 0.2;

export function RaidScreen({ boss, initial, settings, onSettings, onWin, onLeave, stepLabel, weaponId, spot }: Props) {
  const stage = useRef<StageHandle>(null);
  const root = useRef<HTMLDivElement>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [wakeHeld, setWakeHeld] = useState<boolean | null>(null);
  const [mic, setMic] = useState<'listening' | 'paused' | 'off' | 'denied'>('off');
  const [dying, setDying] = useState(false);
  const [showTip, setShowTip] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setShowTip(false), 8000);
    return () => window.clearTimeout(id);
  }, []);

  const minion = !enemyFor(boss).boss;

  const handleEvents = (events: RaidEvent[], raid: Raid) => {
    for (const e of events) {
      switch (e.type) {
        case 'hit': {
          const p = lastPoint.current ?? centerPoint();
          lastPoint.current = null;
          const strike = stage.current?.hit(p.x, p.y, e.multiplier, e.gained);
          sfx.swing(strike?.move === 'smash' || strike?.move === 'spin');
          sfx.hit(raid.streak);
          if (strike?.bolt) sfx.lightning();
          navigator.vibrate?.(e.multiplier >= 3 ? 25 : 15);
          const line = lines.progress(boss, e.hp, raid.maxHp);
          if (line && !activeWindup(raid)) speech.say(line, 'progress');
          break;
        }
        case 'combo-up':
          stage.current?.comboUp(e.multiplier);
          sfx.comboUp(e.multiplier);
          if (e.multiplier >= 3) sfx.lightning();
          speech.say(lines.combo(e.multiplier));
          break;
        case 'combo-break':
          sfx.comboBreak();
          break;
        case 'undo':
          stage.current?.undo();
          sfx.undo();
          break;
        case 'windup-start':
          stage.current?.windup(true);
          sfx.windupStart();
          navigator.vibrate?.([60, 40, 60]);
          speech.say(lines.windup(boss, e.target, Math.round((e.deadline - Date.now()) / 1000)));
          break;
        case 'windup-beaten':
          stage.current?.windupResult(true, e.bonus);
          sfx.windupBeaten();
          navigator.vibrate?.([30, 30, 80]);
          speech.say(lines.beaten(boss));
          break;
        case 'windup-missed':
          stage.current?.windupResult(false);
          sfx.windupMissed();
          speech.say(lines.missed(boss));
          break;
        case 'enemy-charge':
          stage.current?.enemyCharge();
          sfx.windupStart();
          navigator.vibrate?.([40, 60, 40]);
          speech.say(lines.charge(boss, minion, false));
          break;
        case 'interrupt':
          stage.current?.interrupt();
          sfx.windupBeaten();
          speech.say(lines.interrupt());
          break;
        case 'hero-struck':
          stage.current?.heroStruck(e.damage, e.big, events.some((x) => x.type === 'knockdown'));
          speech.say(minion ? lines.struckMinion() : lines.attack(boss));
          break;
        case 'knockdown':
          speech.say(lines.knockdown());
          break;
        case 'dead':
          setDying(true);
          sfx.death();
          navigator.vibrate?.([80, 60, 200]);
          speech.interrupt(lines.death(boss));
          void (stage.current?.die() ?? Promise.resolve()).then(() => onWin(raid));
          break;
      }
    }
  };

  const { raid, dispatch, flush } = useRaid(initial, handleEvents);
  const hpPct = raid.hp / raid.maxHp;

  function centerPoint() {
    const r = root.current?.getBoundingClientRect();
    return { x: (r?.width ?? 360) / 2, y: (r?.height ?? 640) * 0.42 };
  }

  // Audio settings, the opening line, and the wake lock.
  useEffect(() => {
    sfx.setVolume(settings.volume, settings.muted);
    speech.setEnabled(settings.speech && !settings.muted);
  }, [settings]);

  useEffect(() => {
    if (initial.hits.length === 0) speech.say(lines.start(boss, initial.maxHp));
    else speech.say(lines.resumed(boss, initial.hp));
    const release = holdWakeLock(setWakeHeld);
    const offSpeaking = speech.onSpeaking((on) => sfx.duck(on));
    return () => {
      release();
      offSpeaking();
      speech.cancel();
    };
    // Runs once per raid screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Voice hits: the recognizer pauses while the game is talking.
  useEffect(() => {
    if (!settings.voiceHits || !voiceSupported()) return;
    const voice = new VoiceHits(() => dispatch({ type: 'HIT', source: 'voice' }), setMic);
    voice.start();
    const off = speech.onSpeaking((on) => voice.setPaused(on));
    return () => {
      off();
      voice.stop();
    };
  }, [settings.voiceHits, dispatch]);

  // Low-HP heartbeat.
  useEffect(() => {
    if (hpPct >= HEARTBEAT_BELOW || raid.status !== 'active') return;
    const id = window.setInterval(() => sfx.heartbeat(), 1300);
    return () => window.clearInterval(id);
  }, [hpPct < HEARTBEAT_BELOW, raid.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wind-up countdown ticks: soft in the last 10 s, urgent in the last 3.
  const windup = activeWindup(raid);
  useEffect(() => {
    if (!windup) return;
    let lastSec = -1;
    const id = window.setInterval(() => {
      const secs = Math.ceil((windup.deadline - Date.now()) / 1000);
      if (secs !== lastSec && secs > 0 && secs <= 10) sfx.tick(secs <= 3);
      lastSec = secs;
    }, 100);
    return () => window.clearInterval(id);
  }, [windup?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

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
    lastPoint.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dispatch({ type: 'HIT', source: 'tap' });
  };

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  const done = raid.maxHp - raid.hp;
  const toggleMute = () => onSettings({ ...settings, muted: !settings.muted });
  const iconBtn =
    'grid h-12 w-12 place-items-center rounded-2xl bg-black/40 text-bone ring-1 ring-white/10 backdrop-blur active:scale-95 active:bg-black/60 transition';

  return (
    <div
      ref={root}
      className="tap-surface relative h-full overflow-hidden bg-dungeon-950"
      onPointerDown={dying ? undefined : onPointerDown}
    >
      <RaidStage
        ref={stage}
        boss={boss}
        hpPct={hpPct}
        weaponId={weaponId}
        spot={spot}
        onBossAttack={(big) => {
          sfx.bossAttack(big);
          navigator.vibrate?.(big ? [120, 50, 120] : 90);
        }}
      />

      <div className="safe-pad pointer-events-none relative flex h-full flex-col">
        <header className="flex items-start gap-3">
          <button
            className={`${iconBtn} pointer-events-auto`}
            aria-label="Pause"
            onPointerDown={stop}
            onClick={async () => {
              sfx.click();
              await flush();
              onLeave();
            }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h1 className="truncate font-display text-lg leading-tight text-bone drop-shadow">
                {stepLabel && <span className="block text-xs font-sans font-bold uppercase tracking-widest text-gold">{stepLabel}</span>}
                {boss.name}
              </h1>
              <span className="font-display text-sm tabular-nums text-ash">
                {raid.hp}/{raid.maxHp}
              </span>
            </div>
            <div className="mt-1.5">
              <HpBar hp={raid.hp} max={raid.maxHp} hue={boss.hue} />
            </div>
            <div className="mt-2">
              <LootStars stars={raid.lootStars} />
            </div>
            {raid.duel && (
              <div className="mt-2">
                <HeroHealth duel={raid.duel} />
              </div>
            )}
          </div>
          <button className={`${iconBtn} pointer-events-auto`} aria-label={settings.muted ? 'Unmute' : 'Mute'} onPointerDown={stop} onClick={toggleMute}>
            {settings.muted ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor" />
                <path d="M16 9l5 6M21 9l-5 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor" />
                <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
              </svg>
            )}
          </button>
        </header>

        <div className="flex-1" />

        <div className="space-y-3">
          <ChargeWarning duel={raid.duel} />
          <WindupBanner raid={raid} unit={(n) => unitWord(boss, n)} />
          {wakeHeld === false && showTip && (
            <p className="rounded-xl bg-black/50 px-3 py-2 text-center text-xs text-ash backdrop-blur">
              Tip: set your screen auto-lock to Never for this raid.
            </p>
          )}
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-6xl leading-none tabular-nums text-bone drop-shadow-lg">{raid.hp}</p>
              <p className="mt-1 text-sm font-semibold text-ash">{unitWord(boss, raid.hp)} left</p>
            </div>
            <div className="text-right">
              {mic !== 'off' && (
                <p className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${mic === 'listening' ? 'bg-heal/20 text-heal' : 'bg-white/10 text-ash'}`}>
                  <span className={`h-2 w-2 rounded-full ${mic === 'listening' ? 'animate-pulse bg-heal' : 'bg-ash'}`} />
                  {mic === 'listening' ? 'Say “hit”' : mic === 'denied' ? 'Mic blocked' : 'Mic paused'}
                </p>
              )}
              <p className="font-display text-2xl tabular-nums text-gold drop-shadow">{raid.score.toLocaleString()}</p>
              <p className="text-xs font-semibold uppercase tracking-widest text-ash">Score</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <ComboMeter raid={raid} />
            </div>
            <button
              className="pointer-events-auto rounded-2xl bg-black/40 px-4 py-3 text-sm font-bold text-ash ring-1 ring-white/10 backdrop-blur transition active:scale-95 aria-disabled:opacity-30"
              // aria-disabled, not disabled: a disabled button can let the tap fall through as a hit.
              aria-disabled={done === 0}
              onPointerDown={stop}
              onClick={() => dispatch({ type: 'UNDO' })}
            >
              Undo
            </button>
          </div>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-ash/70">
            Tap anywhere for each {boss.unit} done
          </p>
        </div>
      </div>
    </div>
  );
}
