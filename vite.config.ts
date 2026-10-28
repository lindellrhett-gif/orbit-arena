/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // Relative paths work both on GitHub Pages (/orbit-arena/) and inside the iOS app.
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    target: 'es2020',
    rollupOptions: { input: { main: 'index.html' } },
  },
  plugins: [
    VitePWA({
      injectRegister: false,
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'privacy.html'],
      manifest: {
        name: 'Orbit Arena',
        short_name: 'Orbit Arena',
        description: 'Satisfying physics sims you can play. Pick a color, watch it bounce, share the result.',
        theme_color: '#07080e',
        background_color: '#07080e',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,json}'],
        globIgnores: ['**/determinism*'],
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
    }),
  ],
  test: { include: ['tests/**/*.test.ts'] },
});
