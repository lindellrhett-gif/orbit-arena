// multiply: a closed ring; every wall bounce of the first ball adds a new ball, until the cap.

import { CX, CY, R0, Sim } from '../base';
import { DEG, TAU, dcos, dsin, wrapAngle } from '../dmath';
import { type Ball, type Ring, collideAllBalls, collideRing, holdEnergy, makeBall, rotateVelocity } from '../physics';
import { COLORS, type Spec } from '../spec';

const MULT_G = 1100;
const PALETTE = Object.values(COLORS).filter((c) => c !== COLORS.white);

export class MultiplySim extends Sim {
  readonly maxSeconds = 90;
  ring: Ring;
  private energy: number;
  private leadEnergy: number;
  private r: number;
  private lastSpawn = -100;

  constructor(spec: Spec) {
    super(spec);
    this.ring = {
      cx: CX, cy: CY, r: R0, w: 12, angle: 0, omega: this.spec.spin * DEG, gapAt: 0, gapHalf: 0, closed: true,
      alive: true,
    };
    this.r = (this.spec.cap > 150 ? 11 : 13) * this.spec.size;
    const a = this.rng.range(0, TAU);
    const speed = 820;
    const first = makeBall(0, 0, CX, CY, 1100 * dcos(a), 1100 * dsin(a), this.r * 1.3);
    // The first ball is heavy so the crowd can't smother it: it keeps bouncing, so balls keep coming.
    first.m *= 25;
    this.balls.push(first);
    this.energy = 0.5 * speed * speed - this.g(MULT_G) * CY;
    this.leadEnergy = 0.5 * 1100 * 1100 - this.g(MULT_G) * CY;
  }

  get trail(): number {
    return this.balls.length > 60 ? 6 : 12;
  }

  ballColor(b: Ball): string {
    return b.id === 0 ? '#ffffff' : PALETTE[b.id % PALETTE.length];
  }

  protected substep(dt: number): void {
    const ring = this.ring;
    ring.angle = wrapAngle(ring.angle + ring.omega * dt);
    const g = this.g(MULT_G);
    for (const b of this.balls) {
      b.vy += g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    let leadHit = 0;
    collideAllBalls(this.balls, 1, (p, q, s) => {
      if (p.id === 0 || q.id === 0) leadHit = Math.max(leadHit, s);
    });
    for (const b of this.balls) {
      const hit = collideRing(b, ring, 1, 0);
      if (hit <= 0) continue;
      rotateVelocity(b, this.rng.range(-3, 3) * DEG);
      holdEnergy(b, b.id === 0 ? this.leadEnergy : this.energy, g, b.id === 0 ? 700 : 380);
      if (b.id === 0) leadHit = Math.max(leadHit, hit);
    }
    // Every bounce of the first ball (off the wall or another ball) adds a ball, at most one per 0.1 s.
    if (leadHit > 150 && this.frame - this.lastSpawn >= 6) {
      this.lastSpawn = this.frame;
      this.bounce(this.balls[0], leadHit);
      if (!this.result && this.balls.length < this.spec.cap) this.spawn();
    }
  }

  private spawn(): void {
    const a = this.rng.range(0, TAU);
    const s = this.rng.range(500, 800);
    const x = CX + this.rng.range(-30, 30);
    const y = CY - 120 + this.rng.range(-30, 30);
    const id = this.balls.length;
    this.balls.push(makeBall(id, 0, x, y, s * dcos(a), s * dsin(a), this.r));
    this.events.push({ type: 'spawn', x, y });
    if (this.balls.length >= this.spec.cap) this.finish(-1, `${this.balls.length} BALLS!`, [], { completed: true });
  }

  protected timeout(): void {
    this.finish(-1, `${this.balls.length} BALLS`, [], { completed: false });
  }

  status(): string {
    return this.result ? `${this.result.seconds.toFixed(1)} s` : `BALLS ${this.balls.length}`;
  }
}
