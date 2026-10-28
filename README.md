# Orbit Arena

Satisfying physics sims you can play: pick a color, a country, a marble or an escape time, watch the run, and
share it. Every bounce plays the next note of a public-domain melody. Companion app to the Orbit Arena channels
([YouTube](https://www.youtube.com/@orbit_arena) · [TikTok](https://www.tiktok.com/@orbit_arena) ·
[Instagram](https://www.instagram.com/orbitarena_/)).

- **Web:** https://lindellrhett-gif.github.io/orbit-arena/ (installable PWA, works offline)
- **iOS:** Expo app in `mobile/`, built with EAS (see below)

## Develop

Needs Node 22.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit + determinism tests (Node)
npm run build        # typecheck + production build into dist/
```

Other scripts:

| Command | What it does |
|---|---|
| `npm run test:browsers` | Runs the determinism cases in Chromium, Firefox and WebKit and compares with the Node snapshots |
| `npm run snapshots:update` | Re-records determinism snapshots. Only after an intended physics change; then also run `npm run daily` |
| `npm run daily [start] [days]` | Pre-computes daily sim seeds into `src/data/daily.json` (defaults: today, 430 days) |
| `node scripts/screens.mjs <dir>` | Phone-size screenshots of every kind (after `npm run build`) |
| `node tests/browser/perf.mjs 4` | 150-ball stress test with a 4x CPU slowdown |
| `npx vite-node scripts/survey.ts battle 30` | Run lengths per kind, for tuning |
| `npm run flags` | Re-packs the flag sprite sheet from flag-icons |
| `npm run build:native` | Builds the single-file game for the iOS app into `mobile/src/webApp.ts` |

## iOS (Expo + EAS)

The iOS app in `mobile/` is an Expo SDK 57 app: a full-screen WebView showing the game, bundled as one offline HTML
file (`mobile/src/webApp.ts`, generated), plus native haptics, the share sheet, durable storage and silent-switch audio.
It builds, signs and submits with EAS from Windows, like Rust Strength.

After changing the web app, regenerate the bundled game and commit it (CI fails if it's stale):

```bash
npm run build:native
```

First time only, from `mobile/`:

```bash
npm install
npx eas-cli@latest init
```

`eas init` links the project to your Expo account and writes its `projectId` into `app.json`. The bundle ID
`com.rhettlindell.orbitarena` is new, so the first build needs the one interactive Apple sign-in that lets EAS create
the identifier and provisioning profile. After that, answer **No** to the Apple login prompt and EAS reuses the stored
credentials.

Build and submit (from `mobile/`):

```bash
npx eas-cli@latest build --platform ios --profile production
```

```bash
npx eas-cli@latest submit --platform ios --latest
```

For submit, copy the `submit.production.ios` block (App Store Connect API key path, key ID, issuer ID) from your other
apps' `eas.json` into `mobile/eas.json`, and create the app in App Store Connect first (My Apps → + → New App, pick the
bundle ID). `--profile development` builds a dev client for your iPhone; `--profile preview` an internal build.

## How it works

- `src/sim/`: the deterministic engine. `physics.ts` (contacts), `sim.ts` (escape, battle, race), `dmath.ts`
  (bit-exact trig), `rng.ts` (seeded sfc32), `seeds.ts` (seed search), `spec.ts` (spec format and share links).
  A run is fully determined by its spec and seed.
- `src/render/`: Canvas 2D drawing in the channel's look (1080x1920 logical canvas).
- `src/audio/`: Web Audio synth and the public-domain melodies.
- `src/app/`: feed (daily + random sims, picks), on-device store, the bridge to the iOS app.
- `mobile/`: the Expo iOS app (`App.tsx` is the native side of the bridge).
- `docs/DECISIONS.md`: why things are built this way.

## Rules

- Melodies: public domain only, synthesized in the app. No modern, film or game music, even "just the notes".
- Points are a score only: nothing is wagered, bought or spent.
- No personal data, no accounts, no tracking. See `public/privacy.html`.
- Flags: flag-icons (MIT), see `src/assets/flags/SOURCE.md`.
