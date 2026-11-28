# Google Play Console: what to enter

Everything Orbit Arena needs in Google Play Console (Bluestem Software LLC's organization account), ready to paste.
Lengths are within Google's limits. Organization accounts don't need the 12-tester, 14-day closed test that new
personal accounts do, so the app can go from internal testing straight to production.

Images: `node scripts/android-assets.mjs` writes the icon and feature graphic to `screens/play/`;
`npm run build && node scripts/store-screens.mjs screens/play/phone android` writes phone screenshots there.

## Create the app

All apps → Create app:

| Field | Value |
|---|---|
| App name | Orbit Arena: Physics Sims (30 max; same as the App Store, see `APP_STORE.md` for why) |
| Default language | English (United States) – en-US |
| App or game | Game |
| Free or paid | Free (can't be changed to paid later; extras are in-app products) |
| Declarations | Developer Program Policies, US export laws: accept (Rhett) |

Package name is fixed by the first upload: `com.rhettlindell.orbitarena` (same as the iOS bundle ID).

## Store listing (Grow → Store presence → Main store listing)

**Short description** (80 max)

Pick the winner, watch the physics play out. Every bounce plays a melody.

**Full description** (4000 max)

Guess the winner, then watch it play out.

Orbit Arena turns satisfying physics sims into a game. Before each run, pick the color, country or marble you think
wins, or guess over or under. Then watch: balls escape spinning rings, battle to stay inside, race down zig-zag
ramps, circle a black hole, multiply and smash blocks. Every bounce plays the next note of a public-domain melody.

• Three new daily sims every day, the same for everyone
• Streaks and points (just a score: nothing to buy, nothing to bet)
• Build your own sim: pick the kind, colors or countries, rings, gaps, spin, gravity and melody
• Save a video of any run and share it anywhere
• Share links replay the exact same run for your friends
• Works offline, no account, no ads, no tracking

Optional extras, one-time purchases: HD export without the watermark, ball skins and trail effects, a pack of more
classic melodies, and unlimited saved sims. They never change picks or points.

| Asset | File | Rule |
|---|---|---|
| App icon | `screens/play/icon-512.png` | 512x512 PNG |
| Feature graphic | `screens/play/feature.png` | 1024x500 |
| Phone screenshots | `screens/play/phone/*.png` | 2-8, 1080x1920 (9:16) |

Category: **Game → Casual**. Tags: Casual, Simulation, Music. Contact email: rhett@bluestemsoftware.com. Website:
https://lindellrhett-gif.github.io/orbit-arena/

## App content (Policy → App content)

| Section | Answer |
|---|---|
| Privacy policy | https://lindellrhett-gif.github.io/orbit-arena/privacy.html |
| App access | All functionality is available without special access (no login) |
| Ads | No, the app doesn't contain ads |
| Content rating (IARC questionnaire) | Category: Game. Violence, fear, sexuality, language, drugs: No. Gambling: No (points are a score, nothing is wagered or won). Users interact or share content: No (share links are game settings with no free text). Shares location: No. Digital purchases: Yes. Expect Everyone / PEGI 3. |
| Target audience | Rhett decides (see below) |
| Data safety | No data collected, no data shared (see below) |
| Government app / Financial features / Health / News | No / None / None / No |

**Target audience.** If any age group under 13 is selected, the app falls under Google Play's Families policy:
no ads or analytics SDKs that aren't family-certified (the app has none), a privacy policy (done), and nothing
that collects data from children (it collects nothing). Orbit Arena meets that. Choosing only 13+ is simpler, but
Google asks whether the app unintentionally appeals to children, and a bright physics game with nursery-rhyme
melodies does; answering that honestly may still bring Families review.

**Data safety.** Does the app collect or share any of the required user data types? **No.** Everything stays on the
device; purchases go through Google Play Billing, which Google handles under its own policy and which isn't
declared by the app. Encryption in transit and deletion requests don't apply when nothing is collected.

## In-app products (Monetize → Products → In-app products)

Only available after an upload that includes the Billing library (any track). Product IDs match iOS and can never
be reused. All are one-time products (not subscriptions).

| Product ID | Name | Description (80 max) | Price (USD) |
|---|---|---|---|
| `com.rhettlindell.orbitarena.everything` | Everything | HD export, skins, melodies, unlimited slots | $3.99 |
| `com.rhettlindell.orbitarena.hd` | HD Export | 1080p videos with no watermark | $1.99 |
| `com.rhettlindell.orbitarena.skins` | Skins & Trails | New ball skins and trail effects | $1.99 |
| `com.rhettlindell.orbitarena.melodies` | Melody Pack | 8 more public-domain melodies | $0.99 |
| `com.rhettlindell.orbitarena.slots` | Unlimited Slots | Save as many of your own sims as you like | $0.99 |

Selling them needs a payments profile (Setup → Payments profile: bank account and tax info). Google takes 15% on
the first $1M a year for every developer.

## Countries

Production → Countries/regions: add all, except where games need a local license (as on iOS): China isn't served
by Google Play; remove **Vietnam**. Prices: set USD and let Google convert.

## Builds and release

1. Signed release bundle (AAB), built locally: from `mobile/`,
   `npx eas-cli@latest build --local --platform android --profile production --output dist/orbit-arena.aab`
   (needs `JAVA_HOME=/opt/homebrew/opt/openjdk@17` and `ANDROID_HOME=~/Library/Android/sdk`). The upload key lives
   on EAS; Google holds the app signing key (Play App Signing, on by default).
2. First upload by hand (Google's API can't create the first release): Test and release → Testing → Internal
   testing → Create new release → upload the AAB, add yourself as a tester.
3. Create the in-app products, install from the internal test link, try a purchase (license testers aren't charged:
   Setup → License testing, add your Google account).
4. Production → Create new release → promote the build, then Send for review.
