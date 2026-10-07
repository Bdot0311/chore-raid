import type { RegionId } from './types';
import { BUILT_IN_BOSSES } from './bosses';
import { CAMPAIGN_ENEMIES, REGIONS } from './campaign';
import { allBossSentences } from './speechLines';

/**
 * What the narrator says outside of fights. Spoken lines never include the
 * hero's name or other free text: every sentence here is recorded ahead of time
 * in a natural voice (tools/narrate.py), and a name would need the robotic
 * device voice. The name still shows on screen.
 */

export const STORY_PANELS = [
  {
    art: '/art/story-1.webp',
    text: 'Hear now a tale! One ordinary evening, the Mess King moved into your home. Nobody invited him. He brought laundry.',
  },
  {
    art: '/art/story-2.webp',
    text: 'But every home has a hero. In the hall closet, beneath three coats and a lost umbrella, a weapon lay waiting. For you.',
  },
  {
    art: '/art/world-map.webp',
    text: 'Three lairs! Three bosses! One very messy kingdom. Win them back, and the Mess King shall have nowhere left to sit.',
  },
];

export const MAX_SPOKEN_LEVEL = 50;

const TOWN: Record<RegionId, string> = {
  laundry: 'Onward, through the village, to the Laundry Lair! The villagers cheer. They are running low on clean socks.',
  dishes: 'Onward to the Sink Caverns! The villagers cheer. They have been eating off napkins for days.',
  clutter: 'Onward to the Clutter Keep! The villagers cheer, from a safe distance.',
  throne: 'The road to the throne! The whole village has come out to watch. No pressure.',
};

export const say = {
  chooseHero: 'Now then. Who are you, hero? Choose your champion, and tell me your name.',
  welcome: 'Welcome, hero. Your quest begins in the Laundry Lair. Probably.',
  map: (cleared: number, throneOpen: boolean) =>
    throneOpen
      ? 'The throne room stands open! The Mess King awaits. He is pretending not to be nervous.'
      : cleared === 0
        ? 'Behold, your kingdom! Three lairs, held by the Mess King and his crew. Choose where to strike.'
        : 'Back at the map. The Mess King grows nervous. Choose your next lair.',
  town: (region: RegionId) => TOWN[region],
  step: (title: string, instruction: string) => `${title}. ${instruction}`,
  cycleDone: 'The machine is finished. Back to the quest.',
  levelCleared: 'Level cleared. Take a breath. Then the next one.',
  questCleared: (regionName: string) => `${regionName} is yours. Well done.`,
  levelUp: (level: number) => (level <= MAX_SPOKEN_LEVEL ? `Level up. You are now level ${level}.` : 'Level up.'),
};

/** The story beat after a region falls: spoken text is the on-screen text minus the name. */
export function freedLines(regionName: string, ending: boolean, throneNext: boolean, remaining: number, hero: string) {
  const title = ending ? 'The home is yours' : `${regionName} is free`;
  const body = (name: string) =>
    ending
      ? `The Mess King packed one small bag and left. He will be back; he always is. But tonight, ${name}, every room is yours. Well played.`
      : throneNext
        ? `All three lairs are free. The Mess King has run out of places to hide. The throne room is open, ${name}.`
        : `One less lair for the Mess King. ${remaining} to go, ${name}. He is pretending not to notice.`;
  return { title, text: body(hero), spoken: `${title}. ${body('hero')}` };
}

/** Splits narration into the sentences that are recorded one file each. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Every sentence the game can say with the built-in content. */
export function allSentences(): string[] {
  const texts: string[] = [...STORY_PANELS.map((p) => p.text), say.welcome, say.cycleDone, say.levelCleared, 'Level up.', say.chooseHero];
  texts.push(say.map(0, false), say.map(1, false), say.map(3, true), ...Object.values(TOWN));
  for (let n = 2; n <= MAX_SPOKEN_LEVEL; n++) texts.push(say.levelUp(n));
  for (const r of REGIONS) {
    texts.push(r.intro, say.questCleared(r.name));
    for (const boss of [false, true]) for (const st of r.steps(boss)) texts.push(say.step(st.title, st.instruction));
    for (const ending of [false, true]) {
      for (const throneNext of [false, true]) for (const rem of [1, 2]) texts.push(freedLines(r.name, ending, throneNext, rem, 'hero').spoken);
    }
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
