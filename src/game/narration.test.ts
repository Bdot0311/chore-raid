import { describe, expect, it } from 'vitest';
import manifest from '../audio/voiceManifest.json';
import { allSentences, clipKey, sentences } from './narration';

describe('narration', () => {
  it('splits lines into sentences', () => {
    expect(sentences('Halfway. 6 items left.')).toEqual(['Halfway.', '6 items left.']);
    expect(sentences('Level up!  You are now level 3.')).toEqual(['Level up!', 'You are now level 3.']);
  });

  it('has a recording for every sentence (re-run tools/narrate.py after changing lines)', () => {
    const recorded = new Set(manifest);
    const missing = allSentences().filter((s) => !recorded.has(clipKey(s)));
    expect(missing).toEqual([]);
  });
});
