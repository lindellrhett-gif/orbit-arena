// The iOS app: the Orbit Arena game (built from the web app into one HTML file) in a full-screen WebView, plus
// the native bits the page asks for over postMessage: haptics, the share sheet, durable storage, opening links and
// in-app purchases (StoreKit, through expo-iap).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import {
  ErrorCode, endConnection, fetchProducts, finishTransaction, getAvailablePurchases, initConnection,
  purchaseErrorListener, purchaseUpdatedListener, requestPurchase, restorePurchases,
} from 'expo-iap';
import * as Sharing from 'expo-sharing';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { WEB_APP_HTML } from './src/webApp';

void SplashScreen.preventAutoHideAsync();

const STORE_KEYS = ['orbit-arena:v1'];
// One-time unlocks (see src/app/shop.ts). App Store product IDs are the prefix plus the short id.
const STORE_PREFIX = 'com.rhettlindell.orbitarena.';
const PRODUCT_IDS = ['everything', 'hd', 'skins', 'melodies', 'slots'];
// What's owned, cached so unlocks show from the first frame and work offline; StoreKit refreshes it at launch.
const OWNED_KEY = 'orbit-arena:owned';
// Pages load as if from the website, so share links and the privacy page resolve to the live site.
const BASE_URL = 'https://lindellrhett-gif.github.io/orbit-arena/';
const BG = '#07080e';

type Message =
  | { type: 'haptic'; kind: 'light' | 'success' | 'warning' }
  | { type: 'share'; text: string; url: string }
  | { type: 'save'; key: string; value: string }
  | { type: 'open'; url: string }
  | { type: 'file-start'; id: string; name: string; mime: string }
  | { type: 'file-chunk'; id: string; data: string }
  | { type: 'file-end'; id: string }
  | { type: 'iap-init' }
  | { type: 'iap-buy'; id: string }
  | { type: 'iap-restore' };

type BuyStatus = 'bought' | 'restored' | 'cancelled' | 'pending' | 'failed';

const UTI: Record<string, string> = { 'video/mp4': 'public.mpeg-4', 'image/png': 'public.png' };

const shortId = (sku: string): string | null => {
  const id = sku.startsWith(STORE_PREFIX) ? sku.slice(STORE_PREFIX.length) : '';
  return PRODUCT_IDS.includes(id) ? id : null;
};

export default function App() {
  const [boot, setBoot] = useState<{ saved: Record<string, string>; owned: string[] } | null>(null);
  // Exported videos arrive from the page in base64 chunks, are written to the cache, then shared.
  const incoming = useRef<{ id: string; file: File; mime: string } | null>(null);
  const web = useRef<WebView>(null);
  const iap = useRef({ ready: false, owned: [] as string[], prices: {} as Record<string, string>, buying: null as string | null });

  /** Delivers a message to the page (see onNative in src/app/platform.ts). */
  const toPage = (msg: object) => {
    web.current?.injectJavaScript(`window.__orbitFromNative && window.__orbitFromNative(${JSON.stringify(msg)}); true;`);
  };
  const sendState = () => {
    const { ready, owned, prices } = iap.current;
    toPage({ type: 'iap-state', ready, owned, prices });
  };
  const sendResult = (id: string, status: BuyStatus) => toPage({ type: 'iap-result', id, status });
  const setOwned = (owned: string[]) => {
    iap.current.owned = [...new Set(owned)];
    void AsyncStorage.setItem(OWNED_KEY, JSON.stringify(iap.current.owned)).catch(() => {});
    sendState();
  };
  /** Non-consumables StoreKit still holds for this Apple ID (StoreKit 2 verifies them on the device). */
  const refreshOwned = async () => {
    const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
    setOwned(purchases.map((p) => shortId(p.productId)).filter((id): id is string => id !== null));
  };
  const connectStore = async () => {
    if (!iap.current.ready) {
      try {
        await initConnection();
        const products = await fetchProducts({ skus: PRODUCT_IDS.map((id) => STORE_PREFIX + id), type: 'in-app' });
        const prices: Record<string, string> = {};
        for (const p of products ?? []) {
          const id = shortId(p.id);
          if (id) prices[id] = p.displayPrice;
        }
        iap.current.prices = prices;
        iap.current.ready = Object.keys(prices).length > 0;
        await refreshOwned();
      } catch {
        // Offline or the store is unavailable: cached purchases still apply, and buying waits for next time.
      }
    }
    sendState();
  };

  useEffect(() => {
    // Play bounce notes even with the silent switch on, mixed with any music the user is playing.
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    void AsyncStorage.multiGet([...STORE_KEYS, OWNED_KEY])
      .then((pairs) => {
        const saved: Record<string, string> = {};
        let owned: string[] = [];
        for (const [k, v] of pairs) {
          if (v === null) continue;
          if (k !== OWNED_KEY) saved[k] = v;
          else {
            try {
              owned = (JSON.parse(v) as string[]).filter((id) => PRODUCT_IDS.includes(id));
            } catch {
              owned = [];
            }
          }
        }
        iap.current.owned = owned;
        setBoot({ saved, owned });
      })
      .catch(() => setBoot({ saved: {}, owned: [] }));

    // Purchases, including ones approved later through Ask to Buy (StoreKit replays unfinished ones at launch).
    const bought = purchaseUpdatedListener((purchase) => {
      const id = shortId(purchase.productId);
      if (!id) return;
      if (purchase.purchaseState === 'pending') {
        if (iap.current.buying === id) sendResult(id, 'pending');
        return;
      }
      void finishTransaction({ purchase, isConsumable: false }).catch(() => {});
      setOwned([...iap.current.owned, id]);
      if (iap.current.buying === id) {
        iap.current.buying = null;
        sendResult(id, 'bought');
      }
    });
    const failed = purchaseErrorListener((error) => {
      const id = iap.current.buying;
      if (!id) return;
      iap.current.buying = null;
      const status: BuyStatus =
        error.code === ErrorCode.UserCancelled ? 'cancelled'
        : error.code === ErrorCode.DeferredPayment || error.code === ErrorCode.Pending ? 'pending'
        : 'failed';
      sendResult(id, status);
    });
    return () => {
      bought.remove();
      failed.remove();
      void endConnection().catch(() => {});
    };
  }, []);

  const buy = async (id: string) => {
    if (!PRODUCT_IDS.includes(id) || iap.current.buying) return;
    iap.current.buying = id;
    try {
      // The outcome arrives through the listeners above.
      await requestPurchase({ request: { apple: { sku: STORE_PREFIX + id } }, type: 'in-app' });
    } catch {
      if (iap.current.buying === id) {
        iap.current.buying = null;
        sendResult(id, 'failed');
      }
    }
  };

  /**
   * StoreKit 2 already keeps non-consumables on the device (Transaction.currentEntitlements), so restoring is
   * mostly reading them again. AppStore.sync() (restorePurchases) is only a best-effort extra: it asks for the
   * Apple ID and often fails in TestFlight or when the sign-in sheet is dismissed, and that must not hide
   * purchases StoreKit already holds.
   */
  const restore = async () => {
    if (!iap.current.ready) await connectStore();
    try {
      await restorePurchases();
    } catch {
      // Fall through: the entitlements read below decides the result.
    }
    try {
      await refreshOwned();
      sendResult('restore', 'restored');
    } catch {
      sendResult('restore', 'failed');
    }
  };

  const onMessage = (event: WebViewMessageEvent) => {
    let msg: Message;
    try {
      msg = JSON.parse(event.nativeEvent.data) as Message;
    } catch {
      return;
    }
    switch (msg.type) {
      case 'haptic':
        if (msg.kind === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        else {
          void Haptics.notificationAsync(
            msg.kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
          );
        }
        break;
      case 'share':
        void Share.share({ message: `${msg.text} ${msg.url}` }).catch(() => {});
        break;
      case 'save':
        if (STORE_KEYS.includes(msg.key)) void AsyncStorage.setItem(msg.key, msg.value);
        break;
      case 'open':
        if (/^https:\/\//.test(msg.url)) void Linking.openURL(msg.url);
        break;
      case 'file-start': {
        const safe = msg.name.replace(/[^A-Za-z0-9._-]/g, '_');
        const file = new File(Paths.cache, safe);
        if (file.exists) file.delete();
        file.create();
        incoming.current = { id: msg.id, file, mime: msg.mime };
        break;
      }
      case 'file-chunk':
        if (incoming.current?.id === msg.id) incoming.current.file.write(msg.data, { encoding: 'base64', append: true });
        break;
      case 'file-end': {
        const done = incoming.current;
        incoming.current = null;
        if (done?.id === msg.id) {
          void Sharing.shareAsync(done.file.uri, { mimeType: done.mime, UTI: UTI[done.mime] }).catch(() => {});
        }
        break;
      }
      case 'iap-init':
        void connectStore();
        break;
      case 'iap-buy':
        void buy(msg.id);
        break;
      case 'iap-restore':
        void restore();
        break;
    }
  };

  if (!boot) return <View style={styles.root} />;

  const bootScript = `window.__ORBIT_NATIVE__ = ${JSON.stringify(boot)}; true;`;
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <WebView
        ref={web}
        style={styles.web}
        source={{ html: WEB_APP_HTML, baseUrl: BASE_URL }}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={bootScript}
        onMessage={onMessage}
        onLoadEnd={() => void SplashScreen.hideAsync()}
        // Tapped links (socials, privacy) open in Safari instead of replacing the game.
        onShouldStartLoadWithRequest={(req) => {
          if (req.navigationType !== 'click') return true;
          void Linking.openURL(req.url);
          return false;
        }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        bounces={false}
        scrollEnabled={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        allowsBackForwardNavigationGestures={false}
        textInteractionEnabled={false}
        webviewDebuggingEnabled={__DEV__}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  web: { flex: 1, backgroundColor: BG },
});
