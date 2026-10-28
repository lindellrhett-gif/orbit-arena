import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rhettlindell.orbitarena',
  appName: 'Orbit Arena',
  webDir: 'dist',
  backgroundColor: '#07080e',
  ios: {
    contentInset: 'never',
    scrollEnabled: false,
    backgroundColor: '#07080e',
    preferredContentMode: 'mobile',
  },
};

export default config;
