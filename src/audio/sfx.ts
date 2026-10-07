/**
 * Every sound in the game, synthesized with Web Audio: no asset files, no licenses.
 * iOS only lets audio start inside a user gesture, so `unlock()` is called from "Begin raid".
 */

type Wave = OscillatorType;

class Sfx {
  private ctx?: AudioContext;
  private master?: GainNode;
  private bus?: GainNode;
  private noise?: AudioBuffer;
  private volume = 0.8;
  private muted = false;
  private ducked = false;
  private voiceGain?: GainNode;

  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      // A gentle compressor keeps stacked hits loud without clipping.
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.bus = this.ctx.createGain();
      this.bus.connect(comp).connect(this.master).connect(this.ctx.destination);
      this.applyGain();
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  setVolume(volume: number, muted: boolean) {
    this.volume = volume;
    this.muted = muted;
    this.applyGain();
  }

  /** Lowers the effects while the game is speaking so the words stay clear. */
  duck(on: boolean) {
    this.ducked = on;
    this.applyGain();
  }

  /**
   * Waits (briefly) for audio to be running: right after the first tap the
   * context is still resuming, and the narrator should wait, not fall back.
   */
  async voiceReady(timeoutMs = 1500): Promise<{ ctx: AudioContext; out: GainNode } | undefined> {
    if (!this.ctx) return undefined;
    if (this.ctx.state !== 'running') {
      await Promise.race([this.ctx.resume().catch(() => undefined), new Promise((r) => window.setTimeout(r, timeoutMs))]);
    }
    return this.voiceOut();
  }

  /** The narrator's output: follows the volume setting but is never ducked. */
  voiceOut(): { ctx: AudioContext; out: GainNode } | undefined {
    if (!this.ctx || this.ctx.state !== 'running') return undefined;
    if (!this.voiceGain) {
      this.voiceGain = this.ctx.createGain();
      this.voiceGain.connect(this.ctx.destination);
      this.applyGain();
    }
    return { ctx: this.ctx, out: this.voiceGain };
  }

  private applyGain() {
    if (!this.master || !this.ctx) return;
    const v = this.muted ? 0 : this.volume * (this.ducked ? 0.35 : 1);
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    this.voiceGain?.gain.setTargetAtTime(this.muted ? 0 : Math.min(1, this.volume * 1.2), this.ctx.currentTime, 0.05);
  }

  private get ready() {
    return this.ctx && this.bus && this.noise && !this.muted && this.ctx.state === 'running';
  }

  private tone(freq: number, start: number, dur: number, opts: { wave?: Wave; gain?: number; to?: number; attack?: number } = {}) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.wave ?? 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, start + dur);
    const peak = opts.gain ?? 0.3;
    const attack = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(this.bus!);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  private burst(start: number, dur: number, opts: { freq?: number; q?: number; gain?: number; type?: BiquadFilterType; to?: number } = {}) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise!;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type ?? 'bandpass';
    filter.frequency.setValueAtTime(opts.freq ?? 1800, start);
    if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, start + dur);
    filter.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain ?? 0.4, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(g).connect(this.bus!);
    src.start(start, Math.random() * 0.5);
    src.stop(start + dur + 0.05);
  }

  private get now() {
    return this.ctx!.currentTime;
  }

  /** The pitch climbs a semitone per hit in the streak, capped, so a combo audibly builds. */
  hit(streak: number) {
    if (!this.ready) return;
    const t = this.now;
    const semis = Math.min(streak, 14);
    const f = 90 * 2 ** (semis / 12);
    this.tone(f * 2, t, 0.18, { wave: 'triangle', gain: 0.5, to: f * 0.7 });
    this.tone(f * 0.5, t, 0.22, { wave: 'sine', gain: 0.6, to: 40 });
    this.burst(t, 0.12, { freq: 2400 + semis * 120, q: 0.8, gain: 0.35 });
  }

  /** A blade whoosh: band-passed noise swept fast, a little different per move. */
  swing(heavy: boolean) {
    if (!this.ready) return;
    const t = this.now;
    this.burst(t, heavy ? 0.22 : 0.14, { freq: heavy ? 600 : 1200, to: heavy ? 2400 : 4200, q: 2.5, gain: 0.32 });
  }

  /** The boss's blow: a low growl and a heavy thud. */
  bossAttack(big: boolean) {
    if (!this.ready) return;
    const t = this.now;
    this.tone(big ? 70 : 95, t, 0.5, { wave: 'sawtooth', gain: 0.22, to: big ? 40 : 55, attack: 0.05 });
    this.burst(t, 0.35, { type: 'lowpass', freq: 900, to: 120, gain: 0.5 });
    this.tone(48, t + 0.05, 0.3, { gain: 0.7, to: 30 });
  }

  /** Footfalls: a heavy boss stomp, or a minion's little boing. */
  stomp(strength: number, light: boolean) {
    if (!this.ready) return;
    const t = this.now;
    if (light) {
      this.tone(220, t, 0.12, { wave: 'sine', gain: 0.12 + strength * 0.15, to: 520 });
      this.burst(t, 0.05, { type: 'lowpass', freq: 600, gain: 0.12 });
      return;
    }
    this.tone(55, t, 0.25, { gain: 0.35 + strength * 0.4, to: 32 });
    this.burst(t, 0.18, { type: 'lowpass', freq: 500, to: 90, gain: 0.25 + strength * 0.3 });
  }

  /** Steel on steel: a parried swing. */
  clang() {
    if (!this.ready) return;
    const t = this.now;
    this.tone(1250, t, 0.25, { wave: 'triangle', gain: 0.12, to: 1150 });
    this.tone(1870, t, 0.18, { wave: 'sine', gain: 0.07 });
    this.burst(t, 0.08, { freq: 4200, q: 3, gain: 0.18 });
  }

  /** A boss's roar: two detuned growls swelling and falling. */
  roar() {
    if (!this.ready) return;
    const t = this.now;
    this.tone(85, t, 0.8, { wave: 'sawtooth', gain: 0.18, to: 55, attack: 0.15 });
    this.tone(91, t, 0.8, { wave: 'sawtooth', gain: 0.14, to: 50, attack: 0.18 });
    this.burst(t, 0.7, { type: 'bandpass', freq: 400, to: 180, q: 1.5, gain: 0.25 });
  }

  lightning() {
    if (!this.ready) return;
    const t = this.now;
    this.burst(t, 0.5, { type: 'highpass', freq: 2500, gain: 0.45 });
    this.burst(t + 0.03, 0.9, { type: 'lowpass', freq: 400, to: 60, gain: 0.55 });
  }

  comboUp(multiplier: number) {
    if (!this.ready) return;
    const t = this.now + 0.05;
    const root = 330 * 2 ** ((multiplier - 2) * 2 / 12);
    [1, 1.26, 1.5, 2].forEach((r, i) => this.tone(root * r, t + i * 0.07, 0.25, { wave: 'square', gain: 0.12 }));
  }

  comboBreak() {
    if (!this.ready) return;
    this.tone(300, this.now, 0.35, { wave: 'sawtooth', gain: 0.08, to: 120 });
  }

  undo() {
    if (!this.ready) return;
    const t = this.now;
    this.tone(500, t, 0.12, { wave: 'triangle', gain: 0.15, to: 250 });
  }

  windupStart() {
    if (!this.ready) return;
    const t = this.now;
    this.tone(45, t, 1.6, { wave: 'sawtooth', gain: 0.25, to: 95, attack: 0.4 });
    this.tone(67, t, 1.6, { wave: 'sawtooth', gain: 0.15, to: 142, attack: 0.4 });
    this.burst(t, 1.4, { type: 'lowpass', freq: 200, to: 1600, gain: 0.25 });
  }

  tick(urgent: boolean) {
    if (!this.ready) return;
    this.tone(urgent ? 1400 : 900, this.now, 0.05, { wave: 'square', gain: urgent ? 0.18 : 0.08 });
  }

  windupBeaten() {
    if (!this.ready) return;
    const t = this.now;
    [110, 165, 220, 330].forEach((f) => this.tone(f, t, 1.1, { wave: 'sawtooth', gain: 0.12, attack: 0.01 }));
    this.burst(t, 0.9, { type: 'highpass', freq: 3000, gain: 0.3 });
    this.tone(55, t, 0.5, { wave: 'sine', gain: 0.6, to: 30 });
  }

  /** A reversed swell: the boss smugly heals its Ward. */
  windupMissed() {
    if (!this.ready) return;
    const t = this.now;
    this.tone(260, t, 1.2, { wave: 'sine', gain: 0.25, to: 780, attack: 1.0 });
    this.tone(390, t, 1.2, { wave: 'triangle', gain: 0.1, to: 1170, attack: 1.0 });
  }

  heartbeat() {
    if (!this.ready) return;
    const t = this.now;
    this.tone(60, t, 0.15, { gain: 0.5, to: 40 });
    this.tone(55, t + 0.22, 0.18, { gain: 0.4, to: 38 });
  }

  death() {
    if (!this.ready) return;
    const t = this.now;
    this.tone(400, t, 1.4, { wave: 'sawtooth', gain: 0.25, to: 30 });
    this.burst(t + 0.15, 1.6, { type: 'lowpass', freq: 3000, to: 80, gain: 0.7 });
    this.tone(50, t + 0.15, 1.2, { gain: 0.8, to: 25 });
  }

  loot(rarity: 0 | 1 | 2 | 3) {
    if (!this.ready) return;
    const t = this.now;
    const notes = [523, 659, 784, 1047, 1319, 1568].slice(0, 3 + rarity);
    notes.forEach((f, i) => this.tone(f, t + i * 0.09, 0.5, { wave: 'triangle', gain: 0.14 }));
  }

  /** The washer is done: a bright three-note chime, played a few times. */
  alarm() {
    if (!this.ready) return;
    const t = this.now;
    for (let r = 0; r < 3; r++) {
      [784, 988, 1319].forEach((f, i) => this.tone(f, t + r * 0.7 + i * 0.12, 0.5, { wave: 'triangle', gain: 0.22 }));
    }
  }

  /** A step done: a quick rising sparkle. */
  stepDone() {
    if (!this.ready) return;
    const t = this.now;
    [523, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.06, 0.3, { wave: 'square', gain: 0.1 }));
  }

  levelUp() {
    if (!this.ready) return;
    const t = this.now;
    [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.1, 0.6, { wave: 'sawtooth', gain: 0.1 }));
    this.burst(t + 0.4, 0.8, { type: 'highpass', freq: 4000, gain: 0.2 });
  }

  click() {
    if (!this.ready) return;
    this.tone(700, this.now, 0.04, { wave: 'triangle', gain: 0.08 });
  }
}

export const sfx = new Sfx();
