// Paid extras: one-time unlocks sold only in the apps, through Apple on iOS and Google Play on Android (the store
// runs on the native side of the bridge, see mobile/App.tsx). They change looks and what you can make, never the
// physics, picks or points, and a shared sim always plays in full for everyone. On the web the extras show as locked,
// pointing to the apps.

import { bootOwned, isNative, nativePlatform, onNative, postNative, type FromNative } from './platform';

export type Unlock = 'hd' | 'skins' | 'melodies' | 'slots';
export type ProductId = Unlock | 'everything';

/** App Store and Google Play product IDs are this prefix plus the ProductId. They can never be changed or reused. */
export const STORE_ID_PREFIX = 'com.rhettlindell.orbitarena.';

/** The store pages the web version's Extras screen links to; null until that app is live. */
export const IOS_APP_URL: string | null = 'https://apps.apple.com/app/id6828600863';
export const ANDROID_APP_URL: string | null = null; // 'https://play.google.com/store/apps/details?id=com.rhettlindell.orbitarena'

/** The store the app buys through, for the Extras screen's wording. */
export const STORE = nativePlatform === 'android'
  ? { by: 'Google Play', account: 'Google account', name: 'Google Play' }
  : { by: 'Apple', account: 'Apple ID', name: 'the App Store' };

export type Product = { id: ProductId; name: string; blurb: string; unlocks: Unlock[] };

export const PRODUCTS: Product[] = [
  { id: 'everything', name: 'Everything', blurb: 'All four extras below in one purchase.', unlocks: ['hd', 'skins', 'melodies', 'slots'] },
  { id: 'hd', name: 'HD Export', blurb: 'Save videos in full 1080p with no watermark.', unlocks: ['hd'] },
  { id: 'skins', name: 'Skins & Trails', blurb: 'New ball styles and trail effects for every sim.', unlocks: ['skins'] },
  { id: 'melodies', name: 'Melody Pack', blurb: '8 more public-domain classics for your own sims.', unlocks: ['melodies'] },
  { id: 'slots', name: 'Unlimited Slots', blurb: 'Save as many of your own sims as you like.', unlocks: ['slots'] },
];

const IDS = new Set<string>(PRODUCTS.map((p) => p.id));

export type BuyStatus = 'bought' | 'restored' | 'cancelled' | 'pending' | 'failed' | 'unavailable';

export const shop = {
  /** Products this device owns (verified by the store on the native side). */
  owned: new Set<ProductId>(bootOwned.filter((id): id is ProductId => IDS.has(id))),
  /** Localized prices from the store, e.g. "$1.99" or "1,99 €". Empty until the store answers. */
  prices: {} as Partial<Record<ProductId, string>>,
  /** The store answered and purchases are possible. */
  ready: false,
};

const listeners = new Set<() => void>();
let pending: { id: string; done: (s: BuyStatus) => void } | null = null;

export function onShopChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function changed(): void {
  for (const fn of listeners) fn();
}

export function has(unlock: Unlock): boolean {
  return shop.owned.has(unlock) || shop.owned.has('everything');
}

export function owns(id: ProductId): boolean {
  return id === 'everything' ? shop.owned.has('everything') : has(id);
}

/** Purchases happen only in the apps. */
export const canBuy = (): boolean => isNative;

function receive(msg: FromNative): void {
  if (msg.type === 'iap-state') {
    shop.ready = msg.ready;
    shop.owned = new Set(msg.owned.filter((id): id is ProductId => IDS.has(id)));
    shop.prices = Object.fromEntries(Object.entries(msg.prices).filter(([id]) => IDS.has(id)));
    changed();
  } else if (msg.type === 'iap-result' && pending?.id === msg.id) {
    const p = pending;
    pending = null;
    p.done(msg.status);
  }
}

/** How long to wait for the native side before giving up on a request (the store's sheet can stay open a while). */
const BUY_TIMEOUT_MS = 5 * 60_000;
const RESTORE_TIMEOUT_MS = 90_000;

function request(id: string, timeoutMs: number, send: () => void): Promise<BuyStatus> {
  if (!isNative || pending) return Promise.resolve('unavailable');
  return new Promise((done) => {
    // If no answer ever comes (the web view reloaded, a message was lost), stop waiting so the Extras screen
    // doesn't stay stuck. A purchase that still completes unlocks through the next iap-state.
    const timer = setTimeout(() => {
      if (pending?.done === finish) {
        pending = null;
        done('unavailable');
      }
    }, timeoutMs);
    const finish = (s: BuyStatus) => {
      clearTimeout(timer);
      done(s);
    };
    pending = { id, done: finish };
    send();
  });
}

export function buy(id: ProductId): Promise<BuyStatus> {
  return request(id, BUY_TIMEOUT_MS, () => postNative({ type: 'iap-buy', id }));
}

export function restore(): Promise<BuyStatus> {
  return request('restore', RESTORE_TIMEOUT_MS, () => postNative({ type: 'iap-restore' }));
}

/** Asks the native app for prices and purchases again (it reconnects to the store if launch couldn't). */
export function refreshShop(): void {
  if (isNative) postNative({ type: 'iap-init' });
}

/** Connects to the store through the native app (prices and current purchases arrive as an iap-state). */
export function initShop(): void {
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('unlock') === 'all') {
    shop.owned.add('everything'); // local testing only; never in a production build
  }
  if (!isNative) return;
  onNative(receive);
  postNative({ type: 'iap-init' });
}
