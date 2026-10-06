import { describe, expect, it } from 'vitest';
import { VOICE_TRIGGER } from '../audio/voice';
import { BUILT_IN_BOSSES } from './bosses';
import { ALL_LINE_TEMPLATES, lines } from './speechLines';

describe('speech lines', () => {
  it('never say a voice-hit trigger word', () => {
    const extra = [
      lines.combo(2),
      lines.combo(3),
      lines.combo(4),
      lines.comboBreak(),
      ...BUILT_IN_BOSSES.flatMap((b) => [1, 2, 3, 5, 10, 15].map((hp) => lines.progress(b, hp, 20) ?? '')),
      ...BUILT_IN_BOSSES.map((b) => lines.progress(b, 1, 20) ?? ''),
    ];
    for (const line of [...ALL_LINE_TEMPLATES, ...extra]) expect(line).not.toMatch(VOICE_TRIGGER);
  });

  it('calls out progress at every 5 items, halfway and 3 left', () => {
    const boss = BUILT_IN_BOSSES[1];
    expect(lines.progress(boss, 15, 20)).toBe('15 dishes left.');
    expect(lines.progress(boss, 10, 20)).toBe('Halfway. 10 dishes left.');
    expect(lines.progress(boss, 3, 20)).toMatch(/Three left\.$/);
    expect(lines.progress(boss, 17, 20)).toBeUndefined();
    expect(lines.progress(boss, 0, 20)).toBeUndefined();
  });
});
