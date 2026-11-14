# Last Soul Ultra on Stacks

This repository contains the LSU race-site preview, its user guide, and the branding and deployment inputs for LSU's independent training application. The race site uses TypeScript, STX and Crosswind on Bun. The training web app, backend and native apps come from the exact `@hq/platform` kit pinned in [native/hq-source.json](native/hq-source.json).

## Start with the right guide

| Task | Read |
| --- | --- |
| Use the preview as a runner, coach or administrator | [User guide](docs/index.md) and [demo walkthrough](docs/demo.md) |
| Understand RUN, SOUL and weekly training release | [Plans and subscriptions](docs/training/plans.md) |
| Deploy or operate the training installation | [Enterprise installation](enterprise/README.md) and [recovery](enterprise/RECOVERY.md) |
| Build or release the iPhone and Android apps | [Native app guide](native/README.md) |
| Understand CI, deployment and release triggers | [GitHub Actions](.github/workflows/README.md) |
| Change app code | [Agent and project conventions](AGENTS.md) |

## What runs where

| Surface | Preview address | Account and data boundary |
| --- | --- | --- |
| Race website | `https://lsu.stacksjs.com` | Shared HTTP Basic preview gate |
| User documentation | `https://lsu.stacksjs.com/docs` | Same gate as the race site |
| Training web and API | `https://training.lsu.stacksjs.com` | Independent LSU accounts, PostgreSQL, uploads and sessions |
| Race entry service | `https://api.lastsoulultra.com/v1` | Existing production race accounts and applications |
| Native apps | Packaged LSU origin | Same LSU training account and backend as the training website |

The race site's public Store embeds the published training storefront. Private training sections and `/coach` and `/admin` redirect to the training app, which enforces authentication and authorization. Subscription feedback, progress, method and billing links keep their subscription context. They are different from the general AI assistant, analytics and profile screens.

LSU currently disables HQ account sign-in. The assistant is configured for insights. Current catalog packages release seven-day training blocks after qualifying feedback and coach approval. The fictional eight-week Alex and Jamie demo calendars are separate review fixtures. See [the catalog guide](docs/training/plans.md) for the distinction.

## Local setup

Install Pantry, then run from the repository root:

```sh
pantry install --frozen-lockfile --ignore-scripts
bun install --frozen-lockfile
bun run build:assets
./buddy dev
```

The Pantry install needs `PANTRY_REGISTRY_TOKEN` with access to `@hq/platform`. Keep it in your environment or private credential setup. It installs the exact Bun and platform kit declared in [pantry.json](pantry.json) and [pantry.lock](pantry.lock). Without the kit, source-derived training references and native builds cannot be verified.

Check `./buddy --version` against the Bun version in `pantry.json`. Buddy prefers the repository's Pantry runtime. Running native helpers with a different system Bun produces an explicit version error; fix the local runtime instead of changing the pin to fit the machine.

`./buddy dev` starts the local website stack. It does not provision a local copy of the separate training service. `HQ_ORIGIN` defaults to the LSU preview backend, so local Store views can read its published public offers. To use an approved local training server, set `HQ_ORIGIN=http://127.0.0.1:3250` and `HQ_BRAND_SLUG=last-soul-ultra` in your local environment. The website only reads the public brand endpoint; training sign-in remains on that server.

The race-entry forms still talk to the production race service. Use fixtures or an approved test service/account when testing writes.

### Common setup problems

- **Framework defaults version mismatch:** compare the `stacks` pin with `storage/framework/defaults/.stacks-sync.json`. If they agree, reinstall the frozen dependencies. Use `buddy upgrade` only when intentionally upgrading the framework.
- **Cold dev start:** the first STX build can take over a minute before it binds the port. Check whether `http://localhost:3000` answers and inspect the running process before restarting it repeatedly.
- **Dev exits silently:** keep its parent terminal alive. Framework dev children monitor their original parent process and exit when it disappears; `nohup` does not prevent that parent-lifecycle exit.

## Verify changes

```sh
./buddy lint
./buddy typecheck
./buddy test
```

The app suite uses fixtures and local servers for external services. Native-source checks require the pinned Bun. Tests which use real database tables need a disposable local schema; CI runs `./buddy migrate` before the suite. Check the configured database before running migrations locally.

For documentation or navigation changes, install the pinned platform kit, then run:

```sh
bun run build:docs
bun run audit:docs
```

The documentation commands use a fresh, temporary STX cache so generated CSS matches a clean CI checkout even after local development. Use `bun run build:docs` for the deployment build and `bun run docs:style-guide` for reference updates. BunPress writes the deployed HTML into `dist/docs/.bunpress`. The audit checks generated references, supplied artwork, the LSU shell, linked artifacts, heading fragments, relative assets and the search index. Demo passwords are not committed: `bun run docs:demo` reads private account input and prepares ignored `docs/.data/demoAccounts.json`. The production deploy prepares it with all twelve review accounts before building the gated guide. A local build without those inputs shows an account-list fallback.

For a complete website build:

```sh
bun run build
bun run audit:html
```

`build` generates site assets, builds the website, externalizes page-specific module bundles, builds the docs and audits them. `audit:html` checks the rendered site for broken internal routes, duplicate IDs, heading order and missing accessible names. The same page rules run in the tests against rendered templates.

The [Visual guide](docs/visual-guide.md) provides compact reading aids and links to the full workflows. The current ERD source is generated from the pinned kit's migration corpus with `bun run docs:erd:source`; its `--check` mode runs in `audit:docs`. It includes all columns and declared foreign keys in the selected scope, including weekly training blocks, and keeps the older deployed snapshot separately. After changing a diagram source, use the bundled `stacks-technical-diagrams` skill to finalize and review its rendered HTML, then refresh `docs/public/diagrams/artifacts.json` with the verified source and HTML hashes. Local validation receipts stay under `storage/runtime`.

After changing component sources, regenerate their reference with `bun run docs:style-guide`. Regenerate workout art with `bun scripts/sync-workout-art.ts` and documentation brand assets with `bun scripts/sync-style-guide-assets.ts` when their sources change. Their `--check` modes run under `audit:docs`; do not hand-edit generated inventories.

## Source map

| Location | Purpose |
| --- | --- |
| `resources/views`, `resources/components`, `resources/functions` | Race-site templates and behavior |
| `resources/data` | Race facts, metadata, live/event parsing and coaching module registry |
| `resources/assets/styles/site` | Brand styles used by `build:assets` |
| `public/assets/lsu` | Self-hosted images, logos and fonts; provenance in `asset-integrity.json` |
| `routes/api.ts` | Website live-board and event mirrors, plus email confirmation |
| `config/coaching.ts`, `config/server.ts` | Training origin, brand and account-only redirects |
| `config/cloud.ts`, `config/training-cloud.ts` | Dedicated host, runtime isolation and service configuration |
| `enterprise/catalog`, `enterprise/presets.json` | Authored training catalog and packaged LSU configuration |
| `native/product.json`, `native/hq-source.json` | Product identity and immutable platform source pin |
| `docs`, `config/docs.ts` | Authored guide, generated references and BunPress configuration |

Keep real race content and 2025/2026 results intact. Generated styles and data are committed: after changing their sources, run `bun run build:assets` and include any resulting changes. `bun scripts/seo.ts` regenerates sitemap and robots files; `SITE_ORIGIN` selects the canonical deployment origin.

### External data behavior

The public brand loader reads `GET /api/brands/<slug>` from `HQ_ORIGIN`. A cold request is bounded to 2.5 seconds; successful data is fresh for one minute and can be served stale during a ten-minute refresh grace period. Failures return no brand and are cached for ten seconds. No offers or placeholder prices are invented.

The live board reads embedded JSON from the organizer's scoreboard HTML because that service has no dedicated JSON endpoint. `GET /api/live` exposes the normalized snapshot and reports upstream failure rather than inventing standings. The parser accepts the known `window.__LSU_SUMMARY__` and older `window.__LSU__` payloads; compare a changed upstream payload with `tests/fixtures/live-summary.json` if parsing stops working. A fixture verifies known shapes, but cannot detect a future upstream change until it is captured.

`GET /api/events` mirrors published entry windows. The race service owns an event's phase; the website does not independently decide that entries opened from a date alone. Both mirrors cache data and refresh it behind responses where a usable snapshot exists. Cold requests and expired caches can still wait for the bounded fetch.

Race bearer sessions use `lsu.runner.session` in browser session storage. Training uses its own session on its own origin. Credentials are not silently transferred between the two services.

## Deployment

A push to `main` starts CI. Successful CI triggers Deploy for the exact tested commit. Manual Deploy dispatch is also supported and does not have that automatic CI prerequisite:

```sh
gh workflow run deploy.yml --ref main -f environment=production
```

The preview runs on LSU's dedicated Hetzner host in Germany/Falkenstein, declared in [enterprise/deployment.json](enterprise/deployment.json). It does not attach to the shared Stacks host. Buddy reconciles DNS-only Cloudflare records, rpx TLS, the website, docs and isolated training services. See the [enterprise deployment guide](enterprise/README.md) for credentials, data residency, storage and recovery limitations.

The workflow requires `SITE_AUTH_USER` and `SITE_AUTH_PASSWORD` to keep the race site and docs gated, plus `DEPLOY_SSH_KEY`, `DOTENV_PRIVATE_KEY_PRODUCTION` and the platform registry grant. It reads the encrypted `.env.production`; the private dotenv key stays outside Git. The preview gate can be rotated through its GitHub secrets without changing the encrypted file.

Use Buddy for encrypted environment changes:

```sh
./buddy env:set APP_DOMAIN lsu.stacksjs.com --file .env.production
./buddy env:set LSU_TRAINING_DB_PASSWORD --stdin --file .env.production
```

Commit intentional encrypted changes so the deploy reads them. A local deployment with the required keys uses `./buddy deploy --prod --yes`; it includes source preparation, migrations, seed/provisioning steps and service changes. Treat it as a real deployment, not as a build check.

Native release commands commit, tag and push a release, then wait for the CI, Deploy and TestFlight chain. Review [native/README.md](native/README.md) before using them; `bun run release:build --dry-run` previews the release without publishing it.
