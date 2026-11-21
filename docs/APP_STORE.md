# App Store Connect: what to enter

Everything Orbit Arena needs in App Store Connect, ready to paste. Lengths are within Apple's limits (checked when
written). Screenshots: `npm run build`, then `node scripts/store-screens.mjs` (writes `screens/store/`, 1320x2868, the
6.9-inch size; App Store Connect scales it down for smaller iPhones).

## Before anything else (Rhett)

- **Business → Agreements:** accept the Paid Apps Agreement and fill in banking and tax. In-app purchases don't load,
  even in TestFlight, until it's active.

## In-app purchases

Monetization → In-App Purchases → +. Type **Non-Consumable** for all five. Product IDs can never change or be reused.
Review screenshot for each: `screens/store/6-extras.png`. Review note for each: *"Open the menu (top right), tap
See extras."*

| Reference name | Product ID | Price | Display name | Description |
|---|---|---|---|---|
| Everything | `com.rhettlindell.orbitarena.everything` | $3.99 | Everything | HD export, skins, melodies, unlimited slots |
| HD Export | `com.rhettlindell.orbitarena.hd` | $1.99 | HD Export | 1080p videos with no watermark |
| Skins & Trails | `com.rhettlindell.orbitarena.skins` | $1.99 | Skins & Trails | New ball skins and trail effects |
| Melody Pack | `com.rhettlindell.orbitarena.melodies` | $0.99 | Melody Pack | 8 more public-domain melodies |
| Unlimited Slots | `com.rhettlindell.orbitarena.slots` | $0.99 | Unlimited Slots | Save as many of your own sims as you like |

The first in-app purchases have to be submitted together with an app version: on the version page, add them under
"In-App Purchases and Subscriptions" before submitting for review.

## App information

| Field | Value |
|---|---|
| Name | Orbit Arena |
| Subtitle | Pick the winner. Watch it go. |
| Primary category | Games → Casual |
| Secondary category | Entertainment |
| Age rating | 4+ (answer None to everything, including Simulated Gambling: points are a score, nothing is wagered) |
| Price | Free |
| Privacy policy URL | https://lindellrhett-gif.github.io/orbit-arena/privacy.html |
| License agreement | Apple's standard EULA (leave as is); `terms.html` adds the game's own terms |
| Support URL | https://lindellrhett-gif.github.io/orbit-arena/support.html |
| Marketing URL | https://lindellrhett-gif.github.io/orbit-arena/ |
| Copyright | 2026 Bluestem Software LLC |
| App Privacy | Data Not Collected |

## Version page

**Promotional text**

Satisfying physics sims you can play. Pick a color, a country or a marble, watch the run, and every bounce plays a
classic melody.

**Keywords**

physics,satisfying,marble race,bounce,ball,escape,color battle,countries,relaxing,melody,simulation

**Description**

Guess the winner, then watch it play out.

Orbit Arena turns satisfying physics sims into a game. Before each run, pick the color, country or marble you think
wins, or guess over or under. Then watch: balls escape spinning rings, battle to stay inside, race down zig-zag
ramps, circle a black hole, multiply and smash blocks. Every bounce plays the next note of a public-domain melody.

- Three new daily sims every day, the same for everyone
- Streaks and points (just a score: nothing to buy, nothing to bet)
- Build your own sim: pick the kind, colors or countries, rings, gaps, spin, gravity and melody
- Save a video of any run and share it anywhere
- Share links replay the exact same run for your friends
- Works offline, no account, no ads, no tracking

Optional extras, one-time purchases: HD export without the watermark, ball skins and trail effects, a pack of more
classic melodies, and unlimited saved sims. They never change picks or points.

**What's new (0.3.0)**

Extras: HD video export with no watermark, ball skins and trails, a melody pack and unlimited saved sims. Better
layout on the newest iPhones.

## Availability: as many countries as possible

Pricing and Availability → Countries or Regions: select all, then remove these two (checked 2026-11-06):

| Remove | Why |
|---|---|
| China mainland | Every game needs a government game license (ISBN), which a foreign developer can only get through a Chinese publisher. Hong Kong, Macao and Taiwan are separate storefronts and stay in. |
| Vietnam | Since February 2025 games need a license from Vietnam's Ministry of Information and Communications; Apple removes unlicensed ones. |

That leaves every other App Store country. Before release:

- **EU (27 countries):** declare trader status (Business → EU Digital Services Act). As a business selling extras, the
  LLC is a trader, and its address, phone number and email are shown on the EU product page. Use business contact
  details (a registered agent's or virtual office address, a business phone) if home details shouldn't be public.
  Apps without trader status aren't available in the EU.
- **Prices:** set the US price; Apple converts it for every storefront and collects sales tax or VAT where it's
  required.
- **Small Business Program:** enroll (Business section) to pay Apple 15% instead of 30% on extras.
- **Russia:** stays listed, but people there have had very limited ways to pay on the App Store since 2022, so expect
  few sales; the free game works.
- **Language:** English works in every storefront. Translating the store page later helps people find the app.

## Legal checklist (all done in the code, 2026-11-06)

- Open-source notices: `public/licenses.html` (regenerate with `npm run licenses` after dependency changes);
  fdlibm's notice is also kept in the minified game.
- Terms of use (`terms.html`): points have no value, purchases through Apple, permission to repost submitted sims,
  flags for identification only, a photosensitivity warning, and a liability limit that keeps consumer rights.
- Privacy policy: nothing collected, no cookies, hosting, rights. Store privacy label: Data Not Collected.
- No third-party trademarks in the store text. The game loads nothing from other companies.

## App Review notes

No sign-in. All in-app purchases are non-consumable and unlock looks or creation options only; points can't be bought.
Restore purchases is on the Extras screen (menu → See extras). Sound plays with the silent switch on, by design: the
notes are the point of the app.
