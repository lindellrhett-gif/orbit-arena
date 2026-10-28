// blocks: a ball at constant speed breaks a disc of about 200 colored blocks, and splits every 15 hits (up to 6).

import { CX, CY, R0, Sim } from '../base';
import { DEG, datan2, dcos, dsin, wrapAngle } from '../dmath';
import { type Ring, collideBlock, collideRing, makeBall, rotateVelocity, setSpeed } from '../physics';
import type { Spec } from '../spec';

export type Block = { x: number; y: number; half: number; color: string; alive: boolean };

const SPEED = 900;
const SPLIT_EVERY = 15;
const MAX_BALLS = 6;
const DISC_R = 290;
const STEP = 34;

export class BlocksSim extends Sim {
  readonly maxSeconds = 120;
  ring: Ring;
  blocks: Block[] = [];
  left = 0;
  private hits = 0;

  constructor(spec: Spec) {
    super(spec);
    this.ring = {
      cx: CX, cy: CY, r: R0, w: 12, angle: 0, omega: this.spec.spin * DEG, gapAt: 0, gapHalf: 0, closed: true,
      alive: true,
    };
    const half = 15;
    const hueShift = this.rng.range(0, 360);
    const n = Math.floor(DISC_R / STEP);
    for (let gy = -n; gy <= n; gy++) {
      for (let gx = -n; gx <= n; gx++) {
        const x = CX + gx * STEP;
        const y = CY + gy * STEP;
        const dx = x - CX;
        const dy = y - CY;
        const far = Math.sqrt(dx * dx + dy * dy) + half * 1.41;
        if (far > DISC_R) continue;
        const hue = Math.round((datan2(dy, dx) / DEG + 360 + hueShift) % 360);
        this.blocks.push({ x, y, half, color: `hsl(${hue}, 95%, 62%)`, alive: true });
      }
    }
    this.left = this.blocks.length;
    const a = -90 * DEG + this.rng.range(-35, 35) * DEG;
    this.balls.push(makeBall(0, 0, CX, CY + 360, SPEED * dcos(a), SPEED * dsin(a), 13 * this.spec.size));
  }

  ballColor(): string {
    return '#ffffff';
  }

  protected substep(dt: number): void {
    this.ring.angle = wrapAngle(this.ring.angle + this.ring.omega * dt);
    const balls = this.balls;
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const hit = collideRing(b, this.ring, 1, 0);
      if (hit > 0) {
        rotateVelocity(b, this.rng.range(-3, 3) * DEG);
        setSpeed(b, SPEED);
        this.bounce(b, hit);
      }
      if (this.result) continue;
      for (const k of this.blocks) {
        if (!k.alive) continue;
        if (b.x + b.r < k.x - k.half || b.x - b.r > k.x + k.half) continue;
        if (b.y + b.r < k.y - k.half || b.y - b.r > k.y + k.half) continue;
        if (!collideBlock(b, k.x, k.y, k.half)) continue;
        k.alive = false;
        this.left--;
        this.hits++;
        setSpeed(b, SPEED);
        this.bounce(b, SPEED);
        this.events.push({ type: 'break', x: k.x, y: k.y, color: k.color });
        if (this.hits % SPLIT_EVERY === 0 && balls.length < MAX_BALLS) this.split(b.x, b.y, b.vx, b.vy, b.r);
        if (this.left === 0) this.finish(-1, 'CLEARED!', [], { completed: true });
        break;
      }
    }
  }

  private split(x: number, y: number, vx: number, vy: number, r: number): void {
    const nb = makeBall(this.balls.length, 0, x, y, vx, vy, r);
    rotateVelocity(nb, (this.rng.next() < 0.5 ? 1 : -1) * this.rng.range(25, 50) * DEG);
    this.balls.push(nb);
    this.events.push({ type: 'spawn', x, y });
  }

  protected timeout(): void {
    this.finish(-1, `${this.left} LEFT`, [], { completed: false });
  }

  status(): string {
    if (this.result) return `${this.result.seconds.toFixed(1)} s · ${this.balls.length} BALLS`;
    return `BLOCKS ${this.left} · BALLS ${this.balls.length}`;
  }
}

