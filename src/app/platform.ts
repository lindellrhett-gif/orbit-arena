// Native extras (haptics, share sheet, durable storage) when running inside the iOS app; web fallbacks otherwise.

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';

export const isNative = Capacitor.isNativePlatform();

export function tapHaptic(): void {
  if (isNative) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

export function resultHaptic(won: boolean): void {
  if (isNative) void Haptics.notification({ type: won ? NotificationType.Success : NotificationType.Warning }).catch(() => {});
}

/** Opens the share sheet. Returns 'shared', 'copied' or 'failed'. */
export async function shareLink(text: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (isNative) {
      await Share.share({ text, url, dialogTitle: 'Share this sim' });
      return 'shared';
    }
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
  if (isNative) {
    const { value } = await Preferences.get({ key });
    if (value !== null) return value;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function saveValue(key: string, value: string): void {
  if (isNative) void Preferences.set({ key, value });
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or storage blocked: the app still works, it just won't remember.
  }
}

export function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener');
}
