// Builds the game as one self-contained HTML file (scripts, styles, fonts and the flag sheet inlined) for the iOS
// app, which shows it in a WebView with no network needed. Run through: npm run build:native
import { defineConfig, mergeConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import base from './vite.config';

export default mergeConfig(
  { ...base, plugins: [] },
  defineConfig({
    build: { outDir: 'dist-native', assetsInlineLimit: () => true, cssCodeSplit: false },
    plugins: [viteSingleFile()],
  }),
);
