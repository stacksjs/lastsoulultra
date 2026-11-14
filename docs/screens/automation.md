---
title: Screenshot automation and coverage
description: Maintain the LSU screen inventory, capture synthetic review states and verify published image artifacts.
---

# Screenshot automation and coverage

The [screen atlas](/screens/) is generated from an authored inventory. Each entry names a source template, its route, review role, purpose, rationale and workflow guide. This keeps an explanation attached to the screen instead of producing an unlabeled folder of pictures.

## Inventory before images

`resources/data/screens/inventory.json` accounts for the race website and the pinned training kit. The coverage audit fails when a source template appears without an entry, a source disappears, an id is duplicated or a screen lacks an explanation. Shared-platform, hardware and one-use-link screens have explicit scope notes.

```sh
bun scripts/sync-screen-guide.ts
bun scripts/sync-screen-guide.ts --check
```

The same check verifies the branded onboarding pictures against `native/onboarding`. The docs audit includes it. When moving the platform pin, review the inventory against the new templates before accepting regenerated output.

## Reusable Stacks capture command

Stacks' screen-documentation workflow reads an explicit capture configuration and uses Bun WebView. It captures selected screens at named viewports, isolates authentication profiles in separate owned processes, waits for readiness, masks configured private fields, and writes a JSON manifest, PNGs and a Markdown gallery.

LSU declares two configurations, one for the training kit and one for the race website. Export the synthetic review credentials through your normal secret manager. Set `BUN_CHROME_PATH` if Chrome is not discoverable on the machine.

```sh
bun run docs:screenshots:training --list
bun run docs:screenshots:website --list
bun run docs:screenshots:training
bun run docs:screenshots:training --check
```

The app wrapper bounds browser resources per screen, while Stacks merges the batches into a complete manifest. Use a fresh output directory when changing the configuration or source pin. Keep the previous report as evidence of the earlier build.

`--list` validates the configuration and template coverage without opening a browser. `--check` verifies a complete saved inventory and image hashes; it does not contact the deployment to see whether the UI has changed. Capture again for a new build and include its source pin in the configuration's freshness inputs.

For a focused update, choose explicit ids and a configured viewport:

```sh
bun run docs:screenshots:training --only training-home,training-week --viewport mobile
```

Other Stacks applications can use `buddy docs:screenshots --config config/screenshots.ts` directly, with their own pages, model fixtures and readiness hooks. LSU opts out of model discovery because the installed training kit uses a legacy SQL schema; its read-only adapter finds existing synthetic records instead.

The **Docs screenshots** workflow in GitHub Actions accepts a surface and optional screen ids. It saves the report and images in an encrypted artifact for seven days, including on failure. The repository is public, so the workflow uploads only the encrypted bundle. It does not publish plaintext images automatically. The workflow uses the existing platform registry grant and production environment decryption key. Only the preview gate and synthetic review-account values are read from the encrypted environment. Locally, add `--production-env` to load the same configuration explicitly; otherwise export the required review variables through your secret manager. The training adapter checks that the live HQ revision matches the pinned kit before and after capture. It refuses a mismatched deployment. Do not run a full capture while a deployment or fixture refresh is changing the reviewed environment.

The Stacks core guide documents the full API and configuration: [Automated screen documentation](https://stacksjs.com/docs/guide/screenshots). The existing `buddy screenshot <url>` command remains useful for a single page.

Download the workflow artifact before its retention period ends. A reviewer with the production decryption key used for that capture can open the bundle locally. The key is resolved through the same environment-key mechanism as deployment; it is never included in the artifact. The archive uses authenticated encryption with a separate derived key and a fresh salt and nonce.

```sh
bun --no-env-file --config=scripts/screenshots.bunfig.toml scripts/screenshot-artifact.ts open docs-screenshots.encrypted.json review.tar
tar -tf review.tar
mkdir private-review
tar -xf review.tar -C private-review
```

Keep that decrypted directory private. The tool refuses to overwrite an existing encrypted bundle or output archive. If a key is rotated, retain the old key securely until any required review bundles have been opened.

## Use the data model intelligently

App model definitions can tell the planner which primary key and API resource a model uses, which records it belongs to, which factories/defaults exist, and which required values still need overrides. Native seeder dependencies help order fixture preparation. Sensitive fields provide review hints; they are not a substitute for checking the image.

Use existing synthetic records or prepare a dedicated disposable environment with the native factories and tagged seeders. Bind dynamic routes to the records actually created. A workout-detail route needs an athlete-owned workout, and a weekly review needs the relevant enrollment and pending block. A made-up id is not a populated-state fixture.

The screenshot tool does not automatically migrate, reset or seed a production database. A trusted fixture adapter must target the same disposable database as the running application. List/check modes do not run that adapter.

## What needs a separate state

| Surface | Capture examples |
| --- | --- |
| Sign-in and onboarding | Signed out, verification required, policy agreement, athlete tour, coach tour, setup question, connection postponed, safety choice, partial setup failure and completion. |
| Athlete training | Published week, next week gated by feedback/review, rest day, session detail, player, completed session and deliberately empty history. |
| Purchases | Offer details, checkout-start failure, cancelled checkout, confirmation pending, confirmation unavailable and confirmed access. Hosted Stripe errors need their own sandbox review. |
| Coach workspace | Empty roster, populated roster, selected athlete, editable draft, changed revision and approved block. |
| Organization | Each permitted management screen and a denied action for a lower-privilege role. Do not send broadcasts or make refunds merely to photograph the controls. |
| Health and devices | No data, populated data, disconnected provider, import failure and supported hardware setup. |

A route is not every state of its page. Add meaningful states deliberately and describe their fixture and expected behavior. Keep the [onboarding sequence](/onboarding) and [payment error matrix](/payment-testing) alongside those captures.

## Review before publication

Use only synthetic accounts and avoid screenshots containing credentials, tokens, payment details, real health records or unrelated members. Inspect the desktop and phone images, verify that labels and data loaded, and check that a redirect or error did not replace the intended screen. Keep failures in the report until they are fixed or explicitly explained.

A phone-width web capture verifies web layout. The installed iPhone app still needs review for native navigation, safe areas, gestures, permissions, offline behavior, Bluetooth and return from Stripe. A complete report should say which environment and source revision were captured and which native checks were performed.
