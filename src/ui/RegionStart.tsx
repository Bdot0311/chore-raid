import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { speech } from '../audio/speech';
import { bossSpriteUrl } from '../game/bossArt';
import { enemy, region } from '../game/campaign';
import { dailyBounty } from '../game/progression';
import type { RegionId } from '../game/types';
import { btn } from './ui';

interface Props {
  regionId: RegionId;
  cleared: boolean;
  onStart: (levels: number, names: string[]) => void;
  onBack: () => void;
}

const ROOM_PRESETS = ['Bedroom', 'Living room', 'Kitchen', 'Bathroom', 'Office', 'Kids’ room', 'Hallway', 'Garage'];

/** The lair's gate: the story beat, the boss, and how big today's quest is. */
export function RegionStart({ regionId, cleared, onStart, onBack }: Props) {
  const r = region(regionId);
  const boss = enemy(r.bossId);
  const minion = enemy(r.minionId);
  const [levels, setLevels] = useState(r.defaultLevels);
  const [rooms, setRooms] = useState<string[]>(['Bedroom', 'Living room']);
  const bounty = dailyBounty(Date.now()) === regionId;
  const steps = r.steps(false);

  useEffect(() => {
    speech.interrupt(r.intro);
    return () => speech.cancel();
  }, [r.intro]);

  const count = r.namedLevels ? rooms.length : levels;
  const toggleRoom = (room: string) =>
    setRooms((rs) => (rs.includes(room) ? rs.filter((x) => x !== room) : rs.length < r.maxLevels ? [...rs, room] : rs));

  return (
    <div className="relative min-h-full overflow-hidden bg-dungeon-950">
      <img src={r.arena} alt="" className="fixed inset-0 h-full w-full object-cover opacity-60" draggable={false} />
      <div className="fixed inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/95" />

      <div className="safe-pad relative mx-auto flex min-h-full max-w-md flex-col gap-4">
        <button className="self-start py-1 text-sm font-semibold text-white/80" onClick={onBack}>
          ← Map
        </button>

        <header className="text-center">
          <p className="font-display text-sm tracking-[0.3em]" style={{ color: `hsl(${r.hue} 85% 72%)` }}>
            {cleared ? 'FREED · REPLAY' : 'NEW QUEST'}
          </p>
          <h1 className="font-display text-4xl leading-tight text-white drop-shadow-lg">{r.name}</h1>
          {bounty && <p className="mt-1 inline-block rounded-full bg-gold px-3 py-0.5 font-display text-sm text-dungeon-950">Today’s bounty · 2× XP</p>}
        </header>

        <div className="relative mx-auto flex h-48 w-full items-end justify-center">
          <motion.img
            src={bossSpriteUrl(minion)}
            alt=""
            className="absolute left-2 h-28 object-contain drop-shadow-2xl"
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          />
          <motion.img
            src={bossSpriteUrl(boss)}
            alt=""
            className="relative h-48 object-contain drop-shadow-2xl"
            initial={{ y: 30, opacity: 0, scale: 0.8 }}
            animate={{ y: [0, -6, 0], opacity: 1, scale: 1 }}
            transition={{ y: { duration: 3, repeat: Infinity }, default: { type: 'spring', stiffness: 160 } }}
          />
        </div>

        <p className="rounded-2xl bg-black/50 p-4 text-center text-[15px] leading-relaxed text-white/90 backdrop-blur">{r.intro}</p>

        {r.levelsPrompt && (
          <section className="rounded-3xl bg-black/50 p-4 ring-1 ring-white/10 backdrop-blur">
            <p className="text-center font-display text-lg text-white">{r.levelsPrompt}</p>
            {r.namedLevels ? (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {ROOM_PRESETS.map((room) => {
                  const on = rooms.includes(room);
                  return (
                    <button
                      key={room}
                      onClick={() => toggleRoom(room)}
                      className={`rounded-full px-3.5 py-2 text-sm font-bold transition ${on ? 'bg-gold text-dungeon-950' : 'bg-white/10 text-white/80'}`}
                    >
                      {on ? `${rooms.indexOf(room) + 1}. ` : ''}
                      {room}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-center gap-5">
                <button className={btn.stepper} onClick={() => setLevels((n) => Math.max(1, n - 1))}>
                  −
                </button>
                <span className="w-16 text-center font-display text-5xl text-white">{levels}</span>
                <button className={btn.stepper} onClick={() => setLevels((n) => Math.min(r.maxLevels, n + 1))}>
                  +
                </button>
              </div>
            )}
            <p className="mt-3 text-center text-sm text-ash">
              {count > 1
                ? `${count} ${r.levelNounPlural}. ${minion.name} guard the first ${count - 1}; ${boss.name} waits in the last.`
                : `One ${r.levelNoun}, straight to ${boss.name}.`}
            </p>
          </section>
        )}

        <section className="rounded-3xl bg-black/50 p-4 ring-1 ring-white/10 backdrop-blur">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ash">Each {r.levelNoun}</p>
          <ol className="space-y-1.5">
            {steps.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 text-sm text-white/90">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 font-display text-xs">{i + 1}</span>
                <span className="flex-1">{s.title}</span>
                <span className="text-xs text-ash">{s.kind === 'fight' ? '⚔️ fight' : s.kind === 'timer' ? `⏱ ${s.minutes} min` : '✓ quick'}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-auto pb-2">
          <button className={btn.primary} disabled={count < 1} onClick={() => onStart(count, rooms)}>
            BEGIN QUEST
          </button>
        </div>
      </div>
    </div>
  );
}
