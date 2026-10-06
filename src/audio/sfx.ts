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

  private applyGain() {
    if (!this.master || !this.ctx) return;
    const v = this.muted ? 0 : this.volume * (this.ducked ? 0.35 : 1);
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
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

  click() {
    if (!this.ready) return;
    this.tone(700, this.now, 0.04, { wave: 'triangle', gain: 0.08 });
  }
}

export const sfx = new Sfx();
