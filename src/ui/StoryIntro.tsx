import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { speech } from '../audio/speech';
import { unlockAudio } from '../audio/unlock';
import { say, STORY_PANELS } from '../game/narration';
import { btn } from './ui';

interface Props {
  onDone: (heroName: string) => void;
}

const PANELS = STORY_PANELS;

/** The opening: three painted panels with narration, then the hero picks a name. */
export function StoryIntro({ onDone }: Props) {
  const [i, setI] = useState(0);
  const [name, setName] = useState('');
  const naming = i === PANELS.length;
  const panel = PANELS[Math.min(i, PANELS.length - 1)];

  useEffect(() => {
    if (!naming) speech.interrupt(panel.text);
  }, [i, naming, panel.text]);

  const next = () => {
    unlockAudio();
    setI((n) => n + 1);
  };

  return (
    <div className="relative h-full overflow-hidden bg-black" onClick={naming ? undefined : next}>
      <AnimatePresence mode="popLayout">
        <motion.img
          key={panel.art}
          src={panel.art}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0, scale: 1.12 }}
          animate={{ opacity: naming ? 0.35 : 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 0.8 }, scale: { duration: 9, ease: 'linear' } }}
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/40" />

      <div className="safe-pad relative flex h-full flex-col">
        <div className="flex justify-between">
          <div className="flex gap-1.5 pt-1">
            {PANELS.map((_, n) => (
              <span key={n} className={`h-1.5 w-8 rounded-full ${n <= i ? 'bg-gold' : 'bg-white/25'}`} />
            ))}
          </div>
          {!naming && (
            <button
              className={btn.ghost}
              onClick={(e) => {
                e.stopPropagation();
                unlockAudio();
                speech.cancel();
                setI(PANELS.length);
              }}
            >
              Skip
            </button>
          )}
        </div>

        <div className="flex-1" />

        {naming ? (
          <motion.div className="space-y-5 pb-2" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <div className="text-center">
              <p className="font-display text-lg tracking-widest text-gold">THE HERO</p>
              <h1 className="mt-1 font-display text-4xl leading-tight text-white drop-shadow-lg">What should we call you?</h1>
              <p className="mt-2 text-ash">Any name works. The Mess King will get it wrong anyway.</p>
            </div>
            <input
              className="w-full rounded-2xl bg-black/50 px-5 py-4 text-center font-display text-3xl text-white ring-2 ring-white/15 outline-none placeholder:text-white/30 focus:ring-gold"
              placeholder="Hero"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <button
              className={btn.primary}
              onClick={() => {
                unlockAudio();
                const hero = name.trim() || 'Hero';
                speech.interrupt(say.welcome);
                onDone(hero);
              }}
            >
              TAKE UP THE BROOMBLADE
            </button>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              className="pb-6"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <p className="font-display text-3xl leading-snug text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">{panel.text}</p>
              <p className="mt-6 animate-pulse text-center text-sm font-semibold uppercase tracking-[0.25em] text-white/60">Tap to continue</p>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
