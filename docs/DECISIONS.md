# Decisions

Short notes on why things are the way they are. Newest last.

## iOS first, built with Capacitor (2026-10-28)
Rhett chose iOS first. The game is written once in TypeScript (Canvas 2D + Web Audio) and wrapped with Capacitor 8 for
iOS. Reasons: the same code also serves the web build, which is what share links open on any phone (no install needed);
it can be developed and tested headless on Linux, including the cross-browser determinism test against WebKit; and it
avoids writing the physics twice (Swift for iOS, TypeScript for share links), which would make share links replay a
*different* run. A native SwiftUI + SpriteKit rewrite stays possible later if the web view ever limits us.

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

## Escape picks are time buckets (2026-10-28)
Every escape ends with ESCAPED!, so "will it escape?" isn't a real pick. Viewers guess the escape time instead: the
target window split into thirds.

## Points are a score, not a currency (2026-10-28)
A correct pick earns 10 points per other option. Nothing is wagered, nothing is lost on a wrong pick, and points can't
be bought or spent. This keeps the app clear of anything that looks like gambling (App Store 5.3, kids audiences).

## Flags from flag-icons (2026-10-28)
flagcdn.com (used by the channel) isn't reachable from the build environment. flag-icons (MIT) has square flags for
256 of the 306 codes in codes.json (all countries; not the US states). They're rasterized once to 128 px PNGs.

## Reduced motion doesn't slow the spin (2026-10-28)
Slowing the rings would change the physics, and a share link must replay the same run for everyone. Reduced motion
instead cuts particles and shortens trails.

## Share links point at the web build (2026-10-28)
`https://lindellrhett-gif.github.io/orbit-arena/?k=battle&s=129&...` opens in any browser. When the iOS app ships,
universal links (needs an `apple-app-site-association` file on a domain we control) can open them in the app instead.

## No analytics yet (2026-10-28)
Phase 1 ships with no analytics at all. Adding privacy-friendly analytics (GoatCounter or Cloudflare Web Analytics)
is Rhett's call and the privacy page has to change first.
