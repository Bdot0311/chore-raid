/**
 * The narrator. Every built-in line is pre-recorded in a natural voice
 * (tools/narrate.py) and played through Web Audio, sentence by sentence. Lines
 * with no recording (custom bosses) fall back to the device's speech voice.
 *
 * Progress lines go stale fast ("12 left" is wrong two hits later), so a new
 * one replaces any that hasn't been spoken yet instead of stacking up behind it.
 */

import { clipKey, lineText, sentences } from '../game/narration';
import { sfx } from './sfx';
import manifest from './voiceManifest.json';

export type LineKind = 'progress' | 'event';

interface Pending {
  text: string;
  kind: LineKind;
}

type Listener = (speaking: boolean) => void;

const RECORDED = new Set<string>(manifest);

/**
 * The clips for a line: the longest runs of sentences that were recorded in one
 * take, so a boss line stays whole even when a count is stitched on after it.
 */
function segmentKeys(text: string): string[] {
  const s = sentences(text);
  const keys: string[] = [];
  let i = 0;
  while (i < s.length) {
    let j = s.length;
    while (j > i + 1 && !RECORDED.has(clipKey(lineText(s.slice(i, j).join(' '))))) j--;
    keys.push(clipKey(lineText(s.slice(i, j).join(' '))));
    i = j;
  }
  return keys;
}

/**
 * Clips are decoded offline, so they can load before the first tap unlocks
 * audio. A decoded buffer plays on any context.
 */
let decoder: BaseAudioContext | undefined;
function decodeContext(): BaseAudioContext | undefined {
  if (!decoder && typeof OfflineAudioContext !== 'undefined') decoder = new OfflineAudioContext(1, 1, 24000);
  return decoder;
}
/** A breath between stitched sentence clips. */
const GAP_S = 0.12;

class Speech {
  private queue: Pending[] = [];
  private speaking = false;
  private enabled = true;
  private voice?: SpeechSynthesisVoice;
  private listeners = new Set<Listener>();
  private clips = new Map<string, Promise<AudioBuffer | undefined>>();
  private source?: AudioBufferSourceNode;
  /** Bumped on cancel, so a sequence in flight knows to stop. */
  private generation = 0;

  get supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /** Must run inside a user gesture on iOS, or later device speech stays silent. */
  prime() {
    if (!this.supported) return;
    this.pickVoice();
    speechSynthesis.onvoiceschanged = () => this.pickVoice();
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    speechSynthesis.speak(u);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.cancel();
  }

  onSpeaking(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  say(text: string, kind: LineKind = 'event') {
    if (!this.enabled || !text) return;
    if (kind === 'progress') this.queue = this.queue.filter((p) => p.kind !== 'progress');
    this.queue.push({ text, kind });
    this.preload(text);
    void this.pump();
  }

  /** Clears everything: used when a bigger moment (death) needs the floor. */
  interrupt(text: string) {
    this.cancel();
    this.say(text);
  }

  cancel() {
    this.queue = [];
    this.generation++;
    try {
      this.source?.stop();
    } catch {
      // Already stopped.
    }
    this.source = undefined;
    if (this.supported) speechSynthesis.cancel();
    this.setSpeaking(false);
  }

  /** Starts fetching a line's recordings so it plays without a pause. */
  preload(text: string) {
    for (const k of segmentKeys(text)) this.clip(k);
  }

  private clip(key: string): Promise<AudioBuffer | undefined> {
    if (!RECORDED.has(key)) return Promise.resolve(undefined);
    let p = this.clips.get(key);
    if (!p) {
      p = fetch(`/voice/${key}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((data) => decodeContext()?.decodeAudioData(data))
        .catch(() => undefined);
      // A failed fetch (offline, not unlocked yet) can be retried next time.
      p.then((b) => {
        if (!b) this.clips.delete(key);
      });
      this.clips.set(key, p);
    }
    return p;
  }

  private pickVoice() {
    const voices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
    // The fallback voice: a British storyteller if the device has one.
    const gb = voices.filter((v) => /en-GB/i.test(v.lang));
    this.voice =
      gb.find((v) => /natural|neural|premium|enhanced/i.test(v.name)) ??
      gb.find((v) => /daniel|arthur|george|ryan|male/i.test(v.name)) ??
      gb[0] ??
      voices.find((v) => /natural|neural|premium|enhanced/i.test(v.name)) ??
      voices[0];
  }

  private async pump() {
    if (this.speaking) return;
    const next = this.queue.shift();
    if (!next) return;
    this.setSpeaking(true);
    const gen = this.generation;
    const keys = segmentKeys(next.text);
    let ok = false;
    if (keys.every((k) => RECORDED.has(k)) && (await sfx.voiceReady()) && gen === this.generation) ok = await this.playClips(keys, gen);
    if (gen !== this.generation) return;
    if (!ok) await this.speakDevice(next.text, gen);
    if (gen !== this.generation) return;
    this.setSpeaking(false);
    void this.pump();
  }

  private async playClips(keys: string[], gen: number): Promise<boolean> {
    const buffers = await Promise.all(keys.map((k) => this.clip(k)));
    if (gen !== this.generation) return true;
    if (buffers.some((b) => !b)) return false;
    for (const buffer of buffers) {
      const out = sfx.voiceOut();
      if (!out || gen !== this.generation) return true;
      await new Promise<void>((resolve) => {
        const src = out.ctx.createBufferSource();
        src.buffer = buffer!;
        src.connect(out.out);
        src.onended = () => resolve();
        this.source = src;
        src.start();
      });
      if (gen !== this.generation) return true;
      await new Promise((r) => window.setTimeout(r, GAP_S * 1000));
    }
    return true;
  }

  private speakDevice(text: string, gen: number): Promise<void> {
    if (!this.supported) return Promise.resolve();
    return new Promise((resolve) => {
      if (gen !== this.generation) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.rate = 1;
      u.pitch = 1;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
  }

  private setSpeaking(on: boolean) {
    if (this.speaking === on) return;
    this.speaking = on;
    for (const fn of this.listeners) fn(on);
  }
}

export const speech = new Speech();
