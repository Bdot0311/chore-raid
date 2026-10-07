/**
 * The narrator. Every built-in line is pre-recorded in a natural voice
 * (tools/narrate.py) and played through Web Audio, sentence by sentence. Lines
 * with no recording (custom bosses) fall back to the device's speech voice.
 *
 * Progress lines go stale fast ("12 left" is wrong two hits later), so a new
 * one replaces any that hasn't been spoken yet instead of stacking up behind it.
 */

import { clipKey, sentences } from '../game/narration';
import { sfx } from './sfx';
import manifest from './voiceManifest.json';

export type LineKind = 'progress' | 'event';

interface Pending {
  text: string;
  kind: LineKind;
}

type Listener = (speaking: boolean) => void;

const RECORDED = new Set<string>(manifest);
/** A breath between recorded sentences. */
const GAP_S = 0.22;

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
    for (const s of sentences(text)) this.clip(clipKey(s));
  }

  private clip(key: string): Promise<AudioBuffer | undefined> {
    if (!RECORDED.has(key)) return Promise.resolve(undefined);
    let p = this.clips.get(key);
    if (!p) {
      p = fetch(`/voice/${key}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((data) => {
          const out = sfx.voiceOut();
          return out ? out.ctx.decodeAudioData(data) : undefined;
        })
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
    // The fallback voice: the most natural one the device has.
    this.voice =
      voices.find((v) => /natural|neural|premium|enhanced/i.test(v.name)) ??
      voices.find((v) => /google us english|samantha|ava|allison|aria|jenny/i.test(v.name)) ??
      voices.find((v) => /en-US/i.test(v.lang)) ??
      voices[0];
  }

  private async pump() {
    if (this.speaking) return;
    const next = this.queue.shift();
    if (!next) return;
    this.setSpeaking(true);
    const gen = this.generation;
    const parts = sentences(next.text);
    const keys = parts.map(clipKey);
    const recorded = sfx.voiceOut() && keys.every((k) => RECORDED.has(k));
    let ok = false;
    if (recorded) ok = await this.playClips(keys, gen);
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
