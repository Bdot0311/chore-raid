import type { BossDef, BossKind } from './types';
import { unitWord } from './bosses';

/**
 * Deadpan boss dialogue. None of these lines may contain the voice-hit trigger
 * words (hit, done, next, smash), or the game would hit itself. A test checks this.
 */

interface LineBank {
  start: string[];
  /** Said when the boss's blow lands on the hero. */
  attack: string[];
  /** Said when the boss starts charging a blow. */
  charge: string[];
  windup: string[];
  beaten: string[];
  missed: string[];
  lowHp: string[];
  death: string[];
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Lines for the enemy fighting back, shared by every minion. */
const MINION_CHARGE = ['A minion is winding up.', 'It raises its weapon.', 'Something growls. It is winding up.'];
const MINION_STRUCK = ['Ouch. That one got you.', 'You took a blow. Keep going.'];
const INTERRUPT = ['Interrupted. Nice.', 'You struck first.', 'Too slow for you.'];
const KNOCKDOWN = ['You are down. Get up. The chore is still here.', 'Knocked down. A Loot Star rolls away. Up you get.'];

const BANKS: Record<BossKind, LineBank> = {
  laundry: {
    start: [
      'The Laundry Lich rises from the hamper. It is unimpressed.',
      'You have disturbed the Laundry Lich. It was napping on your chair.',
    ],
    attack: ['The Lich flings a wet sock spell at you. Keep folding.', 'The Lich lunges. It smells faintly of fabric softener.'],
    charge: ['The Lich is gathering a spell.', 'The Lich raises its staff. It hums.'],
    windup: [
      'The Lich begins a spell. {n} {units} in {s} seconds. Or it summons a fresh sock.',
      'The Lich is casting. Fold fast. {n} {units} in {s} seconds.',
    ],
    beaten: ['Critical. The Lich loses its hat. It pretends not to care.', 'Critical. A sock falls off. Nobody will ever find it.'],
    missed: ['The Lich restores its Ward. It found a matching sock. Smug.', 'Too slow. The Lich heals. It is now slightly more wrinkled.'],
    lowHp: ['The Lich is unravelling.', 'The Lich is down to its last few threads.'],
    death: ['The Laundry Lich is folded. It accepts this.', 'The Lich is defeated. The drawer is full. Peace returns.'],
  },
  dishes: {
    start: [
      'The Sink Warlord climbs out of the suds. It has been waiting since Tuesday.',
      'The Sink Warlord raises its axe. It is mostly a fork.',
    ],
    attack: ['The Warlord splashes dishwater at you. Keep scrubbing.', 'The Warlord swings a soggy axe at you. Rude.'],
    charge: ['The Warlord raises its axe.', 'The Warlord is winding up a soggy swing.'],
    windup: [
      'The Warlord raises its shield. {n} {units} in {s} seconds.',
      'The Warlord gathers grease. Scrub fast. {n} {units} in {s} seconds.',
    ],
    beaten: ['Critical. The Warlord staggers into the dish rack.', 'Critical. The Warlord loses a plate. It squeaks.'],
    missed: ['The Warlord heals. A fresh coat of crusted lasagna.', 'Too slow. The Warlord heals. It is mostly soup now.'],
    lowHp: ['The Warlord is running out of armor.', 'The Warlord is gurgling. That is not a good sign for it.'],
    death: ['The Sink Warlord drains away. The sink is empty. It is unsettling.', 'The Warlord is defeated. Every plate gleams.'],
  },
  clutter: {
    start: [
      'The Clutter Colossus assembles itself. It is mostly cables.',
      'The Clutter Colossus stands. It has been standing there for weeks. You just noticed.',
    ],
    attack: ['The Colossus swings a mug at you. Keep tidying.', 'The Colossus throws a cable. It is tangled. Of course it is.'],
    charge: ['The Colossus is winding up.', 'The Colossus lifts its blade. Slowly. Menacingly.'],
    windup: [
      'The Colossus gathers more junk. {n} {units} in {s} seconds.',
      'The Colossus reinforces itself. Tidy fast. {n} {units} in {s} seconds.',
    ],
    beaten: ['Critical. A chunk falls off the Colossus. It was a shoe.', 'Critical. The Colossus loses an arm made of mail.'],
    missed: ['The Colossus rebuilds. It found a box of old chargers.', 'Too slow. The Colossus heals. It has acquired a lamp.'],
    lowHp: ['The Colossus is wobbling.', 'The Colossus is barely a pile anymore.'],
    death: ['The Clutter Colossus collapses into nothing. Everything is where it lives.', 'The Colossus is defeated. You can see the floor.'],
  },
  bathroom: {
    start: [
      'The Grime Kraken rises from the plughole. It was not expecting company.',
      'The Grime Kraken unfurls from behind the toilet. It has been there for some time.',
    ],
    attack: ['The Kraken flicks soap scum at you. Keep scrubbing.', 'A slimy tentacle slaps you. It smells of old shampoo.'],
    charge: ['The Kraken is coiling a tentacle.', 'The Kraken gurgles. Something is coming up the drain.'],
    windup: [
      'The Kraken spreads its grime. {n} {units} in {s} seconds.',
      'The Kraken is regrowing its mould. Scrub fast. {n} {units} in {s} seconds.',
    ],
    beaten: ['Critical. A tentacle comes off. It was mostly hair.', 'Critical. The Kraken loses its grip on the tiles.'],
    missed: ['The Kraken heals. A fresh ring forms round the bath.', 'Too slow. The Kraken heals. The grout is grey again.'],
    lowHp: ['The Kraken is sliding back down the drain.', 'The Kraken is barely a smear.'],
    death: ['The Grime Kraken goes down the plughole. It does not wave.', 'The Kraken is defeated. The taps sparkle. You can see yourself in them.'],
  },
  bedroom: {
    start: [
      'The Duvet Dragon stirs under the covers. It would like five more minutes.',
      'The Duvet Dragon opens one eye. It has been in bed since Sunday.',
    ],
    attack: ['The Dragon breathes warm, sleepy air at you. Stay awake.', 'The Dragon swats you with a pillow. It is a heavy pillow.'],
    charge: ['The Dragon is drawing breath.', 'The Dragon rolls over. It is winding up.'],
    windup: [
      'The Dragon pulls the covers back up. {n} {units} in {s} seconds.',
      'The Dragon is nesting. Tidy fast. {n} {units} in {s} seconds.',
    ],
    beaten: ['Critical. The Dragon loses a pillow. It sulks.', 'Critical. The duvet slips. The Dragon is cold and furious.'],
    missed: ['The Dragon heals. It found a jumper on the chair.', 'Too slow. The Dragon heals. It has had a little nap.'],
    lowHp: ['The Dragon is losing its nest.', 'The Dragon is down to one sock and a sheet.'],
    death: ['The Duvet Dragon is tucked in for good. The bed is made.', 'The Dragon is defeated. The room smells of fresh air.'],
  },
  floors: {
    start: [
      'The Dust Devil whirls out from under the sofa. It brought crumbs.',
      'The Dust Devil spins into view. It has been collecting hair. Not its own.',
    ],
    attack: ['The Dust Devil whips grit at you. Keep sweeping.', 'The Devil spins into your ankles. It is mostly crumbs.'],
    charge: ['The Dust Devil is spinning faster.', 'The Devil gathers a cloud of grit.'],
    windup: [
      'The Dust Devil kicks up a storm. {n} {units} in {s} seconds.',
      'The Devil drags in more dirt. Sweep fast. {n} {units} in {s} seconds.',
    ],
    beaten: ['Critical. The Devil loses a raisin. It was saving that.', 'Critical. The Dust Devil wobbles like a dropped top.'],
    missed: ['The Devil heals. Somebody walked in with their shoes on.', 'Too slow. The Devil heals. It found the cereal.'],
    lowHp: ['The Dust Devil is running out of spin.', 'The Devil is barely a breeze.'],
    death: ['The Dust Devil settles. Into the vacuum. Forever.', 'The Devil is defeated. The floor is clean enough to eat off. Please do not.'],
  },
  trash: {
    start: [
      'The Bin Troll heaves itself out of the bin. The lid was never going to shut.',
      'The Bin Troll looks up from a pizza box. It is not sharing.',
    ],
    attack: ['The Troll lobs a banana peel at you. Keep sorting.', 'The Troll swings a bin bag. It leaks. Of course it leaks.'],
    charge: ['The Troll is winding up.', 'The Troll raises its bin lid.'],
    windup: [
      'The Troll stuffs the bin fuller. {n} {units} in {s} seconds.',
      'The Troll calls for more rubbish. Sort fast. {n} {units} in {s} seconds.',
    ],
    beaten: ['Critical. The Troll loses its lid.', 'Critical. A yoghurt pot falls off the Troll. Rinsed, at last.'],
    missed: ['The Troll heals. It found a takeaway box under the sofa.', 'Too slow. The Troll heals. The bin smells worse now.'],
    lowHp: ['The Bin Troll is running out of rubbish.', 'The Troll is barely a carrier bag.'],
    death: ['The Bin Troll is taken out. On collection day, no less.', 'The Troll is defeated. The bin has a fresh bag. Bliss.'],
  },
  king: {
    start: [
      'The Mess King looks up from his throne. He sighs. He stands. He hates standing.',
      'The Mess King yawns. You have his attention. Barely.',
    ],
    attack: ['The Mess King flicks a crumb at you. It is a big crumb.', 'The Mess King points his plunger at you. Keep going.'],
    charge: ['The Mess King raises his staff. He sighs first.', 'The Mess King is gathering mess for a blow.'],
    windup: ['The Mess King summons more mess. {n} {units} in {s} seconds.', 'The King rallies the clutter. {n} {units} in {s} seconds.'],
    beaten: ['Critical. The crown slips.', 'Critical. The King sits up straight for once.'],
    missed: ['The Mess King reclines. The mess grows back a little.', 'Too slow. The King looks pleased with himself.'],
    lowHp: ['The Mess King is losing his throne.', 'The King looks around for somewhere else to sit.'],
    death: ['The Mess King topples off his throne. Your home is yours again.', 'The Mess King is defeated. He leaves without saying goodbye. Typical.'],
  },
  custom: {
    start: ['A Mess Elemental appears. It is exactly as annoying as expected.', 'The Mess Elemental awakens. It has no opinion of you.'],
    attack: ['The Elemental lashes out. Keep going.', 'The mess pushes back. Push harder.'],
    charge: ['The Elemental is winding up.', 'The mess is gathering itself for a blow.'],
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
export const MAX_SPOKEN_COUNT = 20;

const count = (boss: BossDef, n: number) => `${n} ${unitWord(boss, n)}`;
const standing = (boss: BossDef, n: number) =>
  n === 1 ? `One ${boss.unit} stands between you and victory.` : `${count(boss, n)} stand between you and victory.`;
/** Wind-up deadlines are spoken to the nearest five seconds. */
export const spokenSeconds = (seconds: number) => Math.max(5, Math.round(seconds / 5) * 5);

export const lines = {
  start: (boss: BossDef, maxHp: number) =>
    `${pick(BANKS[boss.kind].start)} ${maxHp <= MAX_SPOKEN_COUNT ? standing(boss, maxHp) : `A great many ${boss.unitPlural} stand between you and victory.`}`,
  windup: (boss: BossDef, target: number, seconds: number) =>
    fill(pick(BANKS[boss.kind].windup), { n: target, units: unitWord(boss, target), s: spokenSeconds(seconds) }),
  beaten: (boss: BossDef) => pick(BANKS[boss.kind].beaten),
  attack: (boss: BossDef) => pick(BANKS[boss.kind].attack),
  /** The enemy starts charging: flavor, then what to do about it. */
  charge: (boss: BossDef, minion: boolean, task: boolean) =>
    `${minion ? pick(MINION_CHARGE) : pick(BANKS[boss.kind].charge)} ${task ? 'Finish this step to strike first.' : 'Finish an item to strike first.'}`,
  interrupt: () => pick(INTERRUPT),
  knockdown: () => pick(KNOCKDOWN),
  struckMinion: () => pick(MINION_STRUCK),
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
export const ALL_LINE_TEMPLATES = [
  ...Object.values(BANKS).flatMap((b) => Object.values(b).flat()),
  ...MINION_CHARGE,
  ...MINION_STRUCK,
  ...INTERRUPT,
  ...KNOCKDOWN,
];

/** Whole boss lines without numbers in them (recorded in one take). */
export function allBossLines(bosses: BossDef[]): string[] {
  const out: string[] = [];
  for (const boss of bosses) {
    const b = BANKS[boss.kind];
    out.push(...b.start, ...b.attack, ...b.beaten, ...b.missed, ...b.lowHp, ...b.death);
    for (const task of [false, true]) {
      const tail = task ? 'Finish this step to strike first.' : 'Finish an item to strike first.';
      for (const c of [...b.charge, ...MINION_CHARGE]) out.push(`${c} ${tail}`);
    }
  }
  out.push(...MINION_STRUCK, ...INTERRUPT, ...KNOCKDOWN);
  return out;
}

/**
 * Every sentence the boss lines can produce for the built-in bosses, so the
 * narrator's voice can be recorded ahead of time (tools/narrate.py).
 */
export function allBossSentences(bosses: BossDef[]): string[] {
  const out: string[] = [];
  for (const boss of bosses) {
    const bank = BANKS[boss.kind];
    out.push(...bank.start, ...bank.attack, ...bank.charge, ...bank.beaten, ...bank.missed, ...bank.lowHp, ...bank.death);
    for (const w of bank.windup) {
      for (let n = 1; n <= 3; n++) {
        for (let sec = 5; sec <= 60; sec += 5) out.push(fill(w, { n, units: unitWord(boss, n), s: sec }));
      }
    }
    for (let n = 1; n <= MAX_SPOKEN_COUNT; n++) {
      out.push(standing(boss, n), `${count(boss, n)} left.`);
    }
    out.push(`A great many ${boss.unitPlural} stand between you and victory.`, `One ${boss.unit} left. Finish it.`);
  }
  out.push('Combo.', 'Triple.', 'Unstoppable.', 'Combo lost.', 'Raid resumed.', 'Halfway.', 'Three left.');
  out.push(...MINION_CHARGE, ...MINION_STRUCK, ...INTERRUPT, ...KNOCKDOWN, 'Finish this step to strike first.', 'Finish an item to strike first.');
  return out;
}
