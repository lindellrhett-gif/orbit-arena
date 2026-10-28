import { CX, FPS, Sim } from '../base';
import { DEG, TAU, wrapAngle } from '../dmath';
import {
  type Paddle, type Peg, type Segment,
  collideAllBalls, collideCircle, collidePaddle, collideSegment, makeBall, rotateVelocity,
} from '../physics';
import { makeRng } from '../rng';
import type { Spec } from '../spec';

// race: marbles drop through a peg field, roll down 5 zig-zag ramps with bumps and 2 spinning paddles, and cross
// a checkered finish line; first across wins.

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
    const r = ((n <= 8 ? 19 : 16) + (flags ? 3 : 0)) * this.spec.size;
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
      b.vy += this.g(RACE_G) * dt;
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

  get labels(): boolean {
    return true;
  }

  get trail(): number {
    return 8;
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
