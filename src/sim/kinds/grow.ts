// grow: one ball in a closed ring grows with every bounce until it fills the ring.

import { CX, CY, R0, Sim } from '../base';
import { DEG, TAU, dcos, dsin, wrapAngle } from '../dmath';
import { type Ring, collideRing, holdEnergy, makeBall, rotateVelocity } from '../physics';
import type { Spec } from '../spec';

const GROW_G = 1700;

export class GrowSim extends Sim {
  readonly maxSeconds = 90;
  ring: Ring;
  private energy: number;
  private maxR: number;
  /** Each run's ball grows at its own rate (from the seed), so the bounce count is worth guessing. */
  readonly rate: number;

  constructor(spec: Spec) {
    super(spec);
    this.ring = {
      cx: CX, cy: CY, r: R0, w: 12, angle: 0, omega: this.spec.spin * DEG, gapAt: 0, gapHalf: 0, closed: true,
      alive: true,
    };
    this.maxR = R0 - 6 - 3;
    this.rate = this.spec.grow * this.rng.range(0.7, 1.35);
    const a = this.rng.range(0, TAU);
    const speed = 2200;
    this.balls.push(makeBall(0, 0, CX, CY, speed * dcos(a), speed * dsin(a), 20 * this.spec.size));
    this.energy = 0.5 * speed * speed - this.g(GROW_G) * CY;
  }

  protected substep(dt: number): void {
    this.ring.angle = wrapAngle(this.ring.angle + this.ring.omega * dt);
    if (this.result) return;
    const b = this.balls[0];
    b.vy += this.g(GROW_G) * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const hit = collideRing(b, this.ring, 1, 0);
    if (hit > 0) {
      rotateVelocity(b, this.rng.range(-2, 2) * DEG);
      holdEnergy(b, this.energy, this.g(GROW_G), 1100);
      // Harder hits grow it more, so the bounce count (the thing viewers guess) varies run to run.
      let k = hit / 1800;
      if (k < 0.3) k = 0.3;
      else if (k > 1.7) k = 1.7;
      b.r = Math.min(this.maxR, b.r + this.rate * k);
      b.m = b.r * b.r;
      this.bounce(b, hit);
      if (b.r >= this.maxR) this.finish(-1, `${this.bounces} BOUNCES!`, [], { completed: true });
    }
  }

  protected timeout(): void {
    this.finish(-1, `${this.bounces} BOUNCES`, [], { completed: false });
  }

  status(): string {
    const pct = Math.round((this.balls[0].r / this.maxR) * 100);
    return this.result ? `${this.result.seconds.toFixed(1)} s` : `BOUNCES ${this.bounces} · ${pct}% FULL`;
  }
}
