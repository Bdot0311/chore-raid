/**
 * A text-to-speech queue for progress callouts. Progress lines go stale fast
 * ("12 left" is wrong two hits later), so a new one replaces any that hasn't
 * been spoken yet instead of stacking up behind it.
 */

export type LineKind = 'progress' | 'event';

interface Pending {
  text: string;
  kind: LineKind;
}

type Listener = (speaking: boolean) => void;

class Speech {
  private queue: Pending[] = [];
  private speaking = false;
  private enabled = true;
  private voice?: SpeechSynthesisVoice;
  private listeners = new Set<Listener>();

  get supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /** Must run inside a user gesture on iOS, or later speech stays silent. */
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
    if (!this.supported || !this.enabled) return;
    if (kind === 'progress') this.queue = this.queue.filter((p) => p.kind !== 'progress');
    this.queue.push({ text, kind });
    this.pump();
  }

  /** Clears everything: used when a bigger moment (death) needs the floor. */
  interrupt(text: string) {
    this.cancel();
    this.say(text);
  }

  cancel() {
    this.queue = [];
    if (this.supported) speechSynthesis.cancel();
    this.setSpeaking(false);
  }

  private pickVoice() {
    const voices = speechSynthesis.getVoices();
    // A lower, flatter voice suits the deadpan tone; fall back to any English voice.
    this.voice =
      voices.find((v) => /en-GB/i.test(v.lang) && /male|daniel|arthur/i.test(v.name)) ??
      voices.find((v) => /en-GB/i.test(v.lang)) ??
      voices.find((v) => /^en/i.test(v.lang));
  }

  private pump() {
    if (this.speaking) return;
    const next = this.queue.shift();
    if (!next) return;
    const u = new SpeechSynthesisUtterance(next.text);
    if (this.voice) u.voice = this.voice;
    u.rate = 1.0;
    u.pitch = 0.8;
    const done = () => {
      this.setSpeaking(false);
      this.pump();
    };
    u.onend = done;
    u.onerror = done;
    this.setSpeaking(true);
    speechSynthesis.speak(u);
  }

  private setSpeaking(on: boolean) {
    if (this.speaking === on) return;
    this.speaking = on;
    for (const fn of this.listeners) fn(on);
  }
}

export const speech = new Speech();
