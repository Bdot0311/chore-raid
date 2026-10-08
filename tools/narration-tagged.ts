// Every narrator line with an ElevenLabs v4 delivery tag, for tools/narrate_elevenlabs.py.
//   npx tsx tools/narration-tagged.ts > /tmp/tagged.json
import { BUILT_IN_BOSSES } from '../src/game/bosses';
import { CAMPAIGN_ENEMIES, REGIONS } from '../src/game/campaign';
import { allLines, allSentences, clipKey, lineText, say, STORY_PANELS } from '../src/game/narration';

const lines = allLines();
const sentences = [...new Set(allSentences())].filter((s) => !lines.includes(s));
const stepTexts = new Set(REGIONS.flatMap((r) => [false, true].flatMap((b) => r.steps(b).map((st) => lineText(say.step(st.title, st.instruction))))));
const story = new Set([...STORY_PANELS.map((p) => p.text), say.welcome, say.chooseHero].map(lineText));
void BUILT_IN_BOSSES;
void CAMPAIGN_ENEMIES;

function tag(text: string): string {
  if (story.has(text)) return '[dramatically]';
  if (stepTexts.has(text)) return '[warmly]';
  if (/strike first\.$/.test(text)) return '[urgently]';
  if (/^(Interrupted|You struck first|Too slow for you)/.test(text)) return '[excited]';
  if (/(knocked down|You are down)/i.test(text)) return '[dramatically]';
  if (/(Onward|The road to the throne|Behold|Back at the map|throne room stands open|is free\.|is yours|The home is yours|Level cleared|machine is finished)/.test(text)) return '[dramatically]';
  if (/^\d+ \w+ (left|stand)|^(Halfway|Three left|One \w+ left|Combo|Triple|Unstoppable|Raid resumed|A great many|Level up|You are now level)/.test(text)) return '[confidently]';
  return '[dryly]';
}

const speakable = (t: string) => t.replace(/\b[A-Z]{2,}\b/g, (m) => m[0] + m.slice(1).toLowerCase()).replace(/:/g, ',');
const out = [...lines.map((t) => ({ main: true, t })), ...sentences.map((t) => ({ main: false, t }))].map(({ main, t }) => ({
  key: clipKey(lineText(t)),
  main,
  text: `${tag(lineText(t))} ${speakable(t)}`,
}));
console.log(JSON.stringify(out, null, 1));
