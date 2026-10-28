// Native extras when running inside the iOS app (an Expo app that shows this page in a WebView), web fallbacks
// otherwise. The app talks to the native side with postMessage; see mobile/App.tsx for the other end.

type NativeMessage =
  | { type: 'haptic'; kind: 'light' | 'success' | 'warning' }
  | { type: 'share'; text: string; url: string }
  | { type: 'save'; key: string; value: string }
  | { type: 'open'; url: string }
  | { type: 'file-start'; id: string; name: string; mime: string }
  | { type: 'file-chunk'; id: string; data: string }
  | { type: 'file-end'; id: string };

type NativeWindow = Window & {
  ReactNativeWebView?: { postMessage(data: string): void };
  /** Set by the native app before the page loads: saved values from durable storage. */
  __ORBIT_NATIVE__?: { saved: Record<string, string> };
};

const w = (typeof window === 'undefined' ? {} : window) as NativeWindow;
export const isNative = Boolean(w.__ORBIT_NATIVE__);

function post(msg: NativeMessage): void {
  w.ReactNativeWebView?.postMessage(JSON.stringify(msg));
}

export function tapHaptic(): void {
  if (isNative) post({ type: 'haptic', kind: 'light' });
}

export function resultHaptic(won: boolean): void {
  if (isNative) post({ type: 'haptic', kind: won ? 'success' : 'warning' });
}

/** Opens the share sheet. Returns 'shared', 'copied' or 'failed'. */
export async function shareLink(text: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
  if (isNative) {
    post({ type: 'share', text, url });
    return 'shared';
  }
  try {
    if (navigator.share) {
      await navigator.share({ text, url });
      return 'shared';
    }
  } catch (err) {
    // The user closing the sheet counts as done, not as an error.
    if ((err as Error)?.name === 'AbortError') return 'shared';
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export async function loadValue(key: string): Promise<string | null> {
  const saved = w.__ORBIT_NATIVE__?.saved[key];
  if (saved) return saved;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function saveValue(key: string, value: string): void {
  if (isNative) post({ type: 'save', key, value });
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or storage blocked: the app still works, it just won't remember.
  }
}

export function openExternal(url: string): void {
  if (isNative) post({ type: 'open', url });
  else window.open(url, '_blank', 'noopener');
}

/** Bytes per message; a multiple of 3 so the base64 pieces join into one valid string. */
const FILE_CHUNK = 3 * 170_000;

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Sends a file (a recorded video or a picture) to the iOS app, which saves it and opens the share sheet. */
export async function sendFile(blob: Blob, name: string): Promise<void> {
  const id = `${Date.now()}`;
  post({ type: 'file-start', id, name, mime: blob.type });
  for (let off = 0; off < blob.size; off += FILE_CHUNK) {
    const buf = new Uint8Array(await blob.slice(off, off + FILE_CHUNK).arrayBuffer());
    post({ type: 'file-chunk', id, data: toBase64(buf) });
  }
  post({ type: 'file-end', id });
}
