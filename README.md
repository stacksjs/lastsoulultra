# Last Soul Ultra on Stacks

The existing LSU checkout is upgraded to Stacks 0.75.281 and recreates the public production site captured on 23 October 2026. Home, format, World Series, Soul Races, sponsorship, contact and FAQ, profiles, entry requests, results and legal pages use STX, shared navigation and local brand assets. `/coaching` carries this site's own coaching surface over HQ's branded subscription and training portal.

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

`bun run audit:html` reads `dist/` after a build and reports dead internal links, duplicate ids, skipped heading levels, images with no alt and links with no accessible name. The same rules run over the rendered views in `bun test`, so a build is only needed to check a release against what was actually produced.

`pantry.json` pins Bun 1.4.4; `./buddy --version` should match. `bun run build` builds local styles, runs the framework build, then lifts each page's own module bundle out of its HTML into `_stx/modules.<hash>.js` so it can be cached (`bun run build:bundles`, idempotent). That step is what keeps `/world-series` at 34 KB of HTML rather than 879 KB: the globe library is used by one page, so the framework's own externaliser, which lifts what repeats across pages, leaves it inline. `bun scripts/seo.ts` regenerates the sitemap and robots file; `SITE_ORIGIN` overrides the production canonical origin for deployment.

`resources/assets/styles/site/` contains the production brand styles adapted to stable semantic classes. `resources/data/production-pages.ts` supplies page metadata. Photos, logos and fonts are self-hosted under `public/assets/lsu/`, with source URLs and hashes in `asset-integrity.json`. The public site content and 2025/2026 result data are preserved; do not replace race facts with sample content.

The image pipeline uses the published WebP decoder fix for odd-height photography, preserving the final rows without flattening transparency. The World Series globe uses published first-party `@ts-maps/stx` 0.5.6, including its upstream projection fix. Its local land geometry derives from the production land mask; the static globe remains a progressive fallback. Home uses the original race footage with scroll seeking and a poster fallback for reduced motion. Its historical counters and season comparison follow scroll progress using a small summary generated from the official results. The format rest calculator, menu, gallery, results filters and race forms use STX signals and composables.

## Connect HQ coaching

Set in the deployment environment:

```dotenv
HQ_ORIGIN=https://hq.training
HQ_BRAND_SLUG=last-soul-ultra
```

`config/coaching.ts` names the tenant; `resources/functions/coaching-source.ts` validates the origin and slug, builds the portal URLs and reads the one public endpoint, `GET /api/brands/<slug>`, with a 2.5 second bound, a short cache and a null answer for every failure.

The surface is this site's, not an embed of HQ's. `resources/data/coaching.ts` registers the eight training modules in LSU's own words, each with a scope: the storefront is public and indexed, the rest need an HQ account and are noindex, and `health` and `messages` are additionally account-private - they read the athlete's own HQ endpoints, which no brand ever sees, and the page says so. Each module has a route under `/coaching/<module>` with LSU's chrome around HQ's panel, and `/coaching/plans` plus the hub render the published tiers, coaches and prices directly from the public brand rather than only inside the frame. Nothing about a tier originates here. With no brand published, the modules say so and frame nothing.

`CoachingPortal.stx` loads `/assets/elements/hq-coaching.js` from HQ and embeds `/brands/<slug>`, with a full-page fallback. Every module page also carries a visible link to the same section, because a cross-origin frame can decline to load for reasons this page cannot see and the element's own fallback sits below a tall empty iframe.

`config/server.ts` delegates `Permissions-Policy: microphone` on `/coaching` and `/coaching/feedback`, naming the configured HQ origin. Without it the browser blocks recording inside HQ's frame and the feedback module fails silently. Before it is available, HQ's organization owner must publish the experience with real coach methods and active monthly products and permit the LSU origin. An unpublished HQ brand correctly returns 404; LSU does not manufacture offers or charge a placeholder price.

HQ's **Brand experience** editor controls colors, fonts, corners, density, modules, navigation, offers, legal links and embedding origins. The LSU preset matches the site. Coaches author their methods in HQ's **Training methods** workspace, supply plan-backed monthly products in **Store**, and use their configured AI budget for feedback. Personal coaching remains a direct coach referral.

HQ's repository documents provisioning, API endpoints, native app builds and launch decisions in `docs/developers/branded-coaching.md`. The new HQ database migrations and application deployment must be released before enabling the live LSU embed. This repository change does not deploy either site.

## Built, with nothing on the site reaching it

Two working features have no entry point in the current pages. Both were
added and then lost when the site was rebuilt from the production capture, so
they are listed here rather than left to be found again by accident.

**The live scoreboard.** `resources/data/live.ts` mirrors the race's own board
- which publishes no JSON, so it lifts the state out of the page the worker
serves - and `routes/api.ts` serves it at `GET /api/live`, cached for a minute
and answering 503 with `ok: false` rather than a page of zeroes when upstream
is down. Nothing fetches it. The only consumer left is the 404 page, which
asks it whether the race is running to decide what to link to. Restoring the
standings means rendering `livePayload` on `/results` and polling that
endpoint; the shape is the same server-side and in the browser so the table
cannot drift between them.

**The newsletter.** `app/Actions/SubscriberEmailAction.ts`,
`ConfirmSubscriptionAction.ts`, both `app/Mail/Subscription*` classes and the
three templates in `resources/emails/` implement a real double opt-in, and
`/api/email/confirm` is the middle step the framework does not provide. No
page has a signup form, so nobody can start the flow. Adding one also needs
privacy copy: the current `/privacy` documents analytics, server logs,
accounts and entries, and says nothing about a mailing list.

## Existing race service

`resources/functions/race-api.ts` talks to the existing `https://api.lastsoulultra.com/v1` service for public events, sign-in, profile updates and entry requests. Its established bearer session remains under `lsu.runner.session`. Coaching has its own HQ account session; credentials are never silently transferred or linked by unverified email. Form submissions reach the real race service, so use an approved test account/service for write testing.

Public reference snapshots live in ignored `storage/reference/lsu-2026-10-23/` locally. They document source content and API behavior; no production runtime scripts or Astro runtime are embedded in the Stacks application.

LSU prices, approved methodology, revenue shares and local versus cloud inference are commercial/product decisions still to finalize. HQ currently uses its existing cloud assistant and browser/native dictation; this is not an uploaded voice-message transcription service.
