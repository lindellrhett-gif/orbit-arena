import { CX, CY, H, R0, Sim, dist2 } from '../base';
import { DEG, TAU, dcos, dsin, wrapAngle } from '../dmath';
import { type Ring, collideAllBalls, collideRing, holdEnergy, makeBall, rotateVelocity } from '../physics';
import type { Spec } from '../spec';

// battle: colored balls (or flags) in a rotating ring with a gap; falling out eliminates you, last one in wins.
// The spin slowly speeds up so a run can't stall.

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
    const r = ((n <= 6 ? 30 : n <= 10 ? 26 : 22) + (flags ? 4 : 0)) * this.spec.size;
    const dir = this.rng.next() < 0.5 ? 1 : -1;
    this.ring = {
      cx: CX, cy: CY, r: R0, w: 12, angle: 0, omega: this.spec.spin * DEG * dir,
      gapAt: this.rng.range(0, TAU), gapHalf: (this.spec.gap_deg * DEG) / 2, closed: false, alive: true,
    };
    this.spinAccel = 3 * DEG * dir;
    const speed = 560;
    this.energy = 0.5 * speed * speed - this.g(BATTLE_G) * CY;
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
      b.vy += this.g(BATTLE_G) * dt;
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
        holdEnergy(b, this.energy, this.g(BATTLE_G), 420);
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

  get labels(): boolean {
    return true;
  }

  status(): string {
    const left = this.balls.filter((b) => b.live).length;
    if (this.result) return `${this.result.seconds.toFixed(1)} s`;
    return `${left} LEFT`;
  }
}
