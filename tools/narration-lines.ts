// Dumps every sentence the narrator can say, with its clip key, for tools/narrate.py.
// Usage: npx tsx tools/narration-lines.ts > narration-lines.json
import { allLines, allSentences, clipKey } from '../src/game/narration';

const texts = [...new Set([...allLines(), ...allSentences()])];
const lines = texts.map((text) => ({ key: clipKey(text), text }));
if (new Set(lines.map((l) => l.key)).size !== lines.length) throw new Error('Clip key collision');
console.log(JSON.stringify(lines, null, 1));
