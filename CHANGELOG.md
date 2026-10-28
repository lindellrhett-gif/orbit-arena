# Changelog

## 0.1.0 (Phase 1, unreleased)

- Watch & Pick feed: three daily sims (same for everyone that day) and endless random ones. Pick a color, country,
  marble or escape time before each run; points, streak, best streak and win rate are kept on the device.
- Three kinds: escape (1-8 rotating rings, optional grow), battle (colors or 256 country flags) and marble race
  (peg-field start, 5 zig-zag ramps with bumps and 2 spinning paddles, checkered finish).
- Deterministic physics engine in TypeScript: the same spec and seed give the same run in every browser.
  Share links encode the sim, so anyone who opens one sees the exact same run.
- Bounce notes from 9 public-domain melodies (Karplus-Strong pluck + bell partial + reverb), mute toggle.
- iOS app (Capacitor 8): haptics, native share sheet, durable storage, portrait iPhone build.
- Web build: installable PWA with offline support, privacy page, desktop layout with a side panel.
- Tests: determinism snapshots (6 configurations x 20 seeds) in Node and in Chromium/Firefox/WebKit, share-link
  round trips, daily seeds, trig accuracy, RNG.
