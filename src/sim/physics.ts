// A small fixed-timestep 2D engine: circles against circles, rotating rings with a gap, line segments and
// spinning paddles. Every function here uses only + - * / sqrt and the dmath trig, in a fixed order, so runs are
// bit-identical across JavaScript engines.

import { datan2, dcos, dsin, wrapAngle } from './dmath';

export type Ball = {
  id: number;
  team: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  m: number;
  /** Still collides and counts as in play. */
  live: boolean;
  /** Removed from the scene entirely (fell off screen). */
  gone: boolean;
};

export type Ring = {
  cx: number;
  cy: number;
  r: number;
  w: number;
  angle: number;
  omega: number;
  /** Gap center relative to `angle`, and its half width, in radians. */
  gapAt: number;
  gapHalf: number;
  /** Gap closed entirely (a solid ring). */
  closed: boolean;
  alive: boolean;
};

export type Segment = { ax: number; ay: number; bx: number; by: number; hw: number; e: number; mu: number };
export type Peg = { x: number; y: number; r: number; e: number };
export type Paddle = { px: number; py: number; half: number; hw: number; angle: number; omega: number; e: number };

export function makeBall(id: number, team: number, x: number, y: number, vx: number, vy: number, r: number): Ball {
  return { id, team, x, y, vx, vy, r, m: r * r, live: true, gone: false };
}

/**
 * Applies a contact impulse against a (possibly moving) wall along normal (nx, ny), which points from the wall
 * into the ball. Returns the impact speed, or 0 when the ball was already separating.
 */
function resolveWall(b: Ball, nx: number, ny: number, wvx: number, wvy: number, e: number, mu: number): number {
  const rvx = b.vx - wvx;
  const rvy = b.vy - wvy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  const jn = -(1 + e) * vn;
  b.vx += jn * nx;
  b.vy += jn * ny;
  if (mu > 0) {
    const tx = -ny;
    const ty = nx;
    const vt = rvx * tx + rvy * ty;
    const maxF = mu * jn;
    let jt = -vt;
    if (jt > maxF) jt = maxF;
    else if (jt < -maxF) jt = -maxF;
    b.vx += jt * tx;
    b.vy += jt * ty;
  }
  return -vn;
}

/** Circle against a fixed or moving circle (ring gap edges, pegs). */
export function collideCircle(
  b: Ball, x: number, y: number, r: number, wvx: number, wvy: number, e: number, mu: number,
): number {
  const dx = b.x - x;
  const dy = b.y - y;
  const rr = b.r + r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return 0;
  let d = Math.sqrt(d2);
  let nx: number, ny: number;
  if (d < 1e-9) { nx = 0; ny = -1; d = 0; } else { nx = dx / d; ny = dy / d; }
  const pen = rr - d;
  b.x += nx * pen;
  b.y += ny * pen;
  return resolveWall(b, nx, ny, wvx, wvy, e, mu);
}

export function collideBalls(a: Ball, b: Ball, e: number): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const rr = a.r + b.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return 0;
  let d = Math.sqrt(d2);
  let nx: number, ny: number;
  if (d < 1e-9) { nx = 1; ny = 0; d = 0; } else { nx = dx / d; ny = dy / d; }
  const pen = rr - d;
  const total = a.m + b.m;
  const ka = b.m / total;
  const kb = a.m / total;
  a.x -= nx * pen * ka;
  a.y -= ny * pen * ka;
  b.x += nx * pen * kb;
  b.y += ny * pen * kb;
  const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rv >= 0) return 0;
  const j = (-(1 + e) * rv) / (1 / a.m + 1 / b.m);
  a.vx -= (j / a.m) * nx;
  a.vy -= (j / a.m) * ny;
  b.vx += (j / b.m) * nx;
  b.vy += (j / b.m) * ny;
  return -rv;
}

/**
 * Collides every pair of live balls. Uses sort-and-sweep on x; the sort is stable with id as tie-break, so the
 * pair order (and therefore the result) is the same everywhere. Calls onHit for each impact.
 */
export function collideAllBalls(balls: Ball[], e: number, onHit?: (a: Ball, b: Ball, speed: number) => void): void {
  const live: Ball[] = [];
  for (const b of balls) if (b.live) live.push(b);
  live.sort((p, q) => (p.x - p.r) - (q.x - q.r) || p.id - q.id);
  for (let i = 0; i < live.length; i++) {
    const a = live[i];
    const right = a.x + a.r;
    for (let j = i + 1; j < live.length; j++) {
      const b = live[j];
      if (b.x - b.r > right) break;
      const s = collideBalls(a, b, e);
      if (s > 0 && onHit) onHit(a, b, s);
    }
  }
}

export function ringEdgeAngles(ring: Ring): [number, number] {
  const c = ring.angle + ring.gapAt;
  return [c - ring.gapHalf, c + ring.gapHalf];
}

/** Ball against a rotating ring with a gap. Handles both sides of the wall and the two rounded gap edges. */
export function collideRing(b: Ball, ring: Ring, e: number, mu: number): number {
  const dx = b.x - ring.cx;
  const dy = b.y - ring.cy;
  const d2 = dx * dx + dy * dy;
  const half = ring.w / 2;
  const reach = ring.r + half + b.r;
  if (d2 >= reach * reach) return 0;
  const d = Math.sqrt(d2);
  if (d < 1e-9) return 0;
  const inner = ring.r - half - b.r;
  if (d < inner) return 0;
  let hit = 0;
  let inGap = false;
  if (!ring.closed) {
    const rel = wrapAngle(datan2(dy, dx) - ring.angle - ring.gapAt);
    inGap = rel < ring.gapHalf && rel > -ring.gapHalf;
  }
  if (!inGap) {
    const nx = dx / d;
    const ny = dy / d;
    // Wall surface velocity is omega x r: purely tangential for a ring.
    const wvx = -ring.omega * dy;
    const wvy = ring.omega * dx;
    if (d < ring.r) {
      const pen = d + b.r - (ring.r - half);
      if (pen > 0) {
        b.x -= nx * pen;
        b.y -= ny * pen;
        hit = resolveWall(b, -nx, -ny, wvx, wvy, e, mu);
      }
    } else {
      const pen = ring.r + half - (d - b.r);
      if (pen > 0) {
        b.x += nx * pen;
        b.y += ny * pen;
        hit = resolveWall(b, nx, ny, wvx, wvy, e, mu);
      }
    }
  }
  if (!ring.closed) {
    const [a0, a1] = ringEdgeAngles(ring);
    for (const a of [a0, a1]) {
      const ex = ring.cx + ring.r * dcos(a);
      const ey = ring.cy + ring.r * dsin(a);
      const s = collideCircle(b, ex, ey, half, -ring.omega * (ey - ring.cy), ring.omega * (ex - ring.cx), e, mu);
      if (s > hit) hit = s;
    }
  }
  return hit;
}

function collideCapsule(
  b: Ball, ax: number, ay: number, bx: number, by: number, hw: number,
  pivotX: number, pivotY: number, omega: number, e: number, mu: number,
): number {
  const sx = bx - ax;
  const sy = by - ay;
  const len2 = sx * sx + sy * sy;
  let t = len2 > 0 ? ((b.x - ax) * sx + (b.y - ay) * sy) / len2 : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + sx * t;
  const cy = ay + sy * t;
  const wvx = -omega * (cy - pivotY);
  const wvy = omega * (cx - pivotX);
  return collideCircle(b, cx, cy, hw, wvx, wvy, e, mu);
}

export function collideSegment(b: Ball, s: Segment): number {
  return collideCapsule(b, s.ax, s.ay, s.bx, s.by, s.hw, 0, 0, 0, s.e, s.mu);
}

export function paddleEnds(p: Paddle): [number, number, number, number] {
  const c = dcos(p.angle) * p.half;
  const s = dsin(p.angle) * p.half;
  return [p.px - c, p.py - s, p.px + c, p.py + s];
}

export function collidePaddle(b: Ball, p: Paddle): number {
  const [ax, ay, bx, by] = paddleEnds(p);
  return collideCapsule(b, ax, ay, bx, by, p.hw, p.px, p.py, p.omega, p.e, 0);
}

/**
 * Rescales a ball's speed so its total energy (kinetic + gravity) equals `energy`. Elastic sims leak or gain a
 * little energy from contact pushes; this keeps every ball lively and the run bounded.
 */
export function holdEnergy(b: Ball, energy: number, g: number, minSpeed: number): void {
  let target2 = 2 * (energy + g * b.y);
  if (target2 < minSpeed * minSpeed) target2 = minSpeed * minSpeed;
  const v2 = b.vx * b.vx + b.vy * b.vy;
  if (v2 < 1e-12) {
    b.vy = -Math.sqrt(target2);
    return;
  }
  const k = Math.sqrt(target2 / v2);
  b.vx *= k;
  b.vy *= k;
}

/** Rotates a velocity by a small angle (deterministic jitter so bounces never settle into a loop). */
export function rotateVelocity(b: Ball, angle: number): void {
  const c = dcos(angle);
  const s = dsin(angle);
  const vx = b.vx * c - b.vy * s;
  b.vy = b.vx * s + b.vy * c;
  b.vx = vx;
}

/**
 * Circle against an axis-aligned square block, reflecting the velocity (speed is kept). Returns whether they touched.
 */
export function collideBlock(b: Ball, cx: number, cy: number, half: number): boolean {
  const qx = b.x < cx - half ? cx - half : b.x > cx + half ? cx + half : b.x;
  const qy = b.y < cy - half ? cy - half : b.y > cy + half ? cy + half : b.y;
  const dx = b.x - qx;
  const dy = b.y - qy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= b.r * b.r) return false;
  let nx: number, ny: number, pen: number;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    nx = dx / d;
    ny = dy / d;
    pen = b.r - d;
  } else {
    // Center inside the block: push out along the shallower axis.
    const ox = half - Math.abs(b.x - cx);
    const oy = half - Math.abs(b.y - cy);
    if (ox < oy) { nx = b.x >= cx ? 1 : -1; ny = 0; pen = ox + b.r; } else { nx = 0; ny = b.y >= cy ? 1 : -1; pen = oy + b.r; }
  }
  b.x += nx * pen;
  b.y += ny * pen;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= 2 * vn * nx;
    b.vy -= 2 * vn * ny;
  }
  return true;
}

/** Sets a ball's speed without changing its direction. */
export function setSpeed(b: Ball, speed: number): void {
  const v2 = b.vx * b.vx + b.vy * b.vy;
  if (v2 < 1e-12) {
    b.vy = -speed;
    return;
  }
  const k = speed / Math.sqrt(v2);
  b.vx *= k;
  b.vy *= k;
}
