// Bounce notes: a Karplus-Strong plucked string plus a soft bell partial, through a short reverb. Browsers only
// allow audio after a tap, so the context is created by unlock() inside the first tap handler.

import type { MelodyId } from '../sim/spec';
import { MELODIES } from './melodies';

const NOTE_SECONDS = 1.6;

export class Synth {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private cache = new Map<number, AudioBuffer>();
  private notes: number[] = MELODIES.fur_elise.notes;
  private index = 0;
  private lastNoteAt = -1;
  /** Minimum gap between notes in sim seconds (65 ms; orbit.py uses 120 ms for multiply). */
  minGap = 0.065;
  muted = false;

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Call from a tap handler. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor({ latencyHint: 'interactive' });
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);
      this.out = comp;
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.8;
      master.connect(comp);
      const dry = ctx.createGain();
      dry.gain.value = 1;
      dry.connect(master);
      const verb = ctx.createConvolver();
      verb.buffer = this.impulse(ctx, 1.3);
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      verb.connect(wet).connect(master);
      const bus = ctx.createGain();
      bus.connect(dry);
      bus.connect(verb);
      this.bus = bus;
      this.masterGain = master;
      // iOS needs a sound started inside the gesture to fully unlock.
      const silent = ctx.createBufferSource();
      silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      silent.connect(ctx.destination);
      silent.start();
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  private masterGain: GainNode | null = null;
  private out: AudioNode | null = null;
  private recordDest: MediaStreamAudioDestinationNode | null = null;

  /** A stream of everything the synth plays, for recording a video. Null before unlock(). */
  recordStream(): MediaStream | null {
    if (!this.ctx || !this.out) return null;
    if (!this.recordDest) {
      this.recordDest = this.ctx.createMediaStreamDestination();
      this.out.connect(this.recordDest);
    }
    return this.recordDest.stream;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.masterGain && this.ctx) this.masterGain.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.02);
  }

  setMelody(id: MelodyId): void {
    this.notes = MELODIES[id].notes;
    this.index = 0;
    this.lastNoteAt = -1;
  }

  /** Plays the next melody note for a bounce at sim time `t` (seconds), respecting the minimum gap. */
  bounce(t: number, strength: number): void {
    if (this.lastNoteAt >= 0 && t - this.lastNoteAt < this.minGap) return;
    this.lastNoteAt = t;
    const note = this.notes[this.index % this.notes.length];
    this.index++;
    const vel = Math.min(1, 0.55 + strength / 2400);
    this.play(note, vel);
  }

  /** Rising major chord for the result. */
  chord(): void {
    if (!this.ctx) return;
    const root = 60 + (this.notes[0] % 12);
    [0, 4, 7, 12, 16].forEach((step, i) => this.play(root + step, 0.75, i * 0.07));
  }

  /** Soft low note for an elimination. */
  thud(): void {
    this.play(43, 0.5);
  }

  private play(midi: number, velocity: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.bus || this.muted || ctx.state !== 'running') return;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer(midi);
    const g = ctx.createGain();
    g.gain.value = velocity * 0.5;
    src.connect(g).connect(this.bus);
    src.start(ctx.currentTime + delay);
  }

  private buffer(midi: number): AudioBuffer {
    const hit = this.cache.get(midi);
    if (hit) return hit;
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * NOTE_SECONDS);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    // Karplus-Strong: a noise burst one period long, fed back through a two-tap average.
    const period = Math.max(2, Math.round(sr / f));
    const decay = Math.min(0.9985, 0.994 + (60 - Math.min(60, midi - 40)) * 0.00008);
    let prev = 0;
    for (let i = 0; i < period; i++) {
      const n = Math.random() * 2 - 1;
      prev = prev * 0.5 + n * 0.5; // a little lowpass for a rounder pluck
      out[i] = prev;
    }
    for (let i = period; i < len; i++) {
      out[i] = decay * 0.5 * (out[i - period] + out[i - period - 1 >= 0 ? i - period - 1 : 0]);
    }
    // Soft bell partial an octave up plus the fundamental, decaying faster than the string.
    let peak = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const bell = 0.22 * Math.sin(2 * Math.PI * 2 * f * t) * Math.exp(-t * 5) + 0.16 * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 3);
      const attack = Math.min(1, t / 0.003);
      const tail = t > NOTE_SECONDS - 0.2 ? (NOTE_SECONDS - t) / 0.2 : 1;
      out[i] = (out[i] * 0.8 + bell) * attack * tail;
      const a = Math.abs(out[i]);
      if (a > peak) peak = a;
    }
    if (peak > 0) for (let i = 0; i < len; i++) out[i] *= 0.9 / peak;
    this.cache.set(midi, buf);
    return buf;
  }

  private impulse(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }
}
