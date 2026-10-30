# Changelog

## Unreleased

- Melodies now use the channel renderer's note lists (`MELODIES` in `scripts/orbit.py`), so a sim plays the same
  tune in the app and on the channel. Mountain King is back in B minor and Eine kleine Nachtmusik in G, and each tune
  loops after the phrase the channel uses.
- Submit your sim writes specs the way the channel's `sim.yaml` files look and in orbit.py's units: spin in radians
  per second, gravity in px/s² (black-hole pull for orbit), ball size as `ball_r`, titles keep their line break, and
  `out: video.mp4`. Race and blocks list the channel's course settings. Knobs orbit.py can't express are left out.

## 0.2.0 (Phase 2)

- All seven kinds: escape, battle, grow, multiply, race, orbit (black hole survival) and blocks.
- Over/under picks for kinds without contestants (escape, grow, multiply, blocks): the line sits just above or
  below the real result, on a side set by the seed, so every guess is a fair, close 50/50.
- Build your own: pick a kind, colors or countries (search all 256), rings, gap, spin, grow, ball count, ball size,
  gravity or black-hole pull, and melody; it finds a run that fits the length window. 5 saved sims on the device.
  Remix any sim from its result card.
- Save video: replays the run onto a 720x1280 canvas with a "Made with Orbit Arena" watermark and records picture
  and sound together (MP4 where the browser can, WebM otherwise). Where recording isn't available it saves a picture
  of the result and shares the link. In the iOS app the file goes to the share sheet (Save Video, TikTok...).
- Daily challenge: three sims a day for everyone (an escape, a pick-the-winner kind, a guess kind), today's score,
  day streak, a 7-day strip and your best days.
- Submit your sim: a credit name plus an orbit.py-style YAML spec and the share link, to post in a comment or DM.
  Nothing is sent from the app. `scripts/link-to-yaml.ts` turns a link back into YAML for the channel.
- Share links no longer carry a free-text title (the app never shows one person's typed text to another).

## 0.1.0 (Phase 1, unreleased)

- Watch & Pick feed: three daily sims (same for everyone that day) and endless random ones. Pick a color, country,
  marble or escape time before each run; points, streak, best streak and win rate are kept on the device.
- Three kinds: escape (1-8 rotating rings, optional grow), battle (colors or 256 country flags) and marble race
  (peg-field start, 5 zig-zag ramps with bumps and 2 spinning paddles, checkered finish).
- Deterministic physics engine in TypeScript: the same spec and seed give the same run in every browser.
  Share links encode the sim, so anyone who opens one sees the exact same run.
- Bounce notes from 9 public-domain melodies (Karplus-Strong pluck + bell partial + reverb), mute toggle.
- iOS app (Expo SDK 57, built with EAS): the game bundled offline in a WebView, haptics, native share sheet,
  durable storage, sound in silent mode, portrait iPhone build.
- Web build: installable PWA with offline support, privacy page, desktop layout with a side panel.
- Tests: determinism snapshots (6 configurations x 20 seeds) in Node and in Chromium/Firefox/WebKit, share-link
  round trips, daily seeds, trig accuracy, RNG.
