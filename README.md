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

The image pipeline uses the published WebP decoder fix for odd-height photography, preserving the final rows without flattening transparency. The World Series globe uses published first-party `@ts-maps/stx` 0.5.7, including its upstream projection fix. Its local land geometry derives from the production land mask; the static globe remains a progressive fallback. Home uses the original race footage with scroll seeking and a poster fallback for reduced motion. Its historical counters and season comparison follow scroll progress using a small summary generated from the official results. The format rest calculator, menu, gallery, results filters and race forms use STX signals and composables.

## Deploy

The site deploys to `lsu.stacksjs.com`, a password-gated preview on the shared
`stacks` box (`cloud.attachTo`), not to the public lastsoulultra.com. Pushing to
`main` runs CI; Deploy fires on CI succeeding (`workflow_run`), so an untested
commit never ships.

`config/cloud.ts` holds the shape: Hetzner, attach mode, rpx with on-demand TLS,
one `main` site on the domain and a loopback-only `api`. DNS is the
`stacksjs.com` zone, which is on Cloudflare nameservers - ts-cloud detects the
provider from the zone rather than being told, the same as HQ's config.

### What has to be in place

`DEPLOY_SSH_KEY` and `DOTENV_PRIVATE_KEY_PRODUCTION` are already set as repository
secrets; the workflow skips the whole deploy when either is missing. Nothing else is needed: with no `dns` block the deploy asks no registrar for
anything.

The DNS record is made by hand, once. `config/cloud.ts` carries no `dns`
block, so the deploy writes no records and needs no registrar credentials -
`stacksjs.com` is delegated to Cloudflare while a Route53 hosted zone for the
same name also exists and is not the one being asked, so there was no settled
answer to which credentials were the right ones. In whichever zone is actually
answering (`dig NS stacksjs.com`), create:

| Name | Type | Value |
|---|---|---|
| `lsu` | A | `178.105.248.188` |
| `lsu` | AAAA | `2a01:4f8:c014:6186::1` |

The same pair `hq.training` resolves to, which is the shared `stacks` box this
project attaches to. Not proxied: rpx terminates TLS on the box with on-demand
certificates, and a proxy in front would terminate it elsewhere and break
issuance.

`.env.production` is committed with every value encrypted (dotenvx; the private
key lives in the gitignored `.env.keys`). `APP_DOMAIN` is set there and wins over
the default in `config/cloud.ts`, so it has to name the new host:

```sh
./buddy env:set APP_DOMAIN lsu.stacksjs.com --file .env.production
```

### The password gate

`SITE_AUTH_USER` and `SITE_AUTH_PASSWORD` turn on rpx's HTTP Basic challenge for
the site - the same gate the nginx driver applies as an htpasswd file - so the
preview is neither readable by the public nor indexable. Both unset leaves the
site open, which is what you want the day it goes public.

```sh
./buddy env:set SITE_AUTH_USER lsu --file .env.production
./buddy env:set SITE_AUTH_PASSWORD --stdin --file .env.production   # keeps it out of shell history
```

Commit the re-encrypted `.env.production` afterwards: the deploy reads it from
the repository, not from your machine.

### Deploying

Push to `main` and let CI gate it, or run it by hand:

```sh
gh workflow run Deploy --repo stacksjs/lastsoulultra -f environment=production
./buddy deploy --prod            # from a machine that has .env.keys
```

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

## The live scoreboard

`resources/data/live.ts` mirrors the race's own board. That board publishes no
JSON, so this lifts the state out of the HTML the worker serves. It is the most
fragile thing on the site, and fragile on purpose: reading their page is what
lets the standings live here instead of behind an outbound link.

The cost is that their refactor is our outage, with no warning and no version
marker. On 29 October 2026 it turned out they had renamed the global and
renested the payload some time earlier, and the board had been quietly dark
ever since:

    window.__LSU__      = { state:   ... }   ->  window.__LSU_SUMMARY__ = { summary: ... }
    runner.lapsCompleted                     ->  runner.laps
    state.finalLap                           ->  summary.lastLap
    status 'active'                          ->  status 'finisher'

Both spellings are read now, and `tests/fixtures/live-summary.json` is a trimmed
copy of what the worker actually served that day, so the next rename fails a
test rather than a page. If the board goes blank, start by diffing the live
payload against that fixture.

`routes/api.ts` serves it at `GET /api/live`, answering `ok: false` rather than
a page of zeroes when upstream is down. `<LiveBoard />` renders it on `/results`
and polls that endpoint, and `liveRaceState` asks it site-wide whether the race
is running. Both the snapshot and the brand loader answer from cache and refresh
behind the response, so no visitor ever waits on an upstream fetch.


## Existing race service

`resources/functions/race-api.ts` talks to the existing `https://api.lastsoulultra.com/v1` service for public events, sign-in, profile updates and entry requests. Its established bearer session remains under `lsu.runner.session`. Coaching has its own HQ account session; credentials are never silently transferred or linked by unverified email. Form submissions reach the real race service, so use an approved test account/service for write testing.

Public reference snapshots live in ignored `storage/reference/lsu-2026-10-23/` locally. They document source content and API behavior; no production runtime scripts or Astro runtime are embedded in the Stacks application.

LSU prices, approved methodology, revenue shares and local versus cloud inference are commercial/product decisions still to finalize. HQ currently uses its existing cloud assistant and browser/native dictation; this is not an uploaded voice-message transcription service.
