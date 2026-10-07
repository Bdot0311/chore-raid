import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../audio/sfx';
import { speech } from '../audio/speech';
import { say } from '../game/narration';
import { unitWord } from '../game/bosses';
import {
  currentStep,
  enemy,
  levelName,
  questReducer,
  region,
  stepsFor,
  type QuestAction,
  type QuestEvent,
  type StepDef,
} from '../game/campaign';
import { dailyBounty, heroLevel, WEAPONS } from '../game/progression';
import { addItems, awardXp, getRaid, saveQuest, startRaid } from '../game/store';
import type { BossDef, Profile, Quest, Raid, Settings } from '../game/types';
import { MAX_HP } from '../game/tuning';
import { holdWakeLock } from '../lib/wakeLock';
import { RaidScreen } from './RaidScreen';
import { RaidStage, type StageHandle } from './RaidStage';
import { btn, panel } from './ui';
import { XpBar } from './XpBar';

interface Props {
  initial: Quest;
  profile: Profile;
  onProfile: (p: Profile) => void;
  onSettings: (s: Settings) => void;
  /** The quest's final boss fell: show its loot, then the freed-region story beat. */
  onBossVictory: (quest: Quest, raid: Raid, boss: BossDef) => void;
  onExit: () => void;
}

interface ClearInfo {
  title: string;
  xp: number;
  levelUp?: number;
  unlocked?: string;
  questDone: boolean;
}

function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Progress dots for the steps of the current level. */
function StepDots({ quest }: { quest: Quest }) {
  const steps = stepsFor(quest);
  return (
    <div className="flex gap-1.5">
      {steps.map((s, i) => (
        <span
          key={s.id}
          className={`h-2 flex-1 rounded-full transition-colors ${
            i < quest.step ? 'bg-gold' : i === quest.step ? 'bg-white' : 'bg-white/20'
          } ${s.kind === 'fight' && i >= quest.step ? 'ring-2 ring-ember' : ''}`}
        />
      ))}
    </div>
  );
}

function QuestHeader({ quest, onExit }: { quest: Quest; onExit: () => void }) {
  const r = region(quest.region);
  return (
    <header className={`${panel} !p-3`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white" onClick={onExit} aria-label="Back to map">
          ✕
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[11px] font-bold uppercase tracking-widest" style={{ color: `hsl(${r.hue} 85% 72%)` }}>
            {r.name}
          </p>
          <p className="truncate font-display text-lg leading-tight text-white">{levelName(quest, quest.level)}</p>
        </div>
        <div className="w-10 text-right font-display text-sm text-gold">
          {quest.step + 1}/{stepsFor(quest).length}
        </div>
      </div>
      <StepDots quest={quest} />
    </header>
  );
}

/** A quick real-world step: read it, do it, tap DONE, and the minion pops. */
function TaskStep({ quest, step, foe, weaponId, onDone, onExit }: {
  quest: Quest;
  step: StepDef;
  foe: BossDef;
  weaponId: string;
  onDone: () => void;
  onExit: () => void;
}) {
  const stage = useRef<StageHandle>(null);
  const [busy, setBusy] = useState(false);
  const done = async () => {
    if (busy) return;
    setBusy(true);
    sfx.swing(true);
    sfx.hit(6);
    navigator.vibrate?.([30, 30, 60]);
    await (stage.current?.defeat() ?? Promise.resolve());
    onDone();
  };
  return (
    <div className="relative h-full overflow-hidden bg-dungeon-950">
      <RaidStage ref={stage} boss={foe} hpPct={1} passive weaponId={weaponId} />
      <div className="safe-pad pointer-events-none relative flex h-full flex-col">
        <div className="pointer-events-auto">
          <QuestHeader quest={quest} onExit={onExit} />
        </div>
        <div className="flex-1" />
        <motion.div
          className={`${panel} pointer-events-auto space-y-3`}
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gold">
              {step.finisher ? 'Finishing blow' : `Step ${quest.step + 1}`} · +{step.xp} XP
            </p>
            <h2 className="font-display text-3xl leading-tight text-white">{step.title}</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-white/85">{step.instruction}</p>
          </div>
          <button className={step.finisher ? btn.gold : btn.primary} disabled={busy} onClick={done}>
            {step.finisher ? 'DONE · FINISH IT' : 'DONE · STRIKE'}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

/** A machine cycle: start the washer, start the timer, go live your life. */
function TimerStep({ quest, step, foe, weaponId, onStart, onDone, onExit }: {
  quest: Quest;
  step: StepDef;
  foe: BossDef;
  weaponId: string;
  onStart: (minutes: number) => void;
  onDone: () => void;
  onExit: () => void;
}) {
  const stage = useRef<StageHandle>(null);
  const [minutes, setMinutes] = useState(step.minutes ?? 30);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const running = quest.timerEndsAt !== undefined;
  const left = running ? quest.timerEndsAt! - now : 0;
  const finished = running && left <= 0;
  const total = (quest.timerMinutes ?? minutes) * 60_000;
  const rang = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    stage.current?.setDormant(running && !finished);
  }, [running, finished]);

  // Ring once when the cycle ends, and send a notification if the page is in the background.
  useEffect(() => {
    if (!running) return;
    const fire = () => {
      if (rang.current) return;
      rang.current = true;
      sfx.alarm();
      navigator.vibrate?.([200, 100, 200, 100, 400]);
      speech.say(say.cycleDone);
      if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Chore Raid: cycle done', { body: `${step.title} is finished. Your next step is ready.`, tag: quest.id });
      }
    };
    if (quest.timerEndsAt! <= Date.now()) {
      fire();
      return;
    }
    const id = window.setTimeout(fire, quest.timerEndsAt! - Date.now());
    return () => window.clearTimeout(id);
  }, [running, quest.timerEndsAt, quest.id, step.title]);

  const start = () => {
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
    sfx.click();
    onStart(minutes);
  };

  const done = async () => {
    if (busy) return;
    setBusy(true);
    sfx.swing(true);
    sfx.hit(4);
    await (stage.current?.defeat() ?? Promise.resolve());
    onDone();
  };

  const pct = running ? Math.min(1, Math.max(0, 1 - left / total)) : 0;
  const R = 70;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative h-full overflow-hidden bg-dungeon-950">
      <RaidStage ref={stage} boss={foe} hpPct={1} passive weaponId={weaponId} />
      <div className="safe-pad pointer-events-none relative flex h-full flex-col">
        <div className="pointer-events-auto">
          <QuestHeader quest={quest} onExit={onExit} />
        </div>
        <div className="flex flex-1 items-center justify-center">
          {running && (
            <div className="relative grid place-items-center">
              <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90 drop-shadow-2xl">
                <circle cx="90" cy="90" r={R} fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.15)" strokeWidth="12" />
                <circle
                  cx="90"
                  cy="90"
                  r={R}
                  fill="none"
                  stroke={finished ? '#4ade80' : '#ffc94d'}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - pct)}
                />
              </svg>
              <div className="absolute text-center">
                <p className="font-display text-4xl tabular-nums text-white">{finished ? 'DONE!' : fmt(left)}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-ash">{finished ? 'cycle finished' : 'remaining'}</p>
              </div>
            </div>
          )}
        </div>
        <motion.div className={`${panel} pointer-events-auto space-y-3`} initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gold">
              Step {quest.step + 1} · Machine cycle · +{step.xp} XP
            </p>
            <h2 className="font-display text-3xl leading-tight text-white">{step.title}</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-white/85">
              {running && !finished
                ? `${foe.name} ${foe.name.startsWith('The ') && foe.name.endsWith('s') ? 'are' : 'is'} stuck in the machine. Go do something else. We will ring when it is done.`
                : step.instruction}
            </p>
          </div>
          {!running ? (
            <>
              <div className="flex items-center justify-center gap-4">
                <button className={btn.stepper} onClick={() => setMinutes((m) => Math.max(5, m - 5))}>
                  −
                </button>
                <span className="w-28 text-center font-display text-4xl text-white">{minutes} min</span>
                <button className={btn.stepper} onClick={() => setMinutes((m) => Math.min(180, m + 5))}>
                  +
                </button>
              </div>
              <button className={btn.primary} onClick={start}>
                START TIMER
              </button>
              <button className="w-full py-1 text-sm font-semibold text-ash" onClick={done}>
                No machine needed? Skip ahead
              </button>
            </>
          ) : finished ? (
            <button className={btn.gold} disabled={busy} onClick={done}>
              ON TO THE NEXT STEP
            </button>
          ) : (
            <button className={btn.secondary} disabled={busy} onClick={done}>
              The machine’s already done
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}

/** Before a fight: count the pile, which becomes the enemy's HP. */
function FightSetup({ quest, step, foe, onBegin, onExit }: {
  quest: Quest;
  step: StepDef;
  foe: BossDef;
  onBegin: (count: number) => void;
  onExit: () => void;
}) {
  const [raw, setRaw] = useState('10');
  const count = Math.max(1, Math.min(MAX_HP, Math.round(Number(raw)) || 1));
  const isBoss = foe.id === region(quest.region).bossId;
  const r = region(quest.region);
  return (
    <div className="relative h-full overflow-hidden bg-dungeon-950">
      <img src={r.arena} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" draggable={false} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-black/90" />
      <div className="safe-pad relative flex h-full flex-col gap-4">
        <QuestHeader quest={quest} onExit={onExit} />
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {isBoss && (
            <motion.p
              className="font-display text-2xl tracking-[0.15em] text-ember"
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              BOSS FIGHT
            </motion.p>
          )}
          <h2 className="mt-1 font-display text-4xl leading-tight text-white drop-shadow-lg">{step.title}</h2>
          <p className="mt-2 max-w-xs text-white/85">{step.instruction}</p>
        </div>
        <div className={`${panel} space-y-3`}>
          <p className="text-center font-display text-lg text-white">{step.countPrompt}</p>
          <div className="flex items-center justify-center gap-4">
            <button className={btn.stepper} onClick={() => setRaw(String(Math.max(1, count - 1)))}>
              −
            </button>
            <input
              className="w-28 rounded-2xl bg-black/50 py-2 text-center font-display text-5xl tabular-nums text-white ring-2 ring-white/10 outline-none focus:ring-gold"
              type="number"
              inputMode="numeric"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              onBlur={() => setRaw(String(count))}
              onFocus={(e) => e.target.select()}
              aria-label={step.countPrompt}
            />
            <button className={btn.stepper} onClick={() => setRaw(String(Math.min(MAX_HP, count + 1)))}>
              +
            </button>
          </div>
          <p className="text-center text-sm text-ash">
            {count} {unitWord(foe, count)} = {count} HP. One done, one hit.
          </p>
          <button className={btn.primary} onClick={() => onBegin(count)}>
            {isBoss ? 'FIGHT THE BOSS' : 'FIGHT!'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Between levels: the XP tally, a level-up if earned, and what comes next. */
function LevelClear({ info, quest, profile, onNext }: { info: ClearInfo; quest: Quest; profile: Profile; onNext: () => void }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / 900);
      setShown(Math.round(info.xp * k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [info.xp]);
  const r = region(quest.region);
  const nextName = !info.questDone ? levelName(quest, quest.level) : '';

  return (
    <div className="relative h-full overflow-hidden bg-dungeon-950">
      <img src={r.arena} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" draggable={false} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/90" />
      <div className="safe-pad relative mx-auto flex h-full max-w-md flex-col items-center justify-center gap-6 text-center">
        <motion.div initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 12 }}>
          <p className="font-display text-lg tracking-[0.3em] text-gold">{info.questDone ? 'QUEST COMPLETE' : 'LEVEL CLEARED'}</p>
          <h1 className="mt-1 font-display text-5xl leading-tight text-white drop-shadow-lg">{info.title}</h1>
        </motion.div>
        <motion.p className="font-display text-6xl tabular-nums text-gold drop-shadow-lg" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          +{shown} XP
        </motion.p>
        <div className="w-full">
          <XpBar xp={profile.xp} />
        </div>
        <AnimatePresence>
          {info.levelUp && (
            <motion.div
              className="w-full rounded-3xl bg-gradient-to-b from-gold/30 to-gold/5 p-4 ring-2 ring-gold"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.9, type: 'spring' }}
            >
              <p className="font-display text-3xl text-gold">LEVEL UP! Level {info.levelUp}</p>
              {info.unlocked && <p className="mt-1 font-semibold text-white">New weapon unlocked: {info.unlocked}. Equip it in the Armory.</p>}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="w-full">
          <button className={btn.primary} onClick={onNext}>
            {info.questDone ? 'CLAIM THE LOOT' : `ON TO ${nextName.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Runs a campaign quest: one real chore step at a time, levels, XP and the boss at the end. */
export function QuestRunner({ initial, profile, onProfile, onSettings, onBossVictory, onExit }: Props) {
  const [quest, setQuest] = useState(initial);
  const questRef = useRef(initial);
  const [raid, setRaid] = useState<Raid>();
  const [clear, setClear] = useState<ClearInfo>();
  const r = region(quest.region);
  const step = currentStep(quest);
  const foe = enemy(step.enemyId);
  const weaponId = profile.equippedSkin;
  const lastSpoken = useRef('');

  // Keep the screen on for the whole quest, not just the fights.
  useEffect(() => holdWakeLock(() => {}), []);

  // Read each new step aloud so the player can keep their hands busy.
  useEffect(() => {
    if (clear || quest.status !== 'active') return;
    const key = `${quest.level}:${quest.step}`;
    if (lastSpoken.current === key) return;
    lastSpoken.current = key;
    if (step.kind !== 'fight' || !quest.raidId) speech.interrupt(say.step(step.title, step.instruction));
  }, [quest.level, quest.step, quest.status, quest.raidId, step, clear]);

  // Load the fight in progress, if this step has one.
  useEffect(() => {
    if (!quest.raidId) {
      setRaid(undefined);
      return;
    }
    let cancelled = false;
    void getRaid(quest.raidId).then((r2) => {
      if (!cancelled) setRaid(r2);
    });
    return () => {
      cancelled = true;
    };
  }, [quest.raidId]);

  const apply = useCallback(
    async (action: QuestAction) => {
      const before = questRef.current;
      const { quest: next, events } = questReducer(before, action, Date.now());
      if (next === before) return;
      questRef.current = next;
      setQuest(next);
      await saveQuest(next);

      const xp = events.reduce((sum, e: QuestEvent) => sum + e.xp, 0);
      if (!xp) return;
      const mult = dailyBounty(Date.now()) === next.region ? 2 : 1;
      const levelBefore = heroLevel(profile.xp);
      const questDone = events.some((e) => e.type === 'quest-clear');
      const updated = await awardXp(xp * mult, questDone ? next.region : undefined);
      onProfile(updated);
      sfx.stepDone();

      const levelAfter = heroLevel(updated.xp);
      const leveled = levelAfter > levelBefore;
      if (leveled) sfx.levelUp();
      const levelEvent = events.find((e) => e.type === 'level-clear');
      if (levelEvent && levelEvent.type === 'level-clear') {
        setClear({
          title: `${levelName(before, levelEvent.level)} cleared!`,
          xp: xp * mult,
          levelUp: leveled ? levelAfter : undefined,
          unlocked: leveled ? WEAPONS.find((w) => w.unlockLevel > levelBefore && w.unlockLevel <= levelAfter)?.name : undefined,
          questDone,
        });
        speech.interrupt(questDone ? say.questCleared(r.name) : say.levelCleared);
      } else if (leveled) {
        speech.say(say.levelUp(levelAfter));
      }
    },
    [profile.xp, onProfile, r.name],
  );

  // A fight won just before a reload never reached the quest: hand it off once.
  const handedOff = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (raid?.status === 'won' && raid.id === quest.raidId && handedOff.current !== raid.id) {
      handedOff.current = raid.id;
      void winFight(raid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raid, quest.raidId]);

  const beginFight = async (count: number) => {
    sfx.click();
    const fight = await startRaid(foe.id, count, quest.id);
    setRaid(fight);
    await apply({ type: 'START_FIGHT', raidId: fight.id });
  };

  const winFight = async (won: Raid) => {
    handedOff.current = won.id;
    const isBoss = foe.id === r.bossId;
    if (!isBoss) onProfile(await addItems(won.maxHp));
    await apply({ type: 'WIN_FIGHT', items: won.maxHp, boss: isBoss });
  };

  if (clear) {
    return (
      <LevelClear
        info={clear}
        quest={quest}
        profile={profile}
        onNext={async () => {
          setClear(undefined);
          if (clear.questDone) {
            const bossRaid = quest.bossRaidId ? await getRaid(quest.bossRaidId) : undefined;
            if (bossRaid) onBossVictory(quest, bossRaid, enemy(r.bossId));
            else onExit();
          }
        }}
      />
    );
  }

  if (quest.status !== 'active') return null;

  const key = `${quest.level}-${quest.step}`;
  switch (step.kind) {
    case 'task':
      return <TaskStep key={key} quest={quest} step={step} foe={foe} weaponId={weaponId} onDone={() => void apply({ type: 'COMPLETE_STEP' })} onExit={onExit} />;
    case 'timer':
      return (
        <TimerStep
          key={key}
          quest={quest}
          step={step}
          foe={foe}
          weaponId={weaponId}
          onStart={(minutes) => void apply({ type: 'START_TIMER', minutes })}
          onDone={() => void apply({ type: 'COMPLETE_STEP' })}
          onExit={onExit}
        />
      );
    case 'fight':
      if (!quest.raidId) return <FightSetup key={key} quest={quest} step={step} foe={foe} onBegin={beginFight} onExit={onExit} />;
      if (!raid) return <div className="h-full bg-dungeon-950" />;
      if (raid.status === 'won') return <div className="h-full bg-dungeon-950" />;
      return (
        <RaidScreen
          key={raid.id}
          boss={foe}
          initial={raid}
          settings={profile.settings}
          onSettings={onSettings}
          weaponId={weaponId}
          stepLabel={`${levelName(quest, quest.level)} · Step ${quest.step + 1}/${stepsFor(quest).length}`}
          onLeave={onExit}
          onWin={(won) => void winFight(won)}
        />
      );
  }
}
