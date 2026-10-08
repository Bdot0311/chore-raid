import type { RegionId } from './types';
import { BUILT_IN_BOSSES } from './bosses';
import { CAMPAIGN_ENEMIES, enemy, LAIR_IDS, region, REGIONS } from './campaign';
import type { FreedMode } from './reclaim';
import { allBossLines, allBossSentences } from './speechLines';

/**
 * What the narrator says outside of fights. Spoken lines never include the
 * hero's name or other free text: every sentence here is recorded ahead of time
 * in a natural voice (tools/narrate.py), and a name would need the robotic
 * device voice. The name still shows on screen.
 */

export const STORY_PANELS = [
  {
    art: '/art/story-1.webp',
    text: 'Hear now a tale! One ordinary evening, the Mess King moved into your home. Nobody invited him. He brought all his messy baggage, and soon everything was a mess.',
  },
  {
    art: '/art/story-2.webp',
    text: 'But every home has a hero. In the hall closet, beneath three coats and a lost umbrella, a weapon lay waiting. For you.',
  },
  {
    art: '/art/world-map.webp',
    text: 'Seven lairs! Seven bosses! One very messy kingdom. Win them back, and the Mess King shall have nowhere left to sit.',
  },
];

export const MAX_SPOKEN_LEVEL = 50;

const TOWN: Record<RegionId, string> = {
  laundry: 'Onward, through the village, to the Laundry Lair! The villagers cheer. They are running low on clean socks.',
  dishes: 'Onward to the Sink Caverns! The villagers cheer. They have been eating off napkins for days.',
  clutter: 'Onward to the Clutter Keep! The villagers cheer, from a safe distance.',
  bathroom: 'Onward to the Grime Grotto! The villagers cheer. They have been washing in the duck pond.',
  bedroom: 'Onward to the Duvet Den! The villagers cheer, quietly. Something in there is asleep.',
  floors: 'Onward to the Dust Dunes! The villagers cheer, and then sneeze.',
  trash: 'Onward to the Rubbish Rift! The villagers cheer, and hold their noses.',
  throne: 'The road to the throne! The whole village has come out to watch. No pressure.',
};

/** "The Laundry Lair" in the middle of a sentence. */
const midSentence = (name: string) => name.replace(/^The /, 'the ');

/** A lair the minions have taken back: "The Sock Goblins are back in the Laundry Lair." */
export function backIn(regionId: RegionId) {
  const r = region(regionId);
  return `${enemy(r.minionId).name} are back in ${midSentence(r.name)}.`;
}

/** A lair the mess is creeping back into (on screen only). */
export function creepingInto(regionId: RegionId) {
  const r = region(regionId);
  return `${enemy(r.minionId).name} are creeping back into ${midSentence(r.name)}.`;
}

/** What the map says on each return: the King first, then lost lairs, then progress. */
export interface MapNews {
  cleared: number;
  /** The throne is open for the first time and the King not yet toppled. */
  throneOpen: boolean;
  /** The King has been toppled before and has climbed back on. */
  kingBack: boolean;
  /** Retaken lairs, the longest-lost first. */
  retaken: RegionId[];
}

export const say = {
  chooseHero: 'Now then. Who are you, hero? Choose your champion, and tell me your name.',
  welcome: 'Welcome, hero. Your quest begins in the Laundry Lair. Probably.',
  map: ({ cleared, throneOpen, kingBack, retaken }: MapNews) =>
    kingBack
      ? 'The Mess King is back on his throne. He did not even knock. The throne room stands open.'
      : throneOpen
        ? 'The throne room stands open! The Mess King awaits. He is pretending not to be nervous.'
        : retaken.length
          ? `Back at the map. ${backIn(retaken[0])} ${retaken.length > 1 ? 'They are not the only ones.' : 'Go and remind them.'}`
          : cleared === 0
            ? 'Behold, your kingdom! Seven lairs, held by the Mess King and his crew. Choose where to strike.'
            : 'Back at the map. The Mess King grows nervous. Choose your next lair.',
  town: (region: RegionId) => TOWN[region],
  step: (title: string, instruction: string) => `${title}. ${instruction}`,
  cycleDone: 'The machine is finished. Back to the quest.',
  levelCleared: 'Level cleared. Take a breath. Then the next one.',
  questCleared: (regionName: string) => `${regionName} is yours. Well done.`,
  levelUp: (level: number) => (level <= MAX_SPOKEN_LEVEL ? `Level up. You are now level ${level}.` : 'Level up.'),
};

/** The story beat after a region falls: spoken text is the on-screen text minus the name. */
export function freedLines(regionName: string, mode: FreedMode, remaining: number, hero: string) {
  const title = mode === 'ending' ? 'The home is yours' : `${regionName} is free`;
  const body = (name: string) => {
    switch (mode) {
      case 'ending':
        return `The Mess King packed one small bag and left. He will be back; he always is. But tonight, ${name}, every room is yours. Well played.`;
      case 'throne-first':
        return `All seven lairs have been freed. The Mess King has run out of places to hide. The throne room is open, ${name}.`;
      case 'throne-again':
        return `One lair back. But the Mess King is still sitting on his throne, ${name}. Somebody should move him.`;
      case 'remaining':
        return `One less lair for the Mess King. ${remaining} to go, ${name}. He is pretending not to notice.`;
      case 'reclaimed':
        return `Taken back. The mess will creep in again; it always does. But not today, ${name}.`;
    }
  };
  return { title, text: body(hero), spoken: `${title}. ${body('hero')}` };
}

const FREED_MODES: FreedMode[] = ['ending', 'throne-first', 'throne-again', 'remaining', 'reclaimed'];

/** Every map greeting, for the recordings. */
function allMapLines(): string[] {
  const base = { cleared: 1, throneOpen: false, kingBack: false, retaken: [] as RegionId[] };
  const out = [say.map({ ...base, cleared: 0 }), say.map(base), say.map({ ...base, throneOpen: true }), say.map({ ...base, kingBack: true })];
  for (const id of LAIR_IDS) {
    out.push(backIn(id));
    for (const more of [false, true]) out.push(say.map({ ...base, retaken: more ? [id, id] : [id] }));
  }
  return out;
}

/** Every freed beat for a region: the remaining count runs from all-but-one down to one. */
function allFreedLines(regionId: RegionId, regionName: string): string[] {
  const out: string[] = [];
  for (const mode of FREED_MODES.filter((m) => (m === 'ending') === (regionId === 'throne'))) {
    const counts = mode === 'remaining' ? Array.from({ length: LAIR_IDS.length - 1 }, (_, i) => i + 1) : [0];
    for (const rem of counts) out.push(freedLines(regionName, mode, rem, 'hero').spoken);
  }
  return out;
}

/** Splits narration into the sentences that are recorded one file each. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** A whole line, normalized: the key for its one-take recording. */
export const lineText = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * Every line the game says that has no numbers in it, recorded in one take so
 * it flows naturally. Lines with counts are stitched from sentence clips.
 */
export function allLines(): string[] {
  const texts: string[] = [...STORY_PANELS.map((p) => p.text), say.welcome, say.cycleDone, say.levelCleared, say.chooseHero];
  texts.push(...allMapLines(), ...Object.values(TOWN));
  for (const r of REGIONS) {
    texts.push(r.intro, say.questCleared(r.name));
    for (const boss of [false, true]) for (const st of r.steps(boss)) texts.push(say.step(st.title, st.instruction));
    texts.push(...allFreedLines(r.id, r.name));
  }
  texts.push(...allBossLines([...BUILT_IN_BOSSES, ...CAMPAIGN_ENEMIES]));
  return [...new Set(texts.map(lineText))];
}

/** Every sentence the game can say with the built-in content. */
export function allSentences(): string[] {
  const texts: string[] = [...STORY_PANELS.map((p) => p.text), say.welcome, say.cycleDone, say.levelCleared, 'Level up.', say.chooseHero];
  texts.push(...allMapLines(), ...Object.values(TOWN));
  for (let n = 2; n <= MAX_SPOKEN_LEVEL; n++) texts.push(say.levelUp(n));
  for (const r of REGIONS) {
    texts.push(r.intro, say.questCleared(r.name));
    for (const boss of [false, true]) for (const st of r.steps(boss)) texts.push(say.step(st.title, st.instruction));
    texts.push(...allFreedLines(r.id, r.name));
  }
  texts.push(...allBossSentences([...BUILT_IN_BOSSES, ...CAMPAIGN_ENEMIES]));
  return [...new Set(texts.flatMap(sentences))];
}

/** The file name a recorded sentence is stored under: FNV-1a of the sentence. */
export function clipKey(sentence: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < sentence.length; i++) {
    h ^= sentence.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
