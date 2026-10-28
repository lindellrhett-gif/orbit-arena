# Flags

Square (1x1) country flags from [flag-icons](https://github.com/lipis/flag-icons) v7.6.0 by Panayiotis Lipiridis,
MIT license, packed into `atlas.webp` (16x16 cells of 96 px) by `scripts/copy-flags.mjs`. The cell order is in
`src/data/flag-index.json`. National flags themselves are public domain.

The channel's renderer uses flagcdn.com images (same codes, see `src/data/codes.json`); flagcdn isn't reachable from
the build environment, so the app ships flag-icons instead. US state flags from codes.json aren't included.
