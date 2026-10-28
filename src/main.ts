import '@fontsource/saira-semi-condensed/latin-600.css';
import '@fontsource/saira-semi-condensed/latin-700.css';
import './style.css';

import { Synth } from './audio/synth';
import {
  type FeedItem, dailyItems, dateKey, pickOptions, pickPrompt, pointsFor, randomItem, sharedItem, winningKey,
} from './app/feed';
import { isNative, openExternal, resultHaptic, shareLink, tapHaptic } from './app/platform';
import { loadStore, recordPick, saveStore, store, winRate } from './app/store';
import { flagCss, preloadFlags } from './render/flags';
import { FONT, Renderer } from './render/renderer';
import { FPS, H, RaceSim, type Sim, W, createSim } from './sim/sim';
import { contestants, paramsToSpec, specToParams } from './sim/spec';

const SHARE_BASE = 'https://lindellrhett-gif.github.io/orbit-arena/';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const el = {
  stage: $('stage'), frame: $('frame'), frameBar: $('frame-bar'), canvas: $<HTMLCanvasElement>('canvas'), tag: $('tag'), skip: $('skip'),
  pick: $('pick'), pickTitle: $('pick-title'), options: $('options'), watch: $('watch'),
  result: $('result'), resultBig: $('result-big'), resultSub: $('result-sub'),
  replay: $('replay'), share: $('share'), next: $('next'),
  points: $('points'), streak: $('streak'), sound: $('sound'), menuBtn: $('menu-btn'), menuClose: $('menu-close'),
  drawer: $('drawer'), scrim: $('scrim'), stats: $('stats'), optSound: $<HTMLInputElement>('opt-sound'),
  optMotion: $<HTMLInputElement>('opt-motion'), toast: $('toast'), version: $('version'),
};

const ICON_SOUND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const ICON_MUTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>';
const ICON_MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

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
  item = next;
  lastKind = next.spec.kind;
  sim = createSim(next.spec);
  renderer.reset();
  synth.setMelody(next.spec.melody);
  sinceResult = 0;
  cardShown = false;
  picked = null;
  el.result.hidden = true;
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
  el.pickTitle.textContent = pickPrompt(item.spec);
  el.options.replaceChildren(
    ...pickOptions(item.spec).map((o) => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.style.setProperty('--c', o.color);
      if (o.flag) {
        const flag = document.createElement('span');
        flag.className = 'flag';
        flag.style.cssText = flagCss(o.flag);
        b.append(flag);
      } else if (item.spec.kind !== 'escape') {
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
  const opts = pickOptions(item.spec);
  const winnerLabel = opts.find((o) => o.key === key)?.label ?? r.headline;
  if (picked) {
    const won = picked === key;
    const pts = pointsFor(item.spec);
    recordPick(won, pts, item.dailyKey);
    resultHaptic(won);
    if (won) {
      el.resultBig.textContent = `You called it! +${pts} ★`;
      el.resultSub.textContent = store.stats.streak > 1 ? `🔥 ${store.stats.streak} in a row` : resultLine();
    } else {
      const mine = opts.find((o) => o.key === picked)?.label ?? picked;
      el.resultBig.textContent = 'Not this time';
      el.resultSub.textContent = item.spec.kind === 'escape'
        ? `It escaped in ${r.seconds.toFixed(1)} s. You said ${mine}.`
        : `${winnerLabel} won. You picked ${mine}.`;
    }
  } else {
    if (item.dailyKey && !store.stats.daily.includes(item.dailyKey)) {
      store.stats.daily.push(item.dailyKey);
      saveStore();
    }
    el.resultBig.textContent = r.headline;
    el.resultSub.textContent = resultLine();
  }
  updateScore();
  el.result.hidden = false;
}

function resultLine(): string {
  const r = sim.result!;
  if (item.spec.kind === 'escape') return `${r.bounces} bounces · ${r.seconds.toFixed(1)} s`;
  return `${r.seconds.toFixed(1)} s · ${contestants(item.spec).length} in the race`.replace(
    'in the race', item.spec.kind === 'race' ? 'marbles' : 'balls',
  );
}

function shareUrl(): string {
  const base = isNative || location.protocol === 'file:' ? SHARE_BASE : `${location.origin}${location.pathname}`;
  return `${base}?${specToParams(item.spec).toString()}`;
}

async function share(): Promise<void> {
  const key = winningKey(sim);
  const label = pickOptions(item.spec).find((o) => o.key === key)?.label;
  let text = 'Can you guess the winner? 👀';
  if (picked && picked === key && label) {
    text = item.spec.kind === 'escape' ? `I called it: escaped in ${label} 🔥 Can you?` : `I called it: ${label} won 🔥 Can you?`;
  }
  const res = await shareLink(text, shareUrl());
  if (res === 'copied') toast('Link copied');
  else if (res === 'failed') toast('Could not share');
}

let toastTimer = 0;
function toast(msg: string): void {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.toast.hidden = true), 1800);
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
      if (!cardShown && sinceResult > Math.min(1.2, outroSeconds())) showCard();
    }
  }
  draw(now / 1000);
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
