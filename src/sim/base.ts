// The base class every sim kind extends. A Sim advances one 60 fps frame at a time (4 physics substeps) and
// reports events for the renderer and the synth. Nothing here touches the DOM, so the same code runs headless for
// seed search and the determinism tests.

import type { Ball } from './physics';
import { type Rng, fnv1a, makeRng } from './rng';
import { type Contestant, type Spec, contestants, withDefaults } from './spec';

export const FPS = 60;
export const SUBSTEPS = 4;
const DT = 1 / FPS / SUBSTEPS;
export const W = 1080;
export const H = 1920;
export const CX = 540;
export const CY = 960;
export const R0 = 430;

export type SimEvent =
  | { type: 'bounce'; x: number; y: number; strength: number; team: number }
  | { type: 'shatter'; ring: number }
  | { type: 'out'; team: number; x: number; y: number }
  | { type: 'finish'; team: number; place: number }
  | { type: 'break'; x: number; y: number; color: string }
  | { type: 'spawn'; x: number; y: number }
  | { type: 'result' };

export type SimResult = {
  /** Winning contestant index, or -1 when there is no winner (escape). */
  winner: number;
  headline: string;
  frame: number;
  seconds: number;
  bounces: number;
  /** battle: elimination order; race: finish order. */
  order: number[];
  /** escape only: whether the ball got out before the time limit. */
  escaped?: boolean;
  /** Time-guess kinds: whether the run reached its goal (escaped, filled, cleared...) rather than timing out. */
  completed?: boolean;
};

export abstract class Sim {
  readonly spec: ReturnType<typeof withDefaults>;
  readonly teams: Contestant[];
  readonly rng: Rng;
  balls: Ball[] = [];
  frame = 0;
  bounces = 0;
  result: SimResult | null = null;
  protected events: SimEvent[] = [];
  /** Hard stop so a bad seed can't run forever. */
  abstract readonly maxSeconds: number;

  constructor(spec: Spec) {
    this.spec = withDefaults(spec);
    this.teams = contestants(spec);
    this.rng = makeRng(spec.seed, 0);
  }

  get seconds(): number {
    return this.frame / FPS;
  }

  /** Advances one frame and returns what happened during it. */
  stepFrame(): SimEvent[] {
    this.events = [];
    for (let i = 0; i < SUBSTEPS; i++) this.substep(DT);
    this.frame++;
    if (!this.result && this.seconds >= this.maxSeconds) this.timeout();
    return this.events;
  }

  protected abstract substep(dt: number): void;
  protected abstract timeout(): void;
  abstract status(): string;

  /** Draw a name label under each ball (contest kinds). */
  get labels(): boolean {
    return false;
  }

  /** Trail length in frames. */
  get trail(): number {
    return 14;
  }

  ballColor(b: Ball): string {
    return this.teams[b.team].color;
  }

  /** Gravity scaled by the spec's multiplier. */
  protected g(base: number): number {
    return base * this.spec.gravity;
  }

  protected finish(winner: number, headline: string, order: number[], extra: Partial<SimResult> = {}): void {
    if (this.result) return;
    this.result = {
      winner, headline, order, frame: this.frame + 1, seconds: (this.frame + 1) / FPS, bounces: this.bounces, ...extra,
    };
    this.events.push({ type: 'result' });
  }

  protected bounce(b: Ball, strength: number): void {
    this.bounces++;
    this.events.push({ type: 'bounce', x: b.x, y: b.y, strength, team: b.team });
  }

  /** A fingerprint of the run, used by the cross-browser determinism test. */
  fingerprint(): string {
    const r = this.result;
    const parts = [
      this.spec.kind, this.frame, this.bounces,
      r ? `${r.winner}|${r.frame}|${r.bounces}|${r.order.join(',')}` : 'none',
      ...this.balls.map((b) => `${b.x},${b.y},${b.vx},${b.vy},${b.r}`),
    ];
    return fnv1a(parts.join(';'));
  }
}

/** Squared distance. (No `**`: exponentiation is implementation-approximated in JS.) */
export function dist2(ax: number, ay: number, bx: number, by: number): number {
  return (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
}

