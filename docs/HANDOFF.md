# Orbit Arena: handoff to a local session

Written 2026-10-30, when work moved from a cloud session to a local Claude Code session on Rhett's Windows PC.
Read this first, then `README.md` and `docs/DECISIONS.md`.

## Rules (from Rhett, they/them)

- **Never credit Claude or Claude Code anywhere:** no `Co-Authored-By`, no "Generated with Claude Code" in commits or
  PRs, nothing in docs, code comments or the app. Commits are authored as
  `Rhett Lindell <324652555+lindellrhett-gif@users.noreply.github.com>`.
- Low involvement: make sensible calls and check in at phase boundaries. Ask only about money, accounts, store
  submissions and naming. Rhett does every login; never ask for or type passwords, tokens or keys.
- Brand rules from the original brief still apply: public-domain melodies only (never film, game or pop themes),
  points are a score only (nothing bought or wagered), no personal data, kid-safe.
- Rhett answers Apple-login prompts in EAS with **No** (Apple ID logins have locked the account). The one exception
  was the first build for the new bundle ID, already done.

## Where things are

| What | Where |
|---|---|
| Repo | https://github.com/lindellrhett-gif/orbit-arena (public), cloned at `C:\Users\linde\Desktop\OrbitArenaApp` |
| Live web app | https://lindellrhett-gif.github.io/orbit-arena/ (GitHub Pages, deployed by `.github/workflows/pages.yml` on push to `main`) |
| iOS app | `mobile/` (Expo SDK 57). EAS project `@rhettl08/orbit-arena`, projectId `4f03c308-003a-445e-a0f9-f17c970a4bd1`, bundle ID `com.rhettlindell.orbitarena`, Apple team `V7YLBXSTX2` |
| App Store Connect | App "Orbit Arena" created by EAS, TestFlight group "Team (Expo)" with rhettlindell@icloud.com |
| ASC API key | A `.p8` in `C:\Users\linde\.appstore\` (enter the path **without quotes** at EAS prompts) |
| Social-media workspace | `C:\Users\linde\Desktop\ClaudeSocialMedia` (read only, except a small spec importer if the submission loop needs one). Has `scripts/orbit.py`, the reference engine the cloud session never saw |
| Original brief | `APP_BUILD_PROMPT.md` in the social-media workspace (sections 1-10) |

## Status

- **Phase 0 (decisions):** done. iOS first, public repo on GitHub Pages, free github.io URL, no ads in Phase 1-2,
  then IAP and rewarded ads (Rhett's default), name "Orbit Arena", bundle ID approved.
- **Phase 1:** done. Escape, battle (colors and countries) and race, pick mode with streaks, share links,
  determinism tests, PWA, iOS shell.
- **Phase 2:** done in code and live on the web. All 7 kinds, over/under picks, sandbox with 5 saved slots,
  video export, daily challenge panel, submit-your-sim YAML. Version 0.2.0.
- **iOS:** the first EAS production build was **running** at handoff (2026-10-30). Next: `eas submit`, then
  TestFlight.

## Immediately next

1. **Check the EAS build.** If it failed, read the build log (Rhett can paste the link). Likely suspects in a first
   build: `npm ci` in `mobile/` (lockfile made on Linux with npm 10), or the `overrides` pin of `expo-asset`
   (`~57.0.20`; without it expo-audio pulls SDK 58's expo-asset and Metro fails).
2. **Submit:** `npx eas-cli@latest submit --platform ios --latest --non-interactive` from `mobile/`. `ascAppId`
   6828600863 is in `mobile/eas.json` (without it EAS asks for an Apple login), and EAS uses the API key stored on
   its servers. Don't set the `EXPO_ASC_*` variables: on 2026-10-30 that local key got a 401 from Apple.
   - Build 0.2.0 (1) was already uploaded before 2026-10-30; resubmitting it fails with "build number already
     used". The next production build gets build 2 automatically.
3. **Rhett tests on iPhone via TestFlight**, against the list in the cloud session's last instructions:
   - Sound after the first tap, including with the silent switch on.
   - Haptics.
   - The share sheet.
   - **Save video**: recording inside WKWebView is unverified; the file goes over the postMessage bridge in chunks
     to expo-file-system and expo-sharing.
   - Build your own.
   - Data surviving a restart.
   - Airplane mode.
4. **Read `scripts/orbit.py`** (now reachable locally) and align:
   - Done 2026-10-30: `src/app/submit.ts` YAML (orbit.py's keys and units, checked with `--dry`) and the melody
     note lists in `src/audio/melodies.ts` (now orbit.py's `MELODIES`). See `docs/DECISIONS.md`.
   - Still open: colors, and anything else in the look that's off. Also the sound around the melody: orbit.py's
     end chord is built on the current note, and an elimination replays the current note instead of a low thud.
   - Optionally render a reference frame per kind (`.venv\Scripts\python scripts\orbit.py <spec.yaml> --preview`)
     and compare side by side.
5. **Phase 1/2 report items still open:** the bio links (Rhett: Instagram and YouTube now; TikTok only after
   1,000 followers since it stays a Personal account), and the message to the channel session about
   "Play it yourself: link in bio".

## Open questions for Rhett

- Submissions: keep "copy and post in a comment or DM", or build a real inbox (stores viewer text, so moderation
  and privacy are involved)?
- Phase 3: go-ahead, and anything ruled out:
  - Ads: AdMob, non-personalized, only between sims.
  - IAP: remove ads, HD export without watermark, skins and trails, more public-domain melodies, unlimited sandbox
    slots. Probably via RevenueCat or StoreKit through Expo.
  - Store listing: screenshots, description, age rating, privacy label "Data Not Collected".
  - Each of these needs Rhett's accounts.

## Working locally on Windows

```bash
cd ~/Desktop/OrbitArenaApp
```
```bash
git pull
```
```bash
npm install
```
```bash
npm test
```
```bash
npm run dev
```

- **Node 22+.** The root `.npmrc` sets `legacy-peer-deps=true` (npm hit a peer-resolution crash installing Vitest
  without it).
- **After any change to the web app,** run `npm run build:native` and commit the regenerated
  `mobile/src/webApp.ts`. CI fails if it's stale.
- **The physics is locked by snapshots.** `tests/determinism.snap.json` must stay unchanged unless a physics change
  is intended. If it is: `npm run snapshots:update`, then `npm run daily` (re-picks 430 days of daily seeds,
  ~20 s), then bump `ENGINE_VERSION` in `src/sim/spec.ts` if old share links would replay differently.
- **Cross-browser determinism** runs in CI (Chromium, Firefox, WebKit) and reports each browser as a run annotation.
  Locally: `npx playwright install chromium firefox webkit`, then `npm run build`, then `npm run test:browsers`.
- **Engine determinism rules:**
  - Only `+ - * /` and `Math.sqrt` in `src/sim/`.
  - Trig only via `src/sim/dmath.ts`.
  - Never `**`, `Math.pow`, `Math.hypot` or `Math.random` in sim code.
  - Each new random stream gets its own `makeRng(seed, stream)`. Streams 0 (main), 1 (race slots) and 2
    (over/under line) are taken.
- **`scripts/copy-flags.mjs`** (re-pack flags) calls ImageMagick's `convert`, which Windows doesn't have by default.
  It's only needed when upgrading flag-icons.
- **iOS builds** run on EAS (no Mac). `mobile/` follows Expo's CNG: never commit `ios/`. Install native modules with
  `npx expo install <pkg>` so versions match SDK 57. Any new native module needs a new EAS build; JS-only changes
  can also ship by rebuilding.
- **Dev build for the iPhone:** `npx eas-cli@latest build --platform ios --profile development` (expo-dev-client
  is included).

## Map of the code

- `src/sim/`: deterministic engine.
  - `base.ts` (Sim class, events, results, fingerprint), `kinds/*.ts` (one per kind), `physics.ts` (contacts),
    `seeds.ts` (`pickSeed`, `pickSeedWithin`), `spec.ts` (spec format, defaults, share links).
- `src/render/renderer.ts`: Canvas 2D look (1080x1920 logical). `src/render/flags.ts`: the flag sprite sheet.
- `src/audio/`: Web Audio synth (Karplus-Strong plus bell, reverb, a recordable stream) and the melodies.
- `src/app/`:
  - `feed.ts`: daily and random sims, picks, over/under lines.
  - `builder.ts`: the sandbox.
  - `export.ts`: MediaRecorder video export.
  - `submit.ts`: YAML for submissions.
  - `store.ts`: on-device stats, daily log, saved sims.
  - `platform.ts`: web and native bridge.
- `src/main.ts`: UI controller and loop.
- `mobile/App.tsx`: the native side of the bridge:
  - The WebView with the inlined game.
  - Haptics, the share sheet, AsyncStorage and opening links.
  - Receiving files in chunks and sharing them.
  - Audio set to play with the silent switch on.
- `scripts/`:
  - `build-daily.ts`, `survey.ts` (run lengths, for tuning).
  - `screens.mjs` (phone screenshots).
  - `link-to-yaml.ts` (for the channel).
  - `build-native.mjs`, `copy-flags.mjs`.
- `tests/`:
  - Unit tests and determinism snapshots (11 configurations x 20 seeds).
  - `browser/` for the cross-browser harness and the 150-ball perf test (`node tests/browser/perf.mjs 4`).
- `docs/DECISIONS.md`: why each technical choice was made. Keep it and `CHANGELOG.md` up to date.

## Known gaps

- The flags come from flag-icons (MIT), not flagcdn (blocked in the cloud). US state flags are missing. Locally,
  the channel's `assets/flags/png` could replace the sheet if Rhett prefers the channel's exact flags.
- The race has orbit.py's leader bias. Slot shuffling keeps it fair across seeds, and the start order is hidden
  before the pick.
- Headless Chromium records MP4 with VP9. Branded Chrome and Safari give H.264.
- In Expo production builds, the dev-client plugin adds `NSLocalNetworkUsageDescription` and Bonjour keys. They're
  harmless (only prompted when used), but can be stripped in Phase 3 if App Review asks.
- There are no analytics. Adding any (GoatCounter or Cloudflare Web Analytics) is Rhett's call, and
  `public/privacy.html` has to change first.
