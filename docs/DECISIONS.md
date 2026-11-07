# Decisions

Short notes on why things are the way they are. Newest last.

## iOS first, as an Expo app around the web game (2026-10-28)
Rhett chose iOS first and builds on Windows with EAS (Expo's cloud Macs sign and submit with his Apple team). So the
iOS app is an Expo SDK 57 app whose screen is a WebView running the same TypeScript game (Canvas 2D + Web Audio),
bundled as one self-contained HTML file so it works offline. Native extras (haptics, share sheet, AsyncStorage,
audio in silent mode) go over postMessage (`src/app/platform.ts` ↔ `mobile/App.tsx`).
Why one game codebase rather than a native rewrite: share links open in a browser for people without the app, and they
must replay the *same* run; two physics implementations (Swift and TypeScript) would drift apart. It also keeps the
whole game testable headless, including the WebKit determinism test that stands in for iOS Safari.
A first cut used Capacitor, which needs Xcode to build, so it was replaced the same day.

## Custom physics engine instead of Rapier (2026-10-28)
The sims need circles, segments, rotating rings with a gap, spinning paddles and gravity, nothing more. A ~250-line
fixed-timestep engine (`src/sim/physics.ts`, 60 fps x 4 substeps like orbit.py) does that with full control over
determinism. JavaScript guarantees bit-exact `+ - * /` and `sqrt` on every engine, but not `Math.sin/cos/atan2` or `**`,
so the engine uses its own fdlibm-based trig (`src/sim/dmath.ts`) and never `**` or `Math.random`. Rapier's
deterministic WASM build would also work but adds a ~1.5 MB WASM download and an async init on first paint.

## Energy holding and jitter (2026-10-28)
Elastic bounces with gravity slowly gain or lose energy through contact pushes, and a perfectly elastic ball can fall
into a repeating path. After each ring bounce the ball's speed is reset to its starting energy and its direction gets a
tiny seeded nudge (±2-3°). Runs stay lively, bounded and varied, and are still fully determined by the seed.

## Race fairness (2026-10-28)
The marble that lands nearest the low end of the first ramp tends to lead all the way (orbit.py has the same issue
with its top-right slot). As in orbit.py, start slots are shuffled with a separate generator (`makeRng(seed, 1)`), so
every color wins equally often across seeds. On top of that, a peg field scrambles the drop, and the start order is
hidden until the viewer picks, so the layout can't give the answer away.

## Seeds and the daily sims (2026-10-28)
Seed search is orbit.py's `pick_seed`: dry-run seeds until the run ends inside the kind's target window (escape
15-40 s, battle 20-60 s, race 25-45 s). Daily specs come from the date alone; their seeds are pre-computed by
`npm run daily` into `src/data/daily.json` so phones never search. Random feed sims search on the device (a dry run
is 1-35 ms). A test checks that stored daily seeds still give good runs, so a physics change can't silently break them.

## Over/under picks for kinds without contestants (2026-10-28, replaced time buckets)
Escape, grow, multiply and blocks have no contestant to pick. Phase 1 used escape-time buckets (the target window in
thirds), but some kinds barely vary (multiply: 23-28 s for 100 balls), so buckets were lopsided. Now the viewer
guesses over or under a line placed 4-14% above or below the real result, on a side set by the seed
(`makeRng(seed, 2)`). Every guess is a fair 50/50 and always a close call, it works for any kind and any sandbox
settings, and shared links show the same line to everyone. Grow guesses bounces; the others guess seconds.

## Points are a score, not a currency (2026-10-28)
A correct pick earns 10 points per other option. Nothing is wagered, nothing is lost on a wrong pick, and points can't
be bought or spent. This keeps the app clear of anything that looks like gambling (App Store 5.3, kids audiences).

## Flags from flag-icons, in one sprite sheet (2026-10-28)
flagcdn.com (used by the channel) isn't reachable from the build environment. flag-icons (MIT) has square flags for
256 of the 306 codes in codes.json (all countries; not the US states). They're packed into one 16x16 sheet of 96 px
cells (190 KB WebP): one request on the web, and small enough to inline into the iOS app's single HTML file.

## Reduced motion doesn't slow the spin (2026-10-28)
Slowing the rings would change the physics, and a share link must replay the same run for everyone. Reduced motion
instead cuts particles and shortens trails.

## Share links point at the web build (2026-10-28)
`https://lindellrhett-gif.github.io/orbit-arena/?k=battle&s=129&...` opens in any browser. When the iOS app ships,
universal links (needs an `apple-app-site-association` file on a domain we control) can open them in the app instead.

## No analytics yet (2026-10-28)
Phase 1 ships with no analytics at all. Adding privacy-friendly analytics (GoatCounter or Cloudflare Web Analytics)
is Rhett's call and the privacy page has to change first.

## Sound plays in silent mode in the iOS app (2026-10-28)
The app sets the audio session to play with the silent switch on and to mix with other audio, because the bounce notes
are the point of the format (TikTok and Shorts behave the same way). The mute button in the app still silences it.
Microphone permission and background audio from the expo-audio plugin are turned off; the app doesn't use them.

## New kinds: tuning notes (2026-10-28)
- **grow:** with a fixed growth step the bounce count is the same for every seed (about 150), so there'd be nothing to
  guess. Each run's ball grows at its own rate (0.7-1.35x the setting, from the seed), and harder hits grow it more.
  The ball is fast (2200 px/s at the center) so a fill takes 15-35 s like the channel's.
- **multiply:** the first ball is 25x heavier with its own energy so the crowd can't smother it, and its bounces off
  other balls count too (at most one new ball per 0.1 s). 100 balls take about 25 s, 200 about 42 s.
- **orbit:** pull G/d² that grows 1.5% per second, 2% drag per second, and a closed outer ring so nobody leaves the
  screen. Touching the hole (its radius plus half your own) knocks you out.
- **blocks:** about 193 square blocks in a disc; the ball keeps a constant speed (no gravity) and splits every 15 hits,
  up to 6 balls.

## Video export (2026-10-28)
`canvas.captureStream(60)` plus the synth's `MediaStreamAudioDestinationNode`, recorded with MediaRecorder while the
run replays in real time onto a separate 720x1280 canvas (with the watermark). Format preference: H.264 MP4 (Chrome,
Safari, iOS 14.5+), any MP4, then WebM (Firefox). Headless Chromium here records MP4 with VP9; branded Chrome and
Safari produce H.264, which TikTok, Shorts and Reels all take. If MediaRecorder or captureStream is missing, the app
saves a PNG of the result and shares the link instead. In the iOS app the file is passed to the native side in
510 KB base64 chunks, written to the cache with expo-file-system, and opened in the share sheet with expo-sharing.
Free exports are 720p with the watermark; HD without it is a Phase 3 purchase.

## Submissions without a server (2026-10-28)
"Submit your sim" collects nothing. It shows an orbit.py-style YAML spec (no seed: the app's physics differs from
orbit.py, so the renderer picks its own with `--dry` as the playbook does) plus a cleaned credit name (letters,
numbers, space, `_ . @ -`, 24 characters), and the viewer copies it or shares the link into a comment or DM. The
channel already reads YouTube comments each run; `scripts/link-to-yaml.ts` turns a link into a spec. A real
submission inbox would mean storing user text, which is Rhett's call (kids audience, moderation).

## No free text in share links (2026-10-28)
Phase 1 links could carry a title (`t=`), which would let anyone put any words on screen for whoever opens the link.
Removed: titles always come from the spec, so the app never shows one person's typed text to another.

## Gravity and size multipliers (2026-10-28)
The sandbox's gravity and ball size are multipliers applied as `base * multiplier`. With the default of exactly 1
the results are bit-identical to before, so no existing link or daily seed changed.

## Melodies and submitted specs follow orbit.py (2026-10-30)
Once `scripts/orbit.py` could be read locally, the melodies were replaced with its `MELODIES` lists. The earlier
ones were transcribed by ear, and some were in other keys or longer. The channel and the app should play the same
tune. The submit YAML was rebuilt from orbit.py's code and the channel's real `sim.yaml` files. The app stores spin
in degrees per second and gravity and size as multipliers. orbit.py reads spin in radians per second, `gravity` in
px/s² (1500, race 900), `pull` for the black hole (2.6e7) and `ball_r` per kind, so `specToYaml` converts. `pull`
is written as an integer because PyYAML reads `2.6e7` as a string. Every generated spec was checked with
`orbit.py --dry`.

## Phase 3: extras through StoreKit, no ads (2026-11-01)
Rhett's calls: no ads for now, Apple StoreKit directly, five one-time unlocks (HD Export, Skins & Trails, Melody Pack,
Unlimited Slots, and Everything), and on the web the extras show locked with a pointer to the iOS app. No ads keeps
the App Store privacy label at "Data Not Collected" and avoids ad SDKs in an app with a young audience. StoreKit 2
verifies transactions on the device, so one-time unlocks need no server and no third party (RevenueCat would have
added an account and collected purchase data). The library is `expo-iap` (an Expo module; `react-native-iap` needs
Nitro modules). The page asks over the bridge (`iap-init`, `iap-buy`, `iap-restore`) and the native side answers
through `injectJavaScript` (`src/app/shop.ts` ↔ `mobile/App.tsx`). Owned product IDs are cached in AsyncStorage
(`orbit-arena:owned`) and passed in at launch, so unlocks show from the first frame and work offline; StoreKit
refreshes them every launch. Rules: extras change looks and what you can make, never the physics, picks or points,
and a shared sim always plays in full for everyone.

## Melody Pack without touching the daily sims (2026-11-01)
The date's RNG picks the daily melody by position in `feedMelodies`, so the eight pack tunes are appended after the
base list and filtered out unless asked for: the dailies don't shift and never use a pack tune. Owners get pack tunes
in the random feed. orbit.py doesn't have them, so a submitted spec falls back to `fur_elise` with a comment naming
the app's tune. The pack holds only tunes verified note for note (Minuet in G, Morning Mood, The Blue Danube, New
World Largo, Beethoven's 5th, Mozart's 40th, Frère Jacques, London Bridge). Swan Lake, Vivaldi's Spring and Brahms'
Lullaby were left out because their transcriptions couldn't be confirmed.

## Skins and trails are drawing only (2026-11-01)
Skins keep the team color readable (people pick by color) and live in the viewer's settings, not in share links.
The classic look draws exactly as before. Above 40 balls (only multiply gets there) the fancier ones draw lighter
versions: Sparkle glints only at each trail's head, Planet draws just the front of its ring, Neon one ring, and
Rainbow one cycling color per ball. Measured on a full 250-ball frame they cost 0 to 50% over classic; in normal sims
(up to 12 balls) the difference is under 1.5 ms. The planet ring is a pre-drawn sprite and the sparkle glints are plain
rectangles, the cheapest things a canvas draws.

## Dev-launcher keys stripped from store builds (2026-11-01)
expo-dev-client adds `NSLocalNetworkUsageDescription` and `NSBonjourServices` so development builds can find the dev
server. `mobile/plugins/withoutDevLauncherKeys.js` removes them unless `EAS_BUILD_PROFILE` is `development`, since
App Review asks about permissions an app declares but doesn't use. Checked with `npx expo config --type introspect`
(iOS prebuild itself doesn't run on Windows).

## Legal pages and launch countries (2026-11-06)
Open-source licenses ask for their notices to ship with the software, so `npm run licenses` writes
`public/licenses.html` from what's actually installed: the game's own third-party parts (flag-icons, the Saira font,
Workbox, fdlibm) and every production dependency of the iOS app, grouped by license. Nothing copyleft ships: the
MPL and dual GPL entries (lightningcss, node-forge) are build tools, and node-forge is used under its BSD option.
fdlibm's notice is a `/*!` comment kept in the minified build (`esbuild.legalComments: 'eof'`). `terms.html` covers
the risks specific to this app: points with no value (away from gambling rules), purchases under Apple's terms,
permission to repost submitted sims, flags for identification only, a photosensitivity warning and a liability limit
that keeps non-waivable consumer rights. Launch is every App Store country except China mainland (game ISBN needs a
Chinese publisher) and Vietnam (game license required since February 2025); the EU needs the trader declaration.
