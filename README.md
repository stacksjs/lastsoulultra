# Last Soul Ultra on Stacks

The existing LSU checkout runs on Stacks (the pinned version is `stacks` in `package.json`) and recreates the public production site captured on 23 October 2026. Home, format, World Series, Soul Races, sponsorship, contact and FAQ, profiles, entry requests, results and legal pages use STX, shared navigation and local brand assets. `/coaching` carries this site's own coaching surface over HQ's branded subscription and training portal.

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

`pantry.json` pins the Bun version and `./buddy --version` reports the Bun actually in use, so the two should agree. `pantry install` is what makes them agree: it puts the pinned Bun in the gitignored `./pantry`, which `buddy` prefers over whatever is on your PATH, and it leaves the machine's own Bun alone. Skip that step and `buddy` runs your system Bun instead, which is usually invisible until `tests/native-source.test.ts` fails with `Native builds require Bun X; current runtime is Y`. That message means run `pantry install`, not that anything is wrong with the code; CI installs the pinned Bun and stays green while a stale machine fails.

Three things about `./buddy dev` are worth knowing before you conclude it is broken.

It can refuse to start with `Framework defaults version mismatch: storage/framework/defaults is from X, but @stacksjs/defaults Y is installed`. The message suggests `buddy upgrade`, which moves the pinned version and is the right tool only when you actually want to move it. Check `package.json` first: `storage/framework/defaults` is committed (2741 files) and carries its own version in `storage/framework/defaults/.stacks-sync.json`, so when that file and the `stacks` pin already agree, nothing needs upgrading and `node_modules` is simply behind the lockfile. `bun install` is the fix, and it changes no tracked file.

Once it does start, the **first** build takes over 100 seconds to bind a port and prints no ready line while it works. The last thing you see is `[ts-css] Loaded config from config/css.ts`. Later starts reuse the stx cache and take a few seconds, so only a cold one is slow; wait for `http://localhost:3000` to answer rather than assuming it died.

And it really can exit on its own, silently, with status 0. That is a deliberate shutdown, not a crash, and for `./buddy dev frontend` the cause is not a signal at all. Each dev child (`views.ts`, `api.ts`, `docs.ts` in `@stacksjs/actions`) calls `exitWithParent()`, which polls `process.ppid` every two seconds and calls `process.exit(0)` the moment the parent it started under goes away. Nothing is logged, so it looks exactly like a crash.

That is why backgrounding it from a short-lived shell never works, and why `nohup` does not help: no signal is involved, so there is no disposition for nohup to set. Orphaning the process is the whole trigger. Run it in a terminal you keep open, or under something that stays alive as its parent.

The same function also handles SIGINT, SIGTERM and SIGHUP by exiting silently, and bare `./buddy dev` (not the `frontend` target) has a second silent path of its own in `startDevelopmentServer`. stacksjs/stacks#3063 covers that one and stacksjs/stacks#3065 fixes it, which does not change the `exitWithParent` behaviour described here.

`bun run build` builds local styles, runs the framework build, then lifts each page's own module bundle out of its HTML into `_stx/modules.<hash>.js` so it can be cached (`bun run build:bundles`, idempotent). That step is what keeps `/world-series` at 34 KB of HTML rather than 879 KB: the globe library is used by one page, so the framework's own externaliser, which lifts what repeats across pages, leaves it inline. `bun scripts/seo.ts` regenerates the sitemap and robots file; `SITE_ORIGIN` overrides the production canonical origin for deployment.

`resources/assets/styles/site/` contains the production brand styles adapted to stable semantic classes. `resources/data/production-pages.ts` supplies page metadata. Photos, logos and fonts are self-hosted under `public/assets/lsu/`, with source URLs and hashes in `asset-integrity.json`. The public site content and 2025/2026 result data are preserved; do not replace race facts with sample content.

The image pipeline uses the published WebP decoder fix for odd-height photography, preserving the final rows without flattening transparency. The World Series globe uses published first-party `@ts-maps/stx` 0.5.7, including its upstream projection fix. Its local land geometry derives from the production land mask; the static globe remains a progressive fallback. Home uses the original race footage with scroll seeking and a poster fallback for reduced motion. Its historical counters and season comparison follow scroll progress using a small summary generated from the official results. The format rest calculator, menu, gallery, results filters and race forms use STX signals and composables.

## Deploy

The site deploys to `lsu.stacksjs.com`, a password-gated preview on the shared
`stacks` box (`cloud.attachTo`), not to the public lastsoulultra.com. Pushing to
`main` runs CI; Deploy fires on CI succeeding (`workflow_run`), so an untested
commit never ships.

`config/cloud.ts` holds the shape: Hetzner, attach mode, rpx with on-demand TLS,
the website, a loopback-only website API, and the independent training web/API services. DNS is the
`stacksjs.com` zone, which is on Cloudflare nameservers - ts-cloud detects the
provider from the zone rather than being told, the same as HQ's config.

### What has to be in place

`DEPLOY_SSH_KEY` and `DOTENV_PRIVATE_KEY_PRODUCTION` are repository secrets.
`HQ_SOURCE_SSH_KEY` is a read-only key for the pinned application source.
`CLOUDFLARE_API_TOKEN` is configured for the authoritative `stacksjs.com` zone.
Buddy discovers that zone and reconciles A/AAAA records for both the website
and `training.lsu.stacksjs.com`, using the verified attached server's addresses.
Records stay DNS-only so rpx can issue and terminate TLS on the German host.
No manual DNS setup is required.

See [the enterprise deployment contract](enterprise/README.md) for LSU's own
database, runtime isolation, source preparation and residency checks.

`.env.production` is committed with every value encrypted (dotenvx; the private
key lives in the gitignored `.env.keys`). `APP_DOMAIN` is set there and wins over
the default in `config/cloud.ts`, so it has to name the new host:

```sh
./buddy env:set APP_DOMAIN lsu.stacksjs.com --file .env.production
```

### The password gate

`SITE_AUTH_USER` and `SITE_AUTH_PASSWORD` turn on rpx's HTTP Basic challenge for
the site - the same gate the nginx driver applies as an htpasswd file - so the
preview is neither readable by the public nor indexable. The deploy hook requires both values for this private preview. A public launch
requires an explicit change to that policy.

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
HQ_ORIGIN=https://training.lsu.stacksjs.com
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

## Native iOS and Android

`bun run native:ios` and `bun run native:android` build the complete HQ app from a pinned source revision with LSU branding. `bun run native:testflight` archives and uploads the iOS app using existing local signing credentials. See [native/README.md](native/README.md) for the source-sharing contract, provenance and release setup.

## Enterprise training backend

`./buddy deploy --prod --yes` prepares the pinned HQ application source and deploys LSU's training web/API services alongside the race site. `enterprise/deployment.json` names the own installation at `training.lsu.stacksjs.com`, the Germany/Falkenstein residency policy, the dedicated PostgreSQL role/database, persistent private data and service ports. Native and server builds use the same immutable source revision. See [enterprise/README.md](enterprise/README.md).
