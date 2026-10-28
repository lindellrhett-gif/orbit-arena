// The iOS app: the Orbit Arena game (built from the web app into one HTML file) in a full-screen WebView, plus
// the native bits the page asks for over postMessage: haptics, the share sheet, durable storage and opening links.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { WEB_APP_HTML } from './src/webApp';

void SplashScreen.preventAutoHideAsync();

const STORE_KEYS = ['orbit-arena:v1'];
// Pages load as if from the website, so share links and the privacy page resolve to the live site.
const BASE_URL = 'https://lindellrhett-gif.github.io/orbit-arena/';
const BG = '#07080e';

type Message =
  | { type: 'haptic'; kind: 'light' | 'success' | 'warning' }
  | { type: 'share'; text: string; url: string }
  | { type: 'save'; key: string; value: string }
  | { type: 'open'; url: string };

export default function App() {
  const [saved, setSaved] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    // Play bounce notes even with the silent switch on, mixed with any music the user is playing.
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    void AsyncStorage.multiGet(STORE_KEYS)
      .then((pairs) => {
        const out: Record<string, string> = {};
        for (const [k, v] of pairs) if (v !== null) out[k] = v;
        setSaved(out);
      })
      .catch(() => setSaved({}));
  }, []);

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
    }
  };

  if (!saved) return <View style={styles.root} />;

  const boot = `window.__ORBIT_NATIVE__ = ${JSON.stringify({ saved })}; true;`;
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <WebView
        style={styles.web}
        source={{ html: WEB_APP_HTML, baseUrl: BASE_URL }}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={boot}
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
