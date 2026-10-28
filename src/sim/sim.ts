// The three launch kinds. A Sim advances one 60 fps frame at a time (4 physics substeps) and reports events for
// the renderer and the synth. Nothing in here touches the DOM, so the same code runs headless for seed search
// and the determinism tests.

import { DEG, TAU, dcos, dsin, wrapAngle } from './dmath';
import {
  type Ball, type Paddle, type Peg, type Ring, type Segment,
  collideAllBalls, collideCircle, collidePaddle, collideRing, collideSegment, holdEnergy, makeBall, rotateVelocity,
} from './physics';
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

// ---- escape ------------------------------------------------------------------------------------------------

const ESCAPE_G = 1300;

export class EscapeSim extends Sim {
  readonly maxSeconds = 90;
  rings: Ring[] = [];
  /** Index of the innermost ring still standing. */
  current = 0;
  private energy: number;

  constructor(spec: Spec) {
    super(spec);
    const n = Math.max(1, Math.min(8, Math.floor(this.spec.rings)));
    const innerR = n === 1 ? R0 : Math.max(120, R0 - (n - 1) * 70);
    const spacing = n === 1 ? 0 : (R0 - innerR) / (n - 1);
    const w = n >= 5 ? 8 : 10;
    const gapHalf = (this.spec.gap_deg * DEG) / 2;
    for (let i = 0; i < n; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      this.rings.push({
        cx: CX, cy: CY, r: innerR + spacing * i, w,
        angle: 0, omega: this.spec.spin * DEG * (1 + 0.12 * i) * dir,
        gapAt: this.rng.range(0, TAU), gapHalf, closed: false, alive: true,
      });
    }
    const ballR = n === 1 ? 22 : Math.max(9, Math.min(22, (spacing - w) * 0.3));
    const a = this.rng.range(0, TAU);
    const speed = 1000;
    this.balls.push(makeBall(0, 0, CX, CY, speed * dcos(a), speed * dsin(a), ballR));
    this.energy = 0.5 * speed * speed - ESCAPE_G * CY;
  }

  protected substep(dt: number): void {
    for (const ring of this.rings) {
      if (!ring.alive) continue;
      ring.angle = wrapAngle(ring.angle + ring.omega * dt);
    }
    const b = this.balls[0];
    b.vy += ESCAPE_G * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (this.result) return;
    const ring = this.rings[this.current];
    const hit = collideRing(b, ring, 1, 0.04);
    if (hit > 0) {
      rotateVelocity(b, this.rng.range(-2, 2) * DEG);
      holdEnergy(b, this.energy, ESCAPE_G, 600);
      if (this.spec.grow > 0) this.growBall(b);
      this.bounce(b, hit);
    }
    const dx = b.x - ring.cx;
    const dy = b.y - ring.cy;
    const out = ring.r + ring.w / 2 + b.r;
    if (dx * dx + dy * dy > out * out) {
      ring.alive = false;
      this.events.push({ type: 'shatter', ring: this.current });
      this.current++;
      if (this.current >= this.rings.length) {
        this.finish(-1, 'ESCAPED!', [], { escaped: true });
      }
    }
  }

  private growBall(b: Ball): void {
    const ring = this.rings[this.current];
    const maxR = (ring.r - ring.w) * 0.9;
    b.r = Math.min(maxR, b.r + this.spec.grow);
    b.m = b.r * b.r;
  }

  protected timeout(): void {
    this.finish(-1, 'TRAPPED!', [], { escaped: false });
  }

  status(): string {
    const left = this.rings.length - this.current;
    if (this.result) return `${this.bounces} BOUNCES · ${this.result.seconds.toFixed(1)} s`;
    return this.rings.length > 1 ? `RINGS LEFT ${left} · BOUNCES ${this.bounces}` : `BOUNCES ${this.bounces}`;
  }
}

// ---- battle ------------------------------------------------------------------------------------------------

const BATTLE_G = 900;

export class BattleSim extends Sim {
  readonly maxSeconds = 150;
  ring: Ring;
  eliminated: number[] = [];
  private energy: number;
  private spinAccel: number;

  constructor(spec: Spec) {
    super(spec);
    const n = this.teams.length;
    const flags = Boolean(this.spec.countries?.length);
    const r = (n <= 6 ? 30 : n <= 10 ? 26 : 22) + (flags ? 4 : 0);
    const dir = this.rng.next() < 0.5 ? 1 : -1;
    this.ring = {
      cx: CX, cy: CY, r: R0, w: 12, angle: 0, omega: this.spec.spin * DEG * dir,
      gapAt: this.rng.range(0, TAU), gapHalf: (this.spec.gap_deg * DEG) / 2, closed: false, alive: true,
    };
    this.spinAccel = 3 * DEG * dir;
    const speed = 560;
    this.energy = 0.5 * speed * speed - BATTLE_G * CY;
    for (let i = 0; i < n; i++) {
      let x = CX, y = CY;
      for (let tries = 0; tries < 200; tries++) {
        const a = this.rng.range(0, TAU);
        const d = this.rng.range(0, 240);
        x = CX + d * dcos(a);
        y = CY + d * dsin(a);
        if (this.balls.every((o) => dist2(o.x, o.y, x, y) > (o.r + r + 6) * (o.r + r + 6))) break;
      }
      const a = this.rng.range(0, TAU);
      const s = this.rng.range(380, 620);
      this.balls.push(makeBall(i, i, x, y, s * dcos(a), s * dsin(a), r));
    }
  }

  protected substep(dt: number): void {
    const ring = this.ring;
    ring.omega += this.spinAccel * dt;
    ring.angle = wrapAngle(ring.angle + ring.omega * dt);
    for (const b of this.balls) {
      if (b.gone) continue;
      b.vy += BATTLE_G * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (!b.live && b.y > H + 200) b.gone = true;
    }
    collideAllBalls(this.balls, 1);
    for (const b of this.balls) {
      if (!b.live) continue;
      const hit = collideRing(b, ring, 1, 0.06);
      if (hit > 0) {
        rotateVelocity(b, this.rng.range(-3, 3) * DEG);
        holdEnergy(b, this.energy, BATTLE_G, 420);
        this.bounce(b, hit);
      }
    }
    if (this.result) return;
    for (const b of this.balls) {
      if (!b.live) continue;
      const dx = b.x - ring.cx;
      const dy = b.y - ring.cy;
      const out = ring.r + ring.w / 2 + b.r;
      if (dx * dx + dy * dy > out * out) {
        b.live = false;
        this.eliminated.push(b.team);
        this.events.push({ type: 'out', team: b.team, x: b.x, y: b.y });
        const alive = this.balls.filter((o) => o.live);
        if (alive.length === 1) {
          const w = alive[0].team;
          this.finish(w, `${this.teams[w].name} WINS!`, [...this.eliminated, w]);
          return;
        }
      }
    }
  }

  protected timeout(): void {
    // Closest to the center survives.
    let best = this.balls.find((b) => b.live)!;
    for (const b of this.balls) {
      if (b.live && dist2(b.x, b.y, CX, CY) < dist2(best.x, best.y, CX, CY)) best = b;
    }
    this.finish(best.team, `${this.teams[best.team].name} WINS!`, [...this.eliminated, best.team]);
  }

  status(): string {
    const left = this.balls.filter((b) => b.live).length;
    if (this.result) return `${this.result.seconds.toFixed(1)} s`;
    return `${left} LEFT`;
  }
}

// ---- race --------------------------------------------------------------------------------------------------

const RACE_G = 1100;
export const RACE_LEFT = 40;
export const RACE_RIGHT = 1040;
export const RACE_TOP = 330;
export const RAMP_TOP = 720;
export const FINISH_Y = 1690;
export const FLOOR_Y = 1790;

export class RaceSim extends Sim {
  readonly maxSeconds = 120;
  ramps: Segment[] = [];
  walls: Segment[] = [];
  pegs: Peg[] = [];
  paddles: Paddle[] = [];
  finished: number[] = [];
  private firstFinishFrame = -1;

  constructor(spec: Spec) {
    super(spec);
    const n = this.teams.length;
    const flags = Boolean(this.spec.countries?.length);
    const r = (n <= 8 ? 19 : 16) + (flags ? 3 : 0);
    const hw = 5;
    const rampStep = 200;
    const drop = 100;
    for (let i = 0; i < 5; i++) {
      const yHigh = RAMP_TOP + i * rampStep;
      const yLow = yHigh + drop;
      const right = i % 2 === 0;
      const ramp: Segment = right
        ? { ax: RACE_LEFT, ay: yHigh, bx: RACE_RIGHT - 110, by: yLow, hw, e: 0.2, mu: 0.02 }
        : { ax: RACE_RIGHT, ay: yHigh, bx: RACE_LEFT + 110, by: yLow, hw, e: 0.2, mu: 0.02 };
      this.ramps.push(ramp);
      // Four or five bumps per ramp, placed by the seed.
      const bumps = 4 + this.rng.int(2);
      for (let k = 0; k < bumps; k++) {
        const t = 0.18 + (0.64 * (k + this.rng.range(0.15, 0.85))) / bumps;
        const x = ramp.ax + (ramp.bx - ramp.ax) * t;
        const y = ramp.ay + (ramp.by - ramp.ay) * t;
        this.pegs.push({ x, y: y + 1, r: 9, e: 0.6 });
      }
      if (i === 1 || i === 3) {
        const t = this.rng.range(0.4, 0.6);
        const x = ramp.ax + (ramp.bx - ramp.ax) * t;
        const y = ramp.ay + (ramp.by - ramp.ay) * t;
        // The low blade sweeps downhill, so a paddle can delay or fling a marble but never trap the pack.
        const spin = this.rng.range(2.2, 3.2) * (right ? -1 : 1);
        this.paddles.push({ px: x, py: y - 80, half: 58, hw: 6, angle: this.rng.range(0, TAU), omega: spin, e: 0.5 });
      }
    }
    this.walls.push(
      { ax: RACE_LEFT, ay: RACE_TOP, bx: RACE_LEFT, by: FLOOR_Y, hw: 4, e: 0.3, mu: 0.02 },
      { ax: RACE_RIGHT, ay: RACE_TOP, bx: RACE_RIGHT, by: FLOOR_Y, hw: 4, e: 0.3, mu: 0.02 },
      { ax: RACE_LEFT, ay: FLOOR_Y, bx: RACE_RIGHT, by: FLOOR_Y, hw: 4, e: 0.15, mu: 0.3 },
    );
    // A peg field above the first ramp scrambles the start, so no slot has a built-in edge.
    for (let row = 0; row < 5; row++) {
      const y = 440 + row * 50;
      const offset = row % 2 === 0 ? 0 : 36;
      for (let x = RACE_LEFT + 52 + offset; x < RACE_RIGHT - 30; x += 72) this.pegs.push({ x, y, r: 8, e: 0.55 });
    }
    // Start slots: the order is shuffled with its own generator (as in orbit.py) instead of following the team list.
    const slotRng = makeRng(spec.seed, 1);
    const order = slotRng.shuffle(this.teams.map((_, i) => i));
    // Marbles drop side by side from the same height, so where each one lands is down to the pegs.
    const gapX = 2 * r + 6;
    for (let s = 0; s < n; s++) {
      const x = CX + (s - (n - 1) / 2) * gapX;
      const team = order[s];
      this.balls.push(makeBall(team, team, x, RACE_TOP + 40, this.rng.range(-40, 40), 0, r));
    }
  }

  protected substep(dt: number): void {
    for (const p of this.paddles) p.angle = wrapAngle(p.angle + p.omega * dt);
    for (const b of this.balls) {
      b.vy += RACE_G * dt;
      const damp = 1 - 0.25 * dt;
      b.vx *= damp;
      b.vy *= damp;
      const v2 = b.vx * b.vx + b.vy * b.vy;
      if (v2 > 1000 * 1000) {
        const k = 1000 / Math.sqrt(v2);
        b.vx *= k;
        b.vy *= k;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    for (let iter = 0; iter < 2; iter++) {
      collideAllBalls(this.balls, 0.5, (a, b, s) => {
        if (iter === 0 && s > 260) this.bounce(a.y < b.y ? b : a, s * 0.6);
      });
      for (const b of this.balls) {
        let hit = 0;
        for (const s of this.ramps) hit = Math.max(hit, collideSegment(b, s));
        for (const s of this.walls) hit = Math.max(hit, collideSegment(b, s));
        for (const p of this.pegs) {
          const h = collideCircle(b, p.x, p.y, p.r, 0, 0, p.e, 0);
          // Bumps aren't perfect: a small kick in a random direction makes hops (and the order) vary.
          if (h > 60) rotateVelocity(b, this.rng.range(-16, 16) * DEG);
          hit = Math.max(hit, h);
        }
        for (const p of this.paddles) hit = Math.max(hit, collidePaddle(b, p));
        if (iter === 0 && hit > 200) this.bounce(b, hit);
      }
    }
    for (const b of this.balls) {
      if (b.y > FINISH_Y && !this.finished.includes(b.team)) {
        this.finished.push(b.team);
        this.events.push({ type: 'finish', team: b.team, place: this.finished.length });
        if (this.finished.length === 1) {
          this.firstFinishFrame = this.frame;
          this.finish(b.team, `${this.teams[b.team].name} WINS!`, this.finished);
        }
      }
    }
    if (this.result) this.result.order = this.finished;
  }

  protected timeout(): void {
    let best = this.balls[0];
    for (const b of this.balls) if (b.y > best.y) best = b;
    this.finish(best.team, `${this.teams[best.team].name} WINS!`, [best.team]);
  }

  status(): string {
    if (this.finished.length) {
      const medals = ['1ST', '2ND', '3RD'];
      return this.finished.slice(0, 3).map((t, i) => `${medals[i]} ${this.teams[t].name}`).join('  ·  ');
    }
    // Leader = lowest ramp, then furthest along it.
    return `${this.seconds.toFixed(1)} s`;
  }

  get sinceFirstFinish(): number {
    return this.firstFinishFrame < 0 ? 0 : (this.frame - this.firstFinishFrame) / FPS;
  }
}

/** Squared distance. (No `**`: exponentiation is implementation-approximated in JS.) */
function dist2(ax: number, ay: number, bx: number, by: number): number {
  return (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
}

export function createSim(spec: Spec): Sim {
  switch (spec.kind) {
    case 'escape': return new EscapeSim(spec);
    case 'battle': return new BattleSim(spec);
    case 'race': return new RaceSim(spec);
  }
}

/** Runs a sim headless until it has a result (or hits its time limit). */
export function dryRun(spec: Spec): Sim {
  const sim = createSim(spec);
  while (!sim.result) sim.stepFrame();
  return sim;
}
