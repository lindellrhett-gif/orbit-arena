// orbit: balls circle a black hole whose pull (G/d²) slowly grows, with slight drag; touching the hole knocks
// you out, last one in orbit wins. A closed outer ring keeps everyone on screen.

import { CX, CY, R0, Sim, dist2 } from '../base';
import { TAU, dcos, dsin } from '../dmath';
import { type Ring, collideAllBalls, collideRing, makeBall } from '../physics';
import type { Spec } from '../spec';

export const HOLE_R = 46;
const G0 = 7.5e7;
const GROWTH = 0.015;
const DRAG = 0.02;

export class OrbitSim extends Sim {
  readonly maxSeconds = 120;
  ring: Ring;
  eliminated: number[] = [];
  /** Current pull, for drawing the hole's glow. */
  pull = 1;

  constructor(spec: Spec) {
    super(spec);
    this.ring = {
      cx: CX, cy: CY, r: R0, w: 10, angle: 0, omega: 0, gapAt: 0, gapHalf: 0, closed: true, alive: true,
    };
    const n = this.teams.length;
    const flags = Boolean(this.spec.countries?.length);
    const r = ((n <= 6 ? 22 : 18) + (flags ? 4 : 0)) * this.spec.size;
    const G = G0 * this.spec.gravity;
    const offset = this.rng.range(0, TAU);
    for (let i = 0; i < n; i++) {
      const a = offset + (TAU * i) / n + this.rng.range(-0.15, 0.15);
      const d = this.rng.range(190, 370);
      const x = CX + d * dcos(a);
      const y = CY + d * dsin(a);
      const v = Math.sqrt(G / d) * this.rng.range(0.9, 1.08);
      this.balls.push(makeBall(i, i, x, y, -v * dsin(a), v * dcos(a), r));
    }
  }

  get labels(): boolean {
    return true;
  }

  get trail(): number {
    return 34;
  }

  protected substep(dt: number): void {
    const G = G0 * this.spec.gravity * (1 + GROWTH * this.seconds);
    this.pull = 1 + GROWTH * this.seconds;
    const damp = 1 - DRAG * dt;
    for (const b of this.balls) {
      if (!b.live) continue;
      const dx = b.x - CX;
      const dy = b.y - CY;
      const d2 = dx * dx + dy * dy;
      const d = Math.sqrt(d2);
      const a = G / d2;
      b.vx -= (a * dx / d) * dt;
      b.vy -= (a * dy / d) * dt;
      b.vx *= damp;
      b.vy *= damp;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    collideAllBalls(this.balls, 0.9, (p, q, s) => {
      if (s > 160) this.bounce(p.y < q.y ? q : p, s);
    });
    for (const b of this.balls) {
      if (!b.live) continue;
      const hit = collideRing(b, this.ring, 0.9, 0);
      if (hit > 0) this.bounce(b, hit);
      if (this.result) continue;
      const reach = HOLE_R + b.r * 0.5;
      if (dist2(b.x, b.y, CX, CY) < reach * reach) {
        b.live = false;
        b.gone = true;
        this.eliminated.push(b.team);
        this.events.push({ type: 'out', team: b.team, x: b.x, y: b.y });
        const alive = this.balls.filter((o) => o.live);
        if (alive.length === 1) {
          const w = alive[0].team;
          this.finish(w, `${this.teams[w].name} WINS!`, [...this.eliminated, w]);
        }
      }
    }
  }

  protected timeout(): void {
    let best = this.balls.find((b) => b.live)!;
    for (const b of this.balls) {
      if (b.live && dist2(b.x, b.y, CX, CY) > dist2(best.x, best.y, CX, CY)) best = b;
    }
    this.finish(best.team, `${this.teams[best.team].name} WINS!`, [...this.eliminated, best.team]);
  }

  status(): string {
    if (this.result) return `${this.result.seconds.toFixed(1)} s`;
    return `${this.balls.filter((b) => b.live).length} LEFT · PULL x${this.pull.toFixed(1)}`;
  }
}
