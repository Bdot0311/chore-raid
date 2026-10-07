import type { BossDef, BossKind } from './types';
import { unitWord } from './bosses';

/**
 * Deadpan boss dialogue. None of these lines may contain the voice-hit trigger
 * words (hit, done, next, smash), or the game would hit itself. A test checks this.
 */

interface LineBank {
  start: string[];
  /** Said when the boss lashes out because you stalled. */
  attack: string[];
  windup: string[];
  beaten: string[];
  missed: string[];
  lowHp: string[];
  death: string[];
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

const BANKS: Record<BossKind, LineBank> = {
  laundry: {
    start: [
      'The Leviathan rises from the hamper. It is unimpressed.',
      'You have disturbed the Laundry Leviathan. It was napping on your chair.',
    ],
    attack: ['The Leviathan slaps you with a wet sleeve. Keep folding.', 'The Leviathan lunges. It smells faintly of fabric softener.'],
    windup: [
      'The Leviathan coils. {n} {units} in {s} seconds. Or it grows a fresh sock.',
      'The Leviathan is regrowing. Fold fast. {n} {units} in {s} seconds.',
    ],
    beaten: ['Critical. The Leviathan loses a sleeve. It pretends not to care.', 'Critical. A sock falls off. Nobody will ever find it.'],
    missed: ['The Leviathan restores its Ward. It found a matching sock. Smug.', 'Too slow. The Leviathan heals. It is now slightly more wrinkled.'],
    lowHp: ['The Leviathan is unravelling.', 'The Leviathan is down to its last few threads.'],
    death: ['The Laundry Leviathan is folded. It accepts this.', 'The Leviathan is defeated. The drawer is full. Peace returns.'],
  },
  dishes: {
    start: [
      'The Sink Hydra stirs beneath the suds. It has been waiting since Tuesday.',
      'The Sink Hydra awakens. Every fork is a tooth.',
    ],
    attack: ['The Hydra spits dishwater at you. Keep scrubbing.', 'A plate head snaps at you. Rude.'],
    windup: [
      'The Hydra regrows a head. {n} {units} in {s} seconds.',
      'The Hydra gathers grease. Scrub fast. {n} {units} in {s} seconds.',
    ],
    beaten: ['Critical. A head drops into the rack.', 'Critical. The Hydra loses a plate. It squeaks.'],
    missed: ['The Hydra regrows. A new head of crusted lasagna.', 'Too slow. The Hydra heals. It is mostly soup now.'],
    lowHp: ['The Hydra is running out of heads.', 'The Hydra is gurgling. That is not a good sign for it.'],
    death: ['The Sink Hydra drains away. The sink is empty. It is unsettling.', 'The Hydra is defeated. Every plate gleams.'],
  },
  clutter: {
    start: [
      'The Clutter Golem assembles itself. It is mostly cables.',
      'The Clutter Golem stands. It has been standing there for weeks. You just noticed.',
    ],
    attack: ['The Golem swings a mug at you. Keep tidying.', 'The Golem throws a cable. It is tangled. Of course it is.'],
    windup: [
      'The Golem gathers more junk. {n} {units} in {s} seconds.',
      'The Golem reinforces itself. Tidy fast. {n} {units} in {s} seconds.',
    ],
    beaten: ['Critical. A chunk falls off the Golem. It was a shoe.', 'Critical. The Golem loses an arm made of mail.'],
    missed: ['The Golem rebuilds. It found a box of old chargers.', 'Too slow. The Golem heals. It has acquired a lamp.'],
    lowHp: ['The Golem is wobbling.', 'The Golem is barely a pile anymore.'],
    death: ['The Clutter Golem collapses into nothing. Everything is where it lives.', 'The Golem is defeated. You can see the floor.'],
  },
  king: {
    start: [
      'The Mess King looks up from his throne. He does not stand. He never stands.',
      'The Mess King yawns. You have his attention. Barely.',
    ],
    attack: ['The Mess King flicks a crumb at you. It is a big crumb.', 'The Mess King points his plunger at you. Keep going.'],
    windup: ['The Mess King summons more mess. {n} {units} in {s} seconds.', 'The King rallies the clutter. {n} {units} in {s} seconds.'],
    beaten: ['Critical. The crown slips.', 'Critical. The King sits up straight for once.'],
    missed: ['The Mess King reclines. The mess grows back a little.', 'Too slow. The King looks pleased with himself.'],
    lowHp: ['The Mess King is losing his throne.', 'The King looks around for somewhere else to sit.'],
    death: ['The Mess King topples off his throne. Your home is yours again.', 'The Mess King is defeated. He leaves without saying goodbye. Typical.'],
  },
  custom: {
    start: ['A Mess Elemental appears. It is exactly as annoying as expected.', 'The Mess Elemental awakens. It has no opinion of you.'],
    attack: ['The Elemental lashes out. Keep going.', 'The mess pushes back. Push harder.'],
    windup: ['The Elemental swells. {n} {units} in {s} seconds.', 'The mess is spreading. {n} {units} in {s} seconds.'],
    beaten: ['Critical. The Elemental shrinks noticeably.', 'Critical. The mess loses ground.'],
    missed: ['The Elemental heals. The mess has opinions after all.', 'Too slow. The Elemental restores its Ward.'],
    lowHp: ['The Elemental is fading.', 'The mess is nearly gone.'],
    death: ['The Mess Elemental dissolves. Order is restored.', 'The Elemental is defeated. Quiet tidiness.'],
  },
};

function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/**
 * Counts above this are not pre-recorded, so lines that would say them fall
 * back to a version without the number.
 */
export const MAX_SPOKEN_COUNT = 60;

const count = (boss: BossDef, n: number) => `${n} ${unitWord(boss, n)}`;
/** Wind-up deadlines are spoken to the nearest five seconds. */
export const spokenSeconds = (seconds: number) => Math.max(5, Math.round(seconds / 5) * 5);

export const lines = {
  start: (boss: BossDef, maxHp: number) =>
    `${pick(BANKS[boss.kind].start)} ${maxHp <= MAX_SPOKEN_COUNT ? count(boss, maxHp) : `A great many ${boss.unitPlural}`} stand between you and victory.`,
  windup: (boss: BossDef, target: number, seconds: number) =>
    fill(pick(BANKS[boss.kind].windup), { n: target, units: unitWord(boss, target), s: spokenSeconds(seconds) }),
  beaten: (boss: BossDef) => pick(BANKS[boss.kind].beaten),
  attack: (boss: BossDef) => pick(BANKS[boss.kind].attack),
  missed: (boss: BossDef) => pick(BANKS[boss.kind].missed),
  death: (boss: BossDef) => pick(BANKS[boss.kind].death),
  combo: (multiplier: number) => ({ 2: 'Combo.', 3: 'Triple.', 4: 'Unstoppable.' })[multiplier] ?? '',
  comboBreak: () => 'Combo lost.',
  resumed: (boss: BossDef, hp: number) => (hp <= MAX_SPOKEN_COUNT ? `Raid resumed. ${count(boss, hp)} left.` : 'Raid resumed.'),

  /** What to say after a hit, if anything: every 5 items, at halfway, at 3 left. */
  progress(boss: BossDef, hp: number, maxHp: number): string | undefined {
    const doneCount = maxHp - hp;
    if (hp <= 0) return undefined;
    const left = hp <= MAX_SPOKEN_COUNT ? ` ${count(boss, hp)} left.` : '';
    if (hp === 3) return `${pick(BANKS[boss.kind].lowHp)} Three left.`;
    if (hp === 1) return `One ${boss.unit} left. Finish it.`;
    if (maxHp >= 6 && doneCount === Math.floor(maxHp / 2)) return `Halfway.${left}`;
    if (doneCount % 5 === 0 && left) return left.trim();
    return undefined;
  },
};

/** Exported for the test that keeps trigger words out of every line. */
export const ALL_LINE_TEMPLATES = Object.values(BANKS).flatMap((b) => Object.values(b).flat());

/**
 * Every sentence the boss lines can produce for the built-in bosses, so the
 * narrator's voice can be recorded ahead of time (tools/narrate.py).
 */
export function allBossSentences(bosses: BossDef[]): string[] {
  const out: string[] = [];
  for (const boss of bosses) {
    const bank = BANKS[boss.kind];
    out.push(...bank.start, ...bank.attack, ...bank.beaten, ...bank.missed, ...bank.lowHp, ...bank.death);
    for (const w of bank.windup) {
      for (let n = 1; n <= 3; n++) {
        for (let sec = 5; sec <= 60; sec += 5) out.push(fill(w, { n, units: unitWord(boss, n), s: sec }));
      }
    }
    for (let n = 1; n <= MAX_SPOKEN_COUNT; n++) {
      out.push(`${count(boss, n)} stand between you and victory.`, `${count(boss, n)} left.`);
    }
    out.push(`A great many ${boss.unitPlural} stand between you and victory.`, `One ${boss.unit} left. Finish it.`);
  }
  out.push('Combo.', 'Triple.', 'Unstoppable.', 'Combo lost.', 'Raid resumed.', 'Halfway.', 'Three left.');
  return out;
}
