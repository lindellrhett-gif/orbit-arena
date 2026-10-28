// Draws a sim in the Orbit Arena look: navy background with a soft glow, neon rings drawn in three passes, white
// rimmed balls with fading trails, labels under the balls, particle bursts, the title, the ORBIT ARENA mark, a
// status line and the result pill. Drawing never feeds back into the physics.

import {
  BattleSim, CX, CY, EscapeSim, FINISH_Y, FLOOR_Y, H, R0, RACE_LEFT, RACE_RIGHT, RaceSim, W,
  type Sim, type SimEvent,
} from '../sim/sim';
import { paddleEnds, ringEdgeAngles, type Ring } from '../sim/physics';
import { flagImage } from './flags';

export const FONT = '"Saira Semi Condensed", "Bahnschrift", "Barlow", system-ui, sans-serif';
const BG = '#07080e';

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };

export type View = {
  title: string;
  /** Hide marbles before the pick, so the start slots can't give the answer away. */
  hideContestants: boolean;
  showResult: boolean;
  /** Real time in seconds, for hue cycling. */
  time: number;
  /** Small mark in the corner for exported videos (Phase 2) and screenshots. */
  watermark?: string;
};

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private bg: HTMLCanvasElement | null = null;
  private glow: HTMLCanvasElement | null = null;
  private trails = new Map<number, number[]>();
  private particles: Particle[] = [];
  reducedMotion = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  /** Sizes the backing store to the element's CSS size times the device pixel ratio (capped at 2). */
  resize(cssWidth: number, dpr: number): void {
    const ratio = Math.min(dpr, 2);
    const w = Math.max(1, Math.round(cssWidth * ratio));
    const h = Math.round((w * H) / W);
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.scale = w / W;
    this.bg = null;
  }

  reset(): void {
    this.trails.clear();
    this.particles = [];
  }

  /** Records trail points and spawns particles for a frame's events. Call once per sim frame. */
  track(sim: Sim, events: SimEvent[]): void {
    const len = this.reducedMotion ? 5 : sim.spec.kind === 'race' ? 8 : 14;
    for (const b of sim.balls) {
      if (b.gone) continue;
      let t = this.trails.get(b.id);
      if (!t) this.trails.set(b.id, (t = []));
      t.push(b.x, b.y);
      if (t.length > len * 2) t.splice(0, t.length - len * 2);
    }
    for (const e of events) {
      if (e.type === 'shatter' && sim instanceof EscapeSim) this.shatter(sim.rings[e.ring], sim);
      else if (e.type === 'out') this.burst(e.x, e.y, sim.teams[e.team].color, 26);
      else if (e.type === 'finish' && e.place === 1) {
        const b = sim.balls.find((x) => x.team === e.team);
        if (b) this.burst(b.x, FINISH_Y, '#ffffff', 40);
      }
    }
    for (const p of this.particles) {
      p.x += p.vx / 60;
      p.y += p.vy / 60;
      p.vy += 500 / 60;
      p.vx *= 0.985;
      p.life -= 1 / 60;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private shatter(ring: Ring, sim: Sim): void {
    const count = this.reducedMotion ? 30 : 110;
    const color = ringColor(0, sim.frame / 60);
    const [a0, a1] = ringEdgeAngles(ring);
    const span = Math.PI * 2 - (a1 - a0);
    for (let i = 0; i < count; i++) {
      const a = a1 + (span * i) / count;
      const sp = 150 + Math.random() * 420;
      this.particles.push({
        x: ring.cx + Math.cos(a) * ring.r, y: ring.cy + Math.sin(a) * ring.r,
        vx: Math.cos(a) * sp + (Math.random() - 0.5) * 120, vy: Math.sin(a) * sp + (Math.random() - 0.5) * 120,
        life: 0.9 + Math.random() * 0.6, max: 1.5, color, size: 4 + Math.random() * 5,
      });
    }
  }

  private burst(x: number, y: number, color: string, n: number): void {
    const count = this.reducedMotion ? Math.ceil(n / 3) : n;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 380;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 0.6 + Math.random() * 0.6, max: 1.2, color,
        size: 3 + Math.random() * 4,
      });
    }
  }

  draw(sim: Sim, view: View): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.bg) this.bg = this.makeBackground(sim.spec.kind === 'race');
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    this.drawTitle(view.title, sim.spec.kind === 'race');

    if (sim instanceof EscapeSim) this.drawEscape(sim, view.time);
    else if (sim instanceof BattleSim) this.drawRing(sim.ring, 0, view.time);
    else if (sim instanceof RaceSim) this.drawTrack(sim, view.time);

    if (!view.hideContestants) this.drawBalls(sim);
    else if (sim instanceof RaceSim) this.drawStartGate();
    this.drawParticles();

    const statusY = sim.spec.kind === 'race' ? 1858 : CY + R0 + 150;
    if (!view.hideContestants) this.text(sim.status(), CX, statusY, `600 40px ${FONT}`, 'rgba(255,255,255,0.78)');
    if (view.showResult && sim.result) this.drawPill(sim);
    if (view.watermark) this.text(view.watermark, CX, H - 40, `600 28px ${FONT}`, 'rgba(255,255,255,0.55)');
  }

  private makeBackground(race: boolean): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d')!;
    g.scale(this.scale, this.scale);
    g.fillStyle = BG;
    g.fillRect(0, 0, W, H);
    const cy = race ? 1100 : CY;
    const grad = g.createRadialGradient(CX, cy, 40, CX, cy, race ? 900 : 640);
    grad.addColorStop(0, 'rgba(14,12,30,1)');
    grad.addColorStop(0.6, 'rgba(12,11,26,0.7)');
    grad.addColorStop(1, 'rgba(7,8,14,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    return c;
  }

  private drawTitle(title: string, race: boolean): void {
    const ctx = this.ctx;
    const lines = title.split('\n').slice(0, 2);
    const size = lines.some((l) => l.length > 22) ? 60 : 74;
    const top = race ? 150 : 210;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    lines.forEach((l, i) => ctx.fillText(l, CX, top + i * (size + 8)));
    const markY = top + (lines.length - 1) * (size + 8) + 62;
    this.drawMark(markY);
  }

  /** The ORBIT ARENA wordmark, letter-spaced, magenta to blue like the logo ring. */
  private drawMark(y: number): void {
    const ctx = this.ctx;
    const text = 'ORBIT ARENA';
    ctx.font = `600 34px ${FONT}`;
    const spacing = 9;
    let width = 0;
    const widths = [...text].map((ch) => ctx.measureText(ch).width);
    for (const w of widths) width += w + spacing;
    width -= spacing;
    const grad = ctx.createLinearGradient(CX - width / 2, 0, CX + width / 2, 0);
    grad.addColorStop(0, '#ff4fd8');
    grad.addColorStop(0.5, '#8b5cff');
    grad.addColorStop(1, '#38bdf8');
    ctx.fillStyle = grad;
    ctx.textAlign = 'left';
    let x = CX - width / 2;
    [...text].forEach((ch, i) => {
      ctx.fillText(ch, x, y);
      x += widths[i] + spacing;
    });
    ctx.textAlign = 'center';
  }

  private drawEscape(sim: EscapeSim, time: number): void {
    sim.rings.forEach((ring, i) => {
      if (ring.alive) this.drawRing(ring, i, time);
    });
  }

  private drawRing(ring: Ring, index: number, time: number): void {
    const ctx = this.ctx;
    const [a0, a1] = ring.closed ? [0, 0] : ringEdgeAngles(ring);
    const start = ring.closed ? 0 : a1;
    const end = ring.closed ? Math.PI * 2 : a0 + Math.PI * 2;
    const color = ringColor(index, time);
    ctx.lineCap = 'round';
    const passes: [number, number][] = [[3.4, 0.12], [1.9, 0.3], [1, 1]];
    for (const [k, alpha] of passes) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = ring.w * k;
      ctx.beginPath();
      ctx.arc(ring.cx, ring.cy, ring.r, start, end);
      ctx.stroke();
    }
    // Bright core.
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = ring.w * 0.35;
    ctx.beginPath();
    ctx.arc(ring.cx, ring.cy, ring.r, start, end);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawTrack(sim: RaceSim, time: number): void {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    const glowLine = (ax: number, ay: number, bx: number, by: number, w: number, color: string) => {
      for (const [k, alpha] of [[3.2, 0.12], [1.8, 0.3], [1, 1]] as const) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = w * k;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    for (const s of sim.walls.slice(0, 2)) glowLine(s.ax, s.ay, s.bx, s.by, 4, 'rgba(120,110,200,0.6)');
    sim.ramps.forEach((s, i) => glowLine(s.ax, s.ay, s.bx, s.by, 10, ringColor(i, time)));
    for (const p of sim.pegs) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e9e6ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    sim.paddles.forEach((p, i) => {
      const [ax, ay, bx, by] = paddleEnds(p);
      glowLine(ax, ay, bx, by, p.hw * 2, ringColor(i + 3, time + 2));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.px, p.py, 7, 0, Math.PI * 2);
      ctx.fill();
    });
    // Checkered finish line.
    const sq = 20;
    for (let x = RACE_LEFT, i = 0; x < RACE_RIGHT; x += sq, i++) {
      for (let row = 0; row < 2; row++) {
        ctx.fillStyle = (i + row) % 2 === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(20,20,30,0.9)';
        ctx.fillRect(x, FINISH_Y - sq + row * sq, Math.min(sq, RACE_RIGHT - x), sq);
      }
    }
    const floor = sim.walls[2];
    glowLine(floor.ax, FLOOR_Y, floor.bx, FLOOR_Y, 6, 'rgba(120,110,200,0.8)');
  }

  private drawStartGate(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    roundRect(ctx, CX - 230, 342, 460, 70, 24);
    ctx.fill();
    ctx.stroke();
    this.text('START ORDER HIDDEN', CX, 390, `600 30px ${FONT}`, 'rgba(255,255,255,0.75)');
  }

  private drawBalls(sim: Sim): void {
    const ctx = this.ctx;
    const escape = sim instanceof EscapeSim;
    // Trails first so every ball sits on top of every trail.
    for (const b of sim.balls) {
      if (b.gone) continue;
      const t = this.trails.get(b.id);
      if (!t) continue;
      const color = escape ? '#ffffff' : sim.teams[b.team].color;
      const n = t.length / 2;
      ctx.fillStyle = color;
      for (let i = 0; i < n - 1; i++) {
        const k = (i + 1) / n;
        ctx.globalAlpha = (b.live ? 0.32 : 0.12) * k;
        ctx.beginPath();
        ctx.arc(t[i * 2], t[i * 2 + 1], b.r * (0.35 + 0.6 * k), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (escape) {
      const b = sim.balls[0];
      ctx.drawImage(this.glowSprite(), b.x - b.r * 2.6, b.y - b.r * 2.6, b.r * 5.2, b.r * 5.2);
    }
    for (const b of sim.balls) {
      if (b.gone) continue;
      const team = sim.teams[b.team];
      ctx.globalAlpha = b.live ? 1 : 0.4;
      const img = team.flag ? flagImage(team.flag) : null;
      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
        ctx.restore();
      } else {
        ctx.fillStyle = team.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2.5, b.r * 0.13);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      if (!escape && b.live) {
        const size = sim.spec.kind === 'race' ? 22 : 26;
        this.label(team.name, b.x, b.y + b.r + size + 2, size, team.flag ? '#ffffff' : team.color);
      }
    }
    ctx.globalAlpha = 1;
  }

  private label(text: string, x: number, y: number, size: number, color: string): void {
    const ctx = this.ctx;
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(7,8,14,0.85)';
    ctx.lineWidth = 6;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  private glowSprite(): HTMLCanvasElement {
    if (this.glow) return this.glow;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 10, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.4, 'rgba(200,190,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    this.glow = c;
    return c;
  }

  private drawParticles(): void {
    const ctx = this.ctx;
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / (p.max * 0.6)));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawPill(sim: Sim): void {
    const ctx = this.ctx;
    const r = sim.result!;
    const color = r.winner >= 0 ? sim.teams[r.winner].color : '#8b5cff';
    ctx.font = `700 70px ${FONT}`;
    const w = Math.max(420, ctx.measureText(r.headline).width + 110);
    const h = 128;
    const y = sim.spec.kind === 'race' ? 1000 : CY;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(10,10,22,0.92)';
    roundRect(ctx, CX - w / 2, y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = r.winner >= 0 ? color : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(r.headline, CX, y + 4);
    ctx.textBaseline = 'alphabetic';
  }

  private text(s: string, x: number, y: number, font: string, color: string): void {
    const ctx = this.ctx;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }
}

/** Neon hue that slowly cycles; rings are offset from each other. */
export function ringColor(index: number, time: number): string {
  const hue = (300 - index * 38 + time * 22) % 360;
  return `hsl(${hue < 0 ? hue + 360 : hue}, 100%, 62%)`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
