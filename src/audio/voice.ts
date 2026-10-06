/**
 * Hands-free hits: say "hit", "done", "next" or "smash". Chrome on Android is
 * solid; iOS Safari is flaky, so this is optional and the tap path never depends on it.
 */

export const VOICE_TRIGGER = /\b(hit|done|next|smash)\b/i;

interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

type RecognitionCtor = new () => RecognitionLike;

function ctor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const voiceSupported = () => typeof window !== 'undefined' && !!ctor();

export class VoiceHits {
  private rec?: RecognitionLike;
  private running = false;
  private paused = false;
  /** How many trigger words each result has already fired, so interim repeats don't double count. */
  private fired = new Map<number, number>();

  private onTrigger: () => void;
  private onState: (state: 'listening' | 'paused' | 'off' | 'denied') => void;

  constructor(onTrigger: () => void, onState: (state: 'listening' | 'paused' | 'off' | 'denied') => void) {
    this.onTrigger = onTrigger;
    this.onState = onState;
  }

  start() {
    const Ctor = ctor();
    if (!Ctor || this.running) return;
    this.running = true;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const words = e.results[i][0].transcript.match(new RegExp(VOICE_TRIGGER, 'gi'))?.length ?? 0;
        const already = this.fired.get(i) ?? 0;
        for (let n = already; n < words; n++) this.onTrigger();
        this.fired.set(i, Math.max(already, words));
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.running = false;
        this.onState('denied');
      }
    };
    // Recognition stops itself after silence; keep it alive for the whole raid.
    rec.onend = () => {
      this.fired.clear();
      if (this.running && !this.paused) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };
    this.rec = rec;
    this.listen();
  }

  /** Pause while the game talks, so it can't hear its own voice. */
  setPaused(paused: boolean) {
    if (!this.running || paused === this.paused) return;
    this.paused = paused;
    if (paused) {
      this.rec?.abort();
      this.onState('paused');
    } else {
      this.listen();
    }
  }

  stop() {
    this.running = false;
    this.rec?.abort();
    this.rec = undefined;
    this.onState('off');
  }

  private listen() {
    try {
      this.rec?.start();
      this.onState('listening');
    } catch {
      /* already started */
    }
  }
}
