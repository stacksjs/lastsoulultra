# Last Soul Ultra on Stacks

The existing LSU checkout is upgraded to Stacks 0.75.281 and recreates the public production site captured on 23 October 2026. Home, format, World Series, Soul Races, sponsorship, contact and FAQ, profiles, entry requests, results and legal pages use STX, shared navigation and local brand assets. `/coaching` embeds HQ's branded subscription and training portal.

## Develop and verify

```sh
pantry install
bun install
bun scripts/build-site-assets.ts
./buddy dev
./buddy lint
./buddy typecheck
./buddy test
```

`pantry.json` pins Bun 1.4.4; `./buddy --version` should match. `bun run build` builds local styles before the framework build. `bun scripts/seo.ts` regenerates the sitemap and robots file; `SITE_ORIGIN` overrides the production canonical origin for deployment.

`resources/assets/styles/site/` contains the production brand styles adapted to stable semantic classes. `resources/data/production-pages.ts` supplies page metadata. Photos, logos and fonts are self-hosted under `public/assets/lsu/`, with source URLs and hashes in `asset-integrity.json`. The public site content and 2025/2026 result data are preserved; do not replace race facts with sample content.

The image pipeline uses the published WebP decoder fix for odd-height photography, preserving the final rows without flattening transparency. The World Series globe uses published first-party `@ts-maps/stx` 0.5.6, including its upstream projection fix. Its local land geometry derives from the production land mask; the static globe remains a progressive fallback. Home uses the original race footage with scroll seeking and a poster fallback for reduced motion. Its historical counters and season comparison follow scroll progress using a small summary generated from the official results. The format rest calculator, menu, gallery, results filters and race forms use STX signals and composables.

## Connect HQ coaching

Set in the deployment environment:

```dotenv
HQ_ORIGIN=https://hq.training
HQ_BRAND_SLUG=last-soul-ultra
```

`config/coaching.ts` validates the host through `CoachingPortal.stx`. The component loads `/assets/elements/hq-coaching.js` from HQ and embeds `/brands/<slug>`, with a full-page fallback. Before it is available, HQ's organization owner must publish the experience with real coach methods and active monthly products and permit the LSU origin. An unpublished HQ brand correctly returns 404; LSU does not manufacture offers or charge a placeholder price.

HQ's **Brand experience** editor controls colors, fonts, corners, density, modules, navigation, offers, legal links and embedding origins. The LSU preset matches the site. Coaches author their methods in HQ's **Training methods** workspace, supply plan-backed monthly products in **Store**, and use their configured AI budget for feedback. Personal coaching remains a direct coach referral.

HQ's repository documents provisioning, API endpoints, native app builds and launch decisions in `docs/developers/branded-coaching.md`. The new HQ database migrations and application deployment must be released before enabling the live LSU embed. This repository change does not deploy either site.

## Existing race service

`resources/functions/race-api.ts` talks to the existing `https://api.lastsoulultra.com/v1` service for public events, sign-in, profile updates and entry requests. Its established bearer session remains under `lsu.runner.session`. Coaching has its own HQ account session; credentials are never silently transferred or linked by unverified email. Form submissions reach the real race service, so use an approved test account/service for write testing.

Public reference snapshots live in ignored `storage/reference/lsu-2026-10-23/` locally. They document source content and API behavior; no production runtime scripts or Astro runtime are embedded in the Stacks application.

LSU prices, approved methodology, revenue shares and local versus cloud inference are commercial/product decisions still to finalize. HQ currently uses its existing cloud assistant and browser/native dictation; this is not an uploaded voice-message transcription service.
