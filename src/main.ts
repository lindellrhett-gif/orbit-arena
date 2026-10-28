import '@fontsource/saira-semi-condensed/latin-600.css';
import '@fontsource/saira-semi-condensed/latin-700.css';
import './style.css';

import { Synth } from './audio/synth';
import { type BuildResult, openBuilder } from './app/builder';
import { EXPORT_WIDTH, VideoRecorder, deliverFile, fileExtension, recordingMime } from './app/export';
import {
  type FeedItem, dailyItems, dateKey, guessLine, pickOptions, pickPrompt, pointsFor, randomItem, sharedItem,
  winningKey,
} from './app/feed';
import { isNative, openExternal, resultHaptic, shareLink, tapHaptic } from './app/platform';
import {
  bestDays, dailyStreak, loadStore, recentDays, recordPick, recordWatch, saveStore, store, winRate,
} from './app/store';
import { cleanCredit, specToYaml } from './app/submit';
import { flagCss, preloadFlags } from './render/flags';
import { FONT, Renderer, type View } from './render/renderer';
import { pickSeedWithin } from './sim/seeds';
import { FPS, H, RaceSim, type Sim, W, createSim, dryRun } from './sim/sim';
import { type Spec, defaultTitle, isContest, paramsToSpec, specToParams } from './sim/spec';

const SHARE_BASE = 'https://lindellrhett-gif.github.io/orbit-arena/';
const WATERMARK = 'Made with Orbit Arena · lindellrhett-gif.github.io/orbit-arena';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const el = {
  stage: $('stage'), frame: $('frame'), frameBar: $('frame-bar'), canvas: $<HTMLCanvasElement>('canvas'),
  tag: $('tag'), skip: $('skip'),
  pick: $('pick'), pickTitle: $('pick-title'), options: $('options'), watch: $('watch'),
  result: $('result'), resultBig: $('result-big'), resultSub: $('result-sub'),
  replay: $('replay'), share: $('share'), next: $('next'), video: $('video'), remix: $('remix'), submit: $('submit'),
  submitSheet: $('submit-sheet'), credit: $<HTMLInputElement>('credit'), yaml: $('yaml'), copyYaml: $('copy-yaml'),
  shareSim: $('share-sim'), submitClose: $('submit-close'),
  rec: $('rec'), recTime: $('rec-time'), recCancel: $('rec-cancel'),
  points: $('points'), streak: $('streak'), sound: $('sound'), buildBtn: $('build-btn'), menuBtn: $('menu-btn'),
  menuClose: $('menu-close'), drawer: $('drawer'), scrim: $('scrim'), stats: $('stats'), daily: $('daily'),
  optSound: $<HTMLInputElement>('opt-sound'), optMotion: $<HTMLInputElement>('opt-motion'), toast: $('toast'),
  version: $('version'), builder: $('builder'),
};

const ICON_SOUND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const ICON_MUTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>';
const ICON_MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
const ICON_BUILD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>';

type Phase = 'pick' | 'play' | 'result';

const renderer = new Renderer(el.canvas);
const synth = new Synth();

let queue: FeedItem[] = [];
let item: FeedItem;
let sim: Sim;
let phase: Phase = 'pick';
let picked: string | null = null;
/** Real seconds since the result frame (for the outro). */
let sinceResult = 0;
let cardShown = false;
let lastKind: Sim['spec']['kind'] | undefined;

/** A video export in progress: the run is replayed onto `canvas` and recorded. */
let recording: { rec: VideoRecorder; renderer: Renderer; canvas: HTMLCanvasElement; started: number } | null = null;

// ---- Layout ------------------------------------------------------------------------------------------------

function layout(): void {
  const box = el.stage.getBoundingClientRect();
  const availW = box.width - 16;
  const availH = box.height - 8 - 32;
  const w = Math.max(200, Math.min(availW, (availH * W) / H));
  el.frame.style.width = `${w}px`;
  el.frameBar.style.width = `${w}px`;
  el.frame.style.height = `${(w * H) / W}px`;
  renderer.resize(w, window.devicePixelRatio || 1);
  draw();
}

// ---- Feed --------------------------------------------------------------------------------------------------

function buildQueue(): void {
  const shared = paramsToSpec(new URLSearchParams(location.search));
  if (shared) {
    queue.push(sharedItem(shared));
    history.replaceState(null, '', location.pathname);
  }
  const today = dateKey();
  for (const d of dailyItems(today)) if (!store.stats.daily.includes(d.dailyKey!)) queue.push(d);
  if (queue.length === 0) queue.push(randomItem());
}

function nextItem(): FeedItem {
  const next = queue.shift() ?? randomItem(lastKind);
  if (queue.length === 0) {
    // Prepare the following sim while this one plays, so Next is instant.
    setTimeout(() => { if (queue.length === 0) queue.push(randomItem(next.spec.kind)); }, 400);
  }
  return next;
}

function load(next: FeedItem, watchOnly = false): void {
  stopRecording(false);
  item = next;
  lastKind = next.spec.kind;
  sim = createSim(next.spec);
  renderer.reset();
  synth.setMelody(next.spec.melody);
  synth.minGap = next.spec.kind === 'multiply' ? 0.12 : 0.065;
  sinceResult = 0;
  cardShown = false;
  picked = null;
  el.result.hidden = true;
  el.submitSheet.hidden = true;
  el.tag.hidden = !next.tag;
  el.tag.textContent = next.tag;
  if (next.spec.countries?.length) void preloadFlags().then(() => draw());
  if (watchOnly) start();
  else showPick();
  draw();
}

// ---- Pick ----------------------------------------------------------------------------------------------------

function showPick(): void {
  phase = 'pick';
  el.skip.hidden = true;
  el.pickTitle.textContent = pickPrompt(item.preview);
  el.options.classList.toggle('two', !isContest(item.spec.kind));
  el.options.replaceChildren(
    ...pickOptions(item.preview).map((o) => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.style.setProperty('--c', o.color);
      if (o.flag) {
        const flag = document.createElement('span');
        flag.className = 'flag';
        flag.style.cssText = flagCss(o.flag);
        b.append(flag);
      } else if (isContest(item.spec.kind)) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        b.append(dot);
      }
      b.append(o.label);
      b.addEventListener('click', () => {
        picked = o.key;
        tapHaptic();
        start();
      });
      return b;
    }),
  );
  el.pick.hidden = false;
}

function start(): void {
  synth.unlock();
  synth.setMuted(!store.settings.sound);
  el.pick.hidden = true;
  el.skip.hidden = false;
  phase = 'play';
  last = performance.now();
}

// ---- Result --------------------------------------------------------------------------------------------------

function onResult(): void {
  synth.chord();
}

function showCard(): void {
  cardShown = true;
  el.skip.hidden = true;
  const key = winningKey(sim);
  const r = sim.result!;
  const opts = pickOptions(sim);
  const winnerLabel = opts.find((o) => o.key === key)?.label ?? r.headline;
  if (picked) {
    const won = picked === key;
    const pts = pointsFor(sim);
    recordPick(won, pts, item.dailyKey);
    resultHaptic(won);
    if (won) {
      el.resultBig.textContent = `You called it! +${pts} ★`;
      el.resultSub.textContent = store.stats.streak > 1 ? `🔥 ${store.stats.streak} in a row` : resultLine();
    } else {
      const mine = opts.find((o) => o.key === picked)?.label ?? picked;
      const g = guessLine(sim);
      el.resultBig.textContent = 'Not this time';
      el.resultSub.textContent = g
        ? `It was ${sim.spec.kind === 'grow' ? `${g.value} bounces` : `${g.value.toFixed(1)} s`}. You said ${mine}.`
        : `${winnerLabel} won. You picked ${mine}.`;
    }
  } else {
    recordWatch(item.dailyKey);
    el.resultBig.textContent = r.headline;
    el.resultSub.textContent = resultLine();
  }
  updateScore();
  el.result.hidden = false;
}

function resultLine(): string {
  const r = sim.result!;
  const t = `${r.seconds.toFixed(1)} s`;
  switch (sim.spec.kind) {
    case 'escape': return `${r.bounces} bounces · ${t}`;
    case 'grow': return `Filled in ${t}`;
    case 'multiply': return `${sim.balls.length} balls in ${t}`;
    case 'blocks': return `${sim.balls.length} balls · ${t}`;
    case 'race': return `${t} · ${sim.teams.length} marbles`;
    default: return `${t} · ${sim.teams.length} balls`;
  }
}

function shareUrl(): string {
  const base = isNative || location.protocol === 'file:' ? SHARE_BASE : `${location.origin}${location.pathname}`;
  return `${base}?${specToParams(item.spec).toString()}`;
}

async function share(): Promise<void> {
  const key = winningKey(sim);
  const label = pickOptions(sim).find((o) => o.key === key)?.label;
  let text = isContest(item.spec.kind) ? 'Can you guess the winner? 👀' : 'Over or under? Guess before you watch 👀';
  if (picked && picked === key && label) {
    text = isContest(item.spec.kind) ? `I called it: ${label} won 🔥 Can you?` : `I called it: ${label} 🔥 Can you?`;
  }
  const res = await shareLink(text, shareUrl());
  if (res === 'copied') toast('Link copied');
  else if (res === 'failed') toast('Could not share');
}

let toastTimer = 0;
function toast(msg: string, ms = 1800): void {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.toast.hidden = true), ms);
}

// ---- Video export ----------------------------------------------------------------------------------------------

function exportView(time: number): View {
  return { title: item.title, hideContestants: false, showResult: phase === 'result', time, watermark: WATERMARK };
}

async function saveVideo(): Promise<void> {
  const mime = recordingMime();
  const canvas = document.createElement('canvas');
  canvas.className = 'export-canvas';
  document.body.append(canvas);
  const r = new Renderer(canvas);
  r.resize(EXPORT_WIDTH, 1);
  if (!mime) {
    // No video recording here: save a picture of the result and share the link instead.
    r.draw(sim, exportView(performance.now() / 1000));
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'));
    canvas.remove();
    if (blob) await deliverFile(blob, `orbit-arena-${item.spec.kind}-${item.spec.seed}.png`);
    toast("This device can't record video, so here's a picture. The link replays the run.", 3200);
    await share();
    return;
  }
  synth.unlock();
  if (!store.settings.sound) toast('Sound is off, so the video will be silent');
  // Replay the run from the start onto the export canvas while recording it.
  sim = createSim(item.spec);
  renderer.reset();
  synth.setMelody(item.spec.melody);
  sinceResult = 0;
  cardShown = true;
  el.result.hidden = true;
  el.skip.hidden = true;
  phase = 'play';
  last = performance.now();
  recording = { rec: new VideoRecorder(canvas, synth.recordStream(), mime), renderer: r, canvas, started: performance.now() };
  el.rec.hidden = false;
}

function stopRecording(keep: boolean): void {
  const r = recording;
  if (!r) return;
  recording = null;
  el.rec.hidden = true;
  if (!keep) {
    r.rec.cancel();
    r.canvas.remove();
    return;
  }
  void r.rec.stop().then(async (blob) => {
    r.canvas.remove();
    const res = await deliverFile(blob, `orbit-arena-${item.spec.kind}-${item.spec.seed}.${fileExtension(blob.type)}`);
    if (res === 'saved') toast('Video saved');
    else if (res === 'failed') toast('Could not save the video');
  });
}

// ---- Submit ----------------------------------------------------------------------------------------------------

function updateYaml(): void {
  el.yaml.textContent = specToYaml(item.spec, el.credit.value, shareUrl());
}

function openSubmit(): void {
  el.result.hidden = true;
  el.submitSheet.hidden = false;
  updateYaml();
}

// ---- Builder ---------------------------------------------------------------------------------------------------

function showBuilder(initial: Spec | null): void {
  setMenu(false);
  el.builder.hidden = false;
  openBuilder(el.builder, initial, playBuilt, () => (el.builder.hidden = true));
}

function playBuilt({ spec, fit }: BuildResult): void {
  el.builder.hidden = true;
  toast('Setting up your sim…');
  // Let the toast paint before the (blocking) seed search.
  setTimeout(() => {
    const start = Math.floor(Math.random() * 1_000_000);
    let preview: Sim;
    let seed = start;
    if (fit) {
      const found = pickSeedWithin(spec, start, 1200);
      seed = found.seed;
      preview = found.sim;
      if (!found.fits) toast('No run fit the time window with these settings, so here is the closest one', 3000);
    } else {
      preview = dryRun({ ...spec, seed });
    }
    const full: Spec = { ...spec, seed };
    load({ spec: full, title: defaultTitle(full), tag: 'YOUR SIM', preview }, true);
  }, 30);
}

// ---- Loop ----------------------------------------------------------------------------------------------------

let last = performance.now();
let acc = 0;

function outroSeconds(): number {
  if (sim instanceof RaceSim) return sim.finished.length >= sim.teams.length ? 1.2 : 4;
  return 2.2;
}

function tick(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (phase === 'play' || phase === 'result') {
    acc += dt;
    let steps = 0;
    while (acc >= 1 / FPS && steps < 4) {
      acc -= 1 / FPS;
      steps++;
      const events = sim.stepFrame();
      renderer.track(sim, events);
      recording?.renderer.track(sim, events);
      for (const e of events) {
        if (e.type === 'bounce') synth.bounce(sim.seconds, e.strength);
        else if (e.type === 'out') synth.thud();
        else if (e.type === 'result') onResult();
      }
      if (sim.result && phase === 'play') phase = 'result';
    }
    if (steps === 4) acc = 0;
    if (phase === 'result') {
      sinceResult += dt;
      if (recording) {
        if (sinceResult > outroSeconds() + 0.5) {
          stopRecording(true);
          el.result.hidden = false;
        }
      } else if (!cardShown && sinceResult > Math.min(1.2, outroSeconds())) {
        showCard();
      }
    }
  }
  draw(now / 1000);
  if (recording) {
    recording.renderer.draw(sim, exportView(now / 1000));
    el.recTime.textContent = `REC ${((now - recording.started) / 1000).toFixed(1)} s`;
  }
  requestAnimationFrame(tick);
}

function draw(time = performance.now() / 1000): void {
  if (!sim) return;
  renderer.draw(sim, {
    title: item.title,
    hideContestants: phase === 'pick' && sim instanceof RaceSim,
    showResult: phase === 'result',
    time,
  });
}

// ---- Chrome ----------------------------------------------------------------------------------------------------

function updateScore(): void {
  el.points.textContent = `★ ${store.stats.points}`;
  el.streak.textContent = `🔥 ${store.stats.streak}`;
  const s = store.stats;
  el.stats.innerHTML = [
    [s.points, 'points'], [s.streak, 'streak'], [s.best, 'best streak'],
    [s.picks, 'picks'], [s.wins, 'called it'], [`${winRate()}%`, 'win rate'],
  ].map(([v, k]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
  updateDaily();
}

function updateDaily(): void {
  const today = dateKey();
  const log = store.days[today];
  const streak = dailyStreak(today);
  const week = recentDays(today, 7).reverse();
  const dots = week
    .map(({ date, log: d }) => {
      const cls = !d ? '' : d.played >= 3 ? (d.called === 3 ? 'perfect' : 'done') : 'part';
      return `<span class="day ${cls}" title="${date}: ${d ? `${d.called}/3 called` : 'not played'}">${date.slice(8)}</span>`;
    })
    .join('');
  const best = bestDays(5)
    .map(({ date, log: d }, i) => `<li><span>${i + 1}. ${date}</span><b>${d.called}/3 · ★ ${d.points}</b></li>`)
    .join('');
  el.daily.innerHTML = `
    <p class="small">Three new sims every day, the same for everyone.</p>
    <div class="stats">
      <div class="stat"><b>${log ? `${log.called}/${log.played}` : '0/0'}</b><span>today</span></div>
      <div class="stat"><b>${streak}</b><span>day streak</span></div>
      <div class="stat"><b>${log ? log.points : 0}</b><span>points today</span></div>
    </div>
    <div class="days">${dots}</div>
    ${best ? `<h4>Your best days</h4><ol class="best">${best}</ol>` : ''}`;
}

function updateSound(): void {
  el.sound.innerHTML = store.settings.sound ? ICON_SOUND : ICON_MUTE;
  el.sound.setAttribute('aria-label', store.settings.sound ? 'Sound on' : 'Sound off');
  el.optSound.checked = store.settings.sound;
  synth.setMuted(!store.settings.sound);
}

function setMenu(open: boolean): void {
  el.drawer.classList.toggle('open', open);
  el.scrim.hidden = !open;
}

function wire(): void {
  el.menuBtn.innerHTML = ICON_MENU;
  el.buildBtn.innerHTML = ICON_BUILD;
  el.watch.addEventListener('click', () => { picked = null; start(); });
  el.skip.addEventListener('click', () => {
    // Fast-forward to the result (headless), then show it.
    while (!sim.result) sim.stepFrame();
    renderer.reset();
    phase = 'result';
    sinceResult = 2;
    onResult();
  });
  el.replay.addEventListener('click', () => load(item, true));
  el.next.addEventListener('click', () => load(nextItem()));
  el.share.addEventListener('click', () => void share());
  el.video.addEventListener('click', () => void saveVideo());
  el.recCancel.addEventListener('click', () => {
    stopRecording(false);
    while (!sim.result) sim.stepFrame();
    phase = 'result';
    sinceResult = 3;
    el.result.hidden = false;
  });
  el.remix.addEventListener('click', () => showBuilder(item.spec));
  el.buildBtn.addEventListener('click', () => showBuilder(null));
  el.submit.addEventListener('click', openSubmit);
  el.credit.addEventListener('input', updateYaml);
  el.copyYaml.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(el.yaml.textContent ?? '');
      toast('Spec copied. Paste it in a comment or DM to @orbit_arena');
    } catch {
      toast('Could not copy');
    }
  });
  el.shareSim.addEventListener('click', async () => {
    const who = cleanCredit(el.credit.value);
    const res = await shareLink(`My Orbit Arena sim${who ? ` by ${who}` : ''} 🌀 Feature it?`, shareUrl());
    if (res === 'copied') toast('Link copied');
  });
  el.submitClose.addEventListener('click', () => {
    el.submitSheet.hidden = true;
    el.result.hidden = false;
  });
  el.sound.addEventListener('click', () => {
    store.settings.sound = !store.settings.sound;
    synth.unlock();
    updateSound();
    saveStore();
  });
  el.optSound.addEventListener('change', () => {
    store.settings.sound = el.optSound.checked;
    updateSound();
    saveStore();
  });
  el.optMotion.addEventListener('change', () => {
    store.settings.reducedMotion = el.optMotion.checked;
    renderer.reducedMotion = store.settings.reducedMotion;
    saveStore();
  });
  el.menuBtn.addEventListener('click', () => setMenu(true));
  el.menuClose.addEventListener('click', () => setMenu(false));
  el.scrim.addEventListener('click', () => setMenu(false));
  if (isNative) {
    // Open links (socials, privacy) in the system browser rather than inside the app's web view.
    el.drawer.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) =>
      a.addEventListener('click', (ev) => { ev.preventDefault(); openExternal(a.href); }),
    );
  }
  window.addEventListener('resize', layout);
  new ResizeObserver(layout).observe(el.stage);
}

async function boot(): Promise<void> {
  await loadStore();
  renderer.reducedMotion = store.settings.reducedMotion;
  el.optMotion.checked = store.settings.reducedMotion;
  el.version.textContent = `v${__APP_VERSION__}`;
  wire();
  updateScore();
  updateSound();
  try {
    await Promise.race([document.fonts.load(`700 40px ${FONT}`), new Promise((r) => setTimeout(r, 1200))]);
  } catch {
    // Fall back to system fonts.
  }
  buildQueue();
  load(nextItem());
  layout();
  requestAnimationFrame(tick);
  if (!isNative && 'serviceWorker' in navigator && import.meta.env.PROD) {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  }
}

void boot();
