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

```sh
buddy docs:screenshots --list
buddy docs:screenshots
buddy docs:screenshots --check
```

`--list` validates the configuration and template coverage without opening a browser. `--check` verifies a complete saved inventory and image hashes; it does not contact the deployment to see whether the UI has changed. Capture again for a new build and include its source pin in the configuration's freshness inputs.

For a focused update, choose explicit ids and a configured viewport:

```sh
buddy docs:screenshots --only training-home,training-week --viewport mobile
```

The Stacks core guide documents the full API and configuration: [Automated screen documentation](https://stacksjs.com/docs/guide/screenshots). The existing `buddy screenshot <url>` command remains useful for a single page.

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
