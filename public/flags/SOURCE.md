# Flags

Square (1x1) country flags from [flag-icons](https://github.com/lipis/flag-icons) v7.6.0 by Panayiotis Lipiridis,
MIT license, rasterized to 128x128 PNG by `scripts/copy-flags.mjs`. National flags themselves are public domain.

The channel's renderer uses flagcdn.com images (same codes, see `src/data/codes.json`); flagcdn isn't reachable from
the build environment, so the app ships flag-icons instead. US state flags from codes.json aren't included.
