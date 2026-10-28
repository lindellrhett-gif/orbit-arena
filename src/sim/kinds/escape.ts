import { CX, CY, R0, Sim } from '../base';
import { DEG, TAU, dcos, dsin, wrapAngle } from '../dmath';
import { type Ball, type Ring, collideRing, holdEnergy, makeBall, rotateVelocity } from '../physics';
import type { Spec } from '../spec';

// escape: a ball inside 1-8 nested rotating rings with gaps; each ring shatters when the ball gets out.

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
    const ballR = (n === 1 ? 22 : Math.max(9, Math.min(22, (spacing - w) * 0.3))) * this.spec.size;
    const a = this.rng.range(0, TAU);
    const speed = 1000;
    this.balls.push(makeBall(0, 0, CX, CY, speed * dcos(a), speed * dsin(a), ballR));
    this.energy = 0.5 * speed * speed - this.g(ESCAPE_G) * CY;
  }

  protected substep(dt: number): void {
    for (const ring of this.rings) {
      if (!ring.alive) continue;
      ring.angle = wrapAngle(ring.angle + ring.omega * dt);
    }
    const b = this.balls[0];
    b.vy += this.g(ESCAPE_G) * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (this.result) return;
    const ring = this.rings[this.current];
    const hit = collideRing(b, ring, 1, 0.04);
    if (hit > 0) {
      rotateVelocity(b, this.rng.range(-2, 2) * DEG);
      holdEnergy(b, this.energy, this.g(ESCAPE_G), 600);
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
        this.finish(-1, 'ESCAPED!', [], { escaped: true, completed: true });
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
    this.finish(-1, 'TRAPPED!', [], { escaped: false, completed: false });
  }

  status(): string {
    const left = this.rings.length - this.current;
    if (this.result) return `${this.bounces} BOUNCES · ${this.result.seconds.toFixed(1)} s`;
    return this.rings.length > 1 ? `RINGS LEFT ${left} · BOUNCES ${this.bounces}` : `BOUNCES ${this.bounces}`;
  }
}
