// Stress test: 150 balls in a closed ring with trails and labels, drawn at phone resolution. Reports the time
// per frame for physics + drawing. Opened by tests/browser/perf.mjs (optionally with CPU throttling).
import { Renderer } from '../../src/render/renderer';
import { BattleSim } from '../../src/sim/sim';
import { COLOR_NAMES } from '../../src/sim/spec';

const colors = Array.from({ length: 150 }, (_, i) => COLOR_NAMES[i % COLOR_NAMES.length]);
const sim = new BattleSim({ kind: 'battle', seed: 3, melody: 'canon', colors });
sim.ring.closed = true;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const r = new Renderer(canvas);
r.resize(390, 3);
const times: number[] = [];
let frames = 0;
function frame() {
  const t0 = performance.now();
  const ev = sim.stepFrame();
  r.track(sim, ev);
  r.draw(sim, { title: '150 balls', hideContestants: false, showResult: false, time: frames / 60 });
  times.push(performance.now() - t0);
  if (++frames < 600) requestAnimationFrame(frame);
  else {
    times.sort((a, b) => a - b);
    (window as unknown as { __perf: object }).__perf = {
      median: times[300].toFixed(2), p95: times[570].toFixed(2), max: times[599].toFixed(2),
    };
  }
}
requestAnimationFrame(frame);
