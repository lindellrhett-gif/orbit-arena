# Orbit Arena

Satisfying physics sims you can play: pick a color, a country, a marble or an escape time, watch the run, and
share it. Every bounce plays the next note of a public-domain melody. Companion app to the Orbit Arena channels
([YouTube](https://www.youtube.com/@orbit_arena) · [TikTok](https://www.tiktok.com/@orbit_arena) ·
[Instagram](https://www.instagram.com/orbitarena_/)).

- **Web:** https://lindellrhett-gif.github.io/orbit-arena/ (installable PWA, works offline)
- **iOS:** Capacitor project in `ios/` (see below)

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
| `npm run flags` | Re-rasterizes flags from flag-icons |

## iOS

The iOS app is the web build inside a Capacitor shell (haptics, native share sheet, durable storage).

```bash
npm run ios:sync     # build the web app and copy it into ios/
npx cap open ios     # opens Xcode (macOS)
```

In Xcode: select the **App** target → Signing & Capabilities → pick your team. Bundle ID is
`com.rhettlindell.orbitarena` (change it there and in `capacitor.config.ts` if you use another prefix). Run on a
device or simulator, or Product → Archive to upload to App Store Connect. CI builds the app for the simulator on every
push to prove it compiles.

## How it works

- `src/sim/`: the deterministic engine. `physics.ts` (contacts), `sim.ts` (escape, battle, race), `dmath.ts`
  (bit-exact trig), `rng.ts` (seeded sfc32), `seeds.ts` (seed search), `spec.ts` (spec format and share links).
  A run is fully determined by its spec and seed.
- `src/render/`: Canvas 2D drawing in the channel's look (1080x1920 logical canvas).
- `src/audio/`: Web Audio synth and the public-domain melodies.
- `src/app/`: feed (daily + random sims, picks), on-device store, native bridges.
- `docs/DECISIONS.md`: why things are built this way.

## Rules

- Melodies: public domain only, synthesized in the app. No modern, film or game music, even "just the notes".
- Points are a score only: nothing is wagered, bought or spent.
- No personal data, no accounts, no tracking. See `public/privacy.html`.
- Flags: flag-icons (MIT), see `public/flags/SOURCE.md`.
