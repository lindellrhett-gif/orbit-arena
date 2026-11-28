// The Extras screen: the one-time unlocks (bought through Apple or Google Play in the apps, shown locked on the web), the skin
// and trail picker with a live preview, and Restore Purchases. Locked skins can be previewed but not used.

import { SKINS, TRAILS, type Look, cleanLook } from '../render/looks';
import { Renderer } from '../render/renderer';
import { CX, CY, R0, type Sim, createSim } from '../sim/sim';
import { ANDROID_APP_URL, IOS_APP_URL, PRODUCTS, STORE, type ProductId, buy, canBuy, has, onShopChange, owns, refreshShop, restore, shop } from './shop';
import { saveStore, store } from './store';

export type ShopHooks = {
  /** Skins or unlocks changed: redraw the game in the current look. */
  onLook: () => void;
  toast: (msg: string, ms?: number) => void;
  openExternal: (url: string) => void;
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** The part of the arena the preview shows: a square around the ring, in logical pixels. */
const VIEW = 2 * R0 + 140;
const PREVIEW_SPEC = { kind: 'battle', seed: 11, melody: 'canon', colors: ['red', 'blue', 'yellow', 'green'], size: 1.5, gap_deg: 16 } as const;

let busy: ProductId | 'restore' | null = null;

export function openShop(root: HTMLElement, focus: ProductId | null, hooks: ShopHooks, onClose: () => void): void {
  let preview: Look = cleanLook(store.settings.skin, store.settings.trail);
  let raf = 0;
  let sim: Sim;
  let renderer: Renderer | null = null;
  // One preview for the life of the screen: re-renders (chip taps, store updates) move it, never restart it.
  const frame = el('div', 'look-preview');
  const canvas = el('canvas');
  frame.append(canvas);

  const close = (): void => {
    cancelAnimationFrame(raf);
    stopListening();
    onClose();
  };

  const purchase = async (id: ProductId): Promise<void> => {
    const name = PRODUCTS.find((p) => p.id === id)!.name;
    busy = id;
    render();
    const status = await buy(id);
    busy = null;
    render();
    if (status === 'bought') hooks.toast(`${name} unlocked. Thank you!`, 2600);
    else if (status === 'pending') hooks.toast('Waiting for approval. It unlocks once the purchase is approved.', 3600);
    else if (status === 'failed') hooks.toast("The purchase didn't go through. You weren't charged.", 3200);
  };

  const restoreAll = async (): Promise<void> => {
    busy = 'restore';
    render();
    const status = await restore();
    busy = null;
    render();
    if (status === 'restored') {
      hooks.toast(shop.owned.size ? 'Purchases restored' : `No purchases to restore on this ${STORE.account}`, 2600);
    } else hooks.toast(`Couldn't reach ${STORE.name}. Try again in a moment.`, 3000);
  };

  const header = () => {
    const h = el('div', 'panel-head');
    h.append(el('h2', '', 'Extras'));
    const x = el('button', 'icon', '✕');
    x.setAttribute('aria-label', 'Close');
    x.onclick = close;
    h.append(x);
    return h;
  };

  const intro = () => {
    const p = el('p', 'hint');
    const link = (text: string, url: string) => {
      const a = el('a', '', text);
      a.href = url;
      a.onclick = (ev) => {
        ev.preventDefault();
        hooks.openExternal(url);
      };
      return a;
    };
    const apps = [
      IOS_APP_URL && link('iPhone', IOS_APP_URL),
      ANDROID_APP_URL && link('Android', ANDROID_APP_URL),
    ].filter((a): a is HTMLAnchorElement => Boolean(a));
    if (canBuy()) {
      p.textContent = `One-time purchases through ${STORE.by}. They change looks and what you can make, never picks or points.`;
    } else if (apps.length) {
      p.append('Extras are sold in the Orbit Arena app. Get it for ');
      apps.forEach((a, i) => p.append(...(i ? [' or ', a] : [a])));
      p.append('.');
    } else {
      p.textContent = 'Extras are coming soon in the Orbit Arena app. Everything else here is free.';
    }
    return p;
  };

  const buyButton = (id: ProductId): HTMLButtonElement => {
    if (owns(id)) {
      const b = el('button', 'price owned', '✓ Owned');
      b.disabled = true;
      return b;
    }
    if (!canBuy()) {
      const b = el('button', 'price', 'In the app');
      b.disabled = true;
      return b;
    }
    const price = shop.prices[id];
    const b = el('button', 'price', busy === id ? '…' : price ?? (shop.ready ? 'Unavailable' : 'Loading…'));
    b.disabled = busy !== null || !price;
    b.onclick = () => void purchase(id);
    return b;
  };

  const products = () => {
    const list = el('div', 'products');
    for (const p of PRODUCTS) {
      const row = el('div', `product${p.id === focus ? ' focus' : ''}${p.id === 'everything' ? ' featured' : ''}`);
      const text = el('div', 'product-text');
      text.append(el('b', '', p.name), el('span', '', p.blurb));
      row.append(text, buyButton(p.id));
      list.append(row);
    }
    return list;
  };

  const chips = (title: string, items: readonly { id: string; name: string }[], current: string, pick: (id: string) => void) => {
    const box = el('div');
    box.append(el('h4', '', title));
    const row = el('div', 'chips');
    for (const it of items) {
      const locked = it.id !== 'classic' && !has('skins');
      const b = el('button', `chip-btn${it.id === current ? ' on' : ''}`, locked ? `🔒 ${it.name}` : it.name);
      b.onclick = () => pick(it.id);
      row.append(b);
    }
    box.append(row);
    return box;
  };

  const setLook = (next: Look): void => {
    preview = next;
    if (renderer) renderer.look = preview;
    if (has('skins')) {
      store.settings.skin = preview.skin;
      store.settings.trail = preview.trail;
      saveStore();
      hooks.onLook();
    }
    render();
  };

  const looks = () => {
    const sec = el('section', 'panel-sec');
    sec.append(el('h3', '', 'Skins & trails'));
    const wrap = el('div', 'look');
    const pickers = el('div', 'look-pickers');
    pickers.append(
      chips('Ball', SKINS, preview.skin, (id) => setLook(cleanLook(id, preview.trail))),
      chips('Trail', TRAILS, preview.trail, (id) => setLook(cleanLook(preview.skin, id))),
    );
    if (!has('skins') && (preview.skin !== 'classic' || preview.trail !== 'classic')) {
      pickers.append(el('p', 'hint', 'Preview only. Unlock Skins & Trails to use it in every sim.'));
    }
    wrap.append(frame, pickers);
    sec.append(wrap);
    return sec;
  };

  const footer = () => {
    const f = el('section', 'panel-sec');
    if (canBuy()) {
      const r = el('button', 'link', busy === 'restore' ? 'Restoring…' : 'Restore purchases');
      r.disabled = busy !== null;
      r.onclick = () => void restoreAll();
      f.append(r);
    }
    f.append(
      el('p', 'small', 'Shared sims always play in full for everyone, extras or not. Points stay a score: they can\'t be bought.'),
    );
    return f;
  };

  // A real battle sim, zoomed in on the ring so the skins are big enough to see.
  const startPreview = (): void => {
    const r = new Renderer(canvas);
    r.look = preview;
    renderer = r;
    const restart = () => {
      sim = createSim({ ...PREVIEW_SPEC, colors: [...PREVIEW_SPEC.colors] });
      r.reset();
    };
    restart();
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      // Stops once this screen's preview is gone (closed, or replaced by a newer Extras screen).
      if (!frame.isConnected) return;
      const size = frame.clientWidth;
      const k = size / VIEW;
      canvas.style.width = `${1080 * k}px`;
      canvas.style.left = `${-(CX - VIEW / 2) * k}px`;
      canvas.style.top = `${-(CY - VIEW / 2) * k}px`;
      r.resize(1080 * k, window.devicePixelRatio || 1);
      acc = Math.min(acc + (now - last) / 1000, 0.1);
      last = now;
      while (acc >= 1 / 60) {
        acc -= 1 / 60;
        r.track(sim, sim.stepFrame());
        if (sim.result || sim.seconds > 14) restart();
      }
      r.draw(sim, { title: '', hideContestants: false, showResult: false, time: now / 1000 });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };

  const render = (): void => {
    root.replaceChildren(header(), intro(), products(), looks(), footer());
  };

  // main.ts redraws the game on shop changes; this screen only re-renders itself.
  const stopListening = onShopChange(() => {
    if (!root.isConnected || root.hidden) return;
    render();
  });

  render();
  startPreview();
  refreshShop();
  if (focus) root.querySelector('.product.focus')?.scrollIntoView({ block: 'center' });
}
