# LSU on HQ: presets, onboarding and acceptance history

HQ.training carries no LSU code, data, CI or documentation: LSU receives HQ as
the `@hq/platform` kit and supplies its own identity and data. This page keeps
the LSU-specific material that used to live in HQ's repository.

## Installation presets

`enterprise/presets.json` holds LSU's brand experience preset and its approved
coaching tiers. `scripts/native-source.ts` checks it against `native/product.json`
and writes it into the prepared HQ source as
`resources/functions/installation-presets.json`, for both the native builds and
the training server (`scripts/prepare-training.ts` prepares the same source).
HQ offers the presets only to the `last-soul-ultra` organization:

- Brand experience (`/staff/experience`) shows **Start from Last Soul Ultra’s brand**
  and the **Last Soul Ultra monthly tiers**, each linking to `/coaches/store?preset=<key>`.
- `POST /api/coach/store/products` with `preset` creates the tier as a draft in
  the LSU organization; publishing still needs a coach's real plan and method.

The `experience` block lists only what differs from HQ's default experience;
HQ merges it and validates it as a saved experience. It carries LSU's full
palette, so a change to HQ's default theme never changes LSU's brand. Its values
are exactly HQ's former `lastSoulExperience()` and `LAST_SOUL_PRODUCTS`: renamed
tabs with their own symbols (Store over a bag, Workouts over a running figure),
because the module defaults read wrong over those words; Progress and Library stay
enabled but spend no tab; HQ attribution is off. `scripts/seed-demo-accounts.ts`
reads the same preset through HQ's `installationExperiencePreset()`.

Native identity follows the same rule: LSU's backend knows its own app because
its packaged `native-product.json` names `last-soul-ultra` and its manifest
(`HQ_NATIVE_PRODUCT=deployment/lsu/product.json`) names `com.lastsoulultra.app`.
HQ's own server no longer knows the LSU app at all.

## Enterprise onboarding decisions

Chris approved German and English, EUR 19.99/month for running and EUR 29.99/month for running plus strength on 2026-10-28. Brand experience offers draft product presets linking to the coach’s existing Store editor; each coach still supplies a real plan and method before publication. No trial is added by the presets. Standalone training plans can be sold in the same branded catalog; their paid enrollments appear in the branded library and calendar, with branded returns and ownership checks. They do not grant recurring voice/adaptation access.

Translations in `settings.translations.en` and `.de` supply headlines, descriptions and navigation labels. The browser and native controller send the account/interface language; `?locale=de` is also supported by the public API. `build:white-label --language=de` localizes packaged tab captions. Legal text remains the organization’s supplied content. Private revenue percentages and contributor shares are omitted from the public catalog.

The merchant connects payouts through the existing organization Setup page. New branded subscriptions and standalone orders retain that merchant account; changing a coach’s or organization’s account later does not redirect their billing, confirmation or refunds. Owners and admins use `GET /api/org/coaching-revenue` for balances and paginated allocation entries, `POST /api/org/coaching-revenue/payouts` to record an organization-paid settlement with a stable bank/payment reference, and `POST /api/org/coaching-revenue/orders/{orderId}/refund` for full refunds. Duplicate payment references replay safely; overpayments are refused. Refunds after coach settlement carry a negative balance forward. Currency balances remain separate.

Engineering and production acceptance are tracked in [the LSU onboarding tracker](https://github.com/stacksjs/hq.training/issues/346). Actual coach methodology, the live organization merchant, production provider budgets/privacy wording and the signed LSU store identity remain operational launch inputs.

HQ's commercial model deducts no third-party website share. LSU's own briefing proposed splitting revenue three ways, between the brand, the coaches and the developer of lastsoulultra.com; nothing in HQ implements that.

The allocation ledger is a contractual contributor statement, not a mirror of Stripe’s available balance. Dispute movements and actual application-fee refunds require provider reconciliation before live coach settlements, tracked in [issue #347](https://github.com/stacksjs/hq.training/issues/347). Cross-border tax setup remains tracked in [issue #242](https://github.com/stacksjs/hq.training/issues/242).

## Preview and acceptance history

Moved from HQ's former `docs/developers/lsu-preview.md`. HQ's generic
enterprise preview and native acceptance now use a fictional client; the
scripts and receipts named below are historical and live in HQ's history.


### Current acceptance status — October 29, 2026

HQ installs published Stacks 0.75.373, STX/components 0.2.746 and Craft
SDK/iOS 0.0.387. Current lint and typecheck pass. The last fully passing
production cohort is `5f47cd2ac`, deployed by ReviewOS run 1988 with all
95 API/E2E suites passing and the default coaching worker active. The newer
account-discovery source is waiting for its normal backend gates and deploy;
a local screen test or an available TestFlight build does not establish that
the deployed API contains it.

Actual Stripe sandbox acceptance uses HQ's own synthetic merchant with German tax
fixtures. It covers EUR 19.99 running and EUR 29.99 combined subscriptions,
German/English receipts, renewal, standalone partial/full refunds with tax
credits, a 90-day trial followed by payment, disputes and stable reconciliation
replay. Prices include tax; shares use the amount after tax. The combined-tier
receipt contains EUR 4.79 included tax. Synthetic merchant classifications do
not establish LSU's real tax treatment.

HQ TestFlight [build 134](https://github.com/stacksjs/hq.training/releases/tag/v1.0.0-build.134)
is valid, with English and German test notes and a successful Xcode Cloud run.
It contains the shared subscription account and voice entry, full HQ/LSU and
legacy white-label Store returns, and the Coaching accounts list under Me.
Build 133 remains available as the previous build; build 132 has expired through
the normal release retention. HQ TestFlight tests the shared application;
LSU's signed installation is tracked separately in
[issue 315](https://github.com/stacksjs/hq.training/issues/315).

Purchased coaching is reachable through **Me > Coaching accounts** and through
**Store > product > Manage subscription**. The account-owned list retains access
to ended subscriptions and archived catalog products. Full apps keep all HQ
tabs. Complimentary access is distinguished from an active paid renewal.
Caller installation identity stays separate from merchant/revenue ownership,
including billing and one-time workouts. See
[issue 372](https://github.com/stacksjs/hq.training/issues/372),
[issue 373](https://github.com/stacksjs/hq.training/issues/373),
[issue 374](https://github.com/stacksjs/hq.training/issues/374) and
[issue 375](https://github.com/stacksjs/hq.training/issues/375).

Fresh simulator acceptance runs on the ReviewOS Mac runner using a preview API
built from the same checkout, private PostgreSQL and published packages.
Its resource guard requires 24 GiB free and load per CPU at most 1.5. A claim or
a test launch does not establish completion. The voice/navigation workflows
explicitly do not prove a paid checkout; that requires the separate real Stripe
sandbox journey. Historical receipts below prove only their recorded versions.
Real LSU merchant setup, approved methods/privacy wording, signed LSU store
identity and current native acceptance remain launch gates in
[the onboarding tracker](https://github.com/stacksjs/hq.training/issues/346).

This local preview runs the real HQ API, PostgreSQL, Stripe sandbox subscriptions, and the configured transcription and coaching inference providers. It serves the recreated LSU site alongside HQ’s reusable web components and branded portal. All sample methods, prices and workouts are explicitly marked as demonstrations.

### Open the preview

- Website: <http://localhost:3942>
- Coaching entry: <http://localhost:3942/coaching>
- HQ portal: <http://localhost:3940/brands/last-soul-ultra>
- Fresh subscription journey: `explore@lsu-preview.test`, password `lsu-preview-only`
- Existing subscribed runner: `runner@lsu-preview.test`, password `lsu-preview-only`
- Native account with a completed sandbox purchase: `native@lsu-preview.test`, password `lsu-preview-only`
- Coach: `coach@lsu-preview.test`, password `lsu-preview-only`
- Stripe test card: `4242 4242 4242 4242`, any future expiry and three-digit CVC. Never enter a real card.

The sample monthly price is EUR 19.99. It matches the approved running tier; the preview still contains demonstration workouts and never makes live charges. A paid sandbox subscription enrolls the runner in twelve sample sessions. Stripe’s hosted checkout identifies the existing sandbox merchant, Demo Strength & Endurance; production will use the organization’s configured Connect account.

Sign in, choose the sample method, complete sandbox checkout and follow the branded return. In Feedback, record or upload a short audio message, review the transcript, then explicitly send it. Feedback can adjust only future unfinished sessions from that subscription. Supported changes offer Undo. Account supports billing management, cancellation and resuming renewal.

### Start or restart

From the HQ checkout, with the project’s pinned Bun on PATH:

```sh
LSU_PREVIEW_STRIPE_ACCOUNT=acct_<a test Connect account you own> \
bun --no-env-file --config=scripts/bunfig.toml scripts/lsu-preview.ts \
  --stripe-env <env file holding STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY> \
  --ai-env <env file holding ANTHROPIC_API_KEY> \
  --speech-env storage/lsu-preview/speech.env
```

Paths are per machine, so none are hard-coded here. `--lsu-root` defaults to `../lastsoulultra` beside this checkout (`../../lastsoulultra` from an `hq-worktrees` checkout), so pass it only when the LSU app lives elsewhere. `--stripe-bin` defaults to `stripe` on PATH, so pass it only for a vendored binary. Each `--*-env` file is read through dotenvx, so an encrypted `.env.production` beside its `.env.keys` works as well as a plain file; this repository’s own `.env.production` already carries `ANTHROPIC_API_KEY`.

Credentials are read/decrypted in memory, never printed. The runner refuses live Stripe keys and seeds only the dedicated `hq_lsu_preview` PostgreSQL database on loopback. Existing purchases and feedback survive restarts. The local app encryption key and speech key are ignored files with mode 0600. A real Stripe CLI listener forwards signed platform and Connect events to HQ. Ctrl-C stops the services; the preview occupies ports 3940, 3941 and 3942. The host must have PostgreSQL 17 or newer and the official Stripe CLI installed. Homebrew’s `postgresql@17` needs `LC_ALL` set, or the postmaster exits at startup with `postmaster became multithreaded during startup`. Where an older cluster already holds 5432, run 17 on another port and set `LSU_PREVIEW_DB_PORT` to match. The Stripe CLI needs no `stripe login`: the runner passes `STRIPE_API_KEY` from the supplied secret key. `--setup-only` migrates and seeds without serving.

### Native build

Add `--native` to regenerate the normal white-label project from the published experience. The manifest is `storage/framework/mobile/white-label/last-soul-ultra/white-label.json`; the Xcode project is under its `ios` directory. The preview bundle ID is `training.hq.gym.lsupreview`, URL scheme `lsupreview`, and social sign-in is disabled. It uses the same HQ API and brand settings as the web portal. A simulator build targets this Mac’s localhost. Physical-device testing needs a reachable HTTPS preview host and normal Apple signing/export.

Use `--setup-only --native` with the same provider flags to regenerate the native project while the preview services keep running. After building and installing it on an owned iOS simulator, run the repeatable sign-in, training, feedback controls and payment-return journey with XcodeGen on PATH:

```sh
LSU_PREVIEW_SIMULATOR=<simulator-udid> \
bun --no-env-file --config=scripts/bunfig.toml tests/native/lsu-preview.ts
```

This uses the published Stacks simulator driver and the seeded runner account. Screenshots, the accessibility tree and XCTest results are retained in ignored preview storage. Published Craft 0.0.344 preserves retained-tab receipt parameters, keeps prepared background tabs from replacing visible sign-in chrome, and stops a journey when its verification hook fails.

### Repeat the native provider journey

Checkout defaults to the seeded `checkout@lsu-preview.test` account. Checkout, purchase, native and visitor accounts have completed sandbox purchases in the validated preview. A checkout run requires an unused disposable fixture account; it refuses accounts with existing access. The explorer account is reserved for manual testing and is not accepted by the automated journey. Set `LSU_NATIVE_EMAIL` explicitly to repeat voice validation with the account used for checkout; the voice command otherwise uses the paid native account. Existing purchases are preserved when the preview restarts. On a newly seeded preview database, complete checkout in one native test so the system authentication browser stays in the foreground:

```sh
LSU_PREVIEW_SIMULATOR=<simulator-udid> LSU_NATIVE_PHASE=checkout \
bun --no-env-file --config=scripts/bunfig.toml tests/native/lsu-full-flow.ts
```

The test uses Stripe's sandbox card, declines saving it to Link, follows the payment return into Store, opens the purchased account through Me, and verifies a billing-managed subscription and twelve enrolled sessions through HQ. It stops renewal of its own synthetic purchase through the normal application API. It never confirms a payment by writing to the database.

The manual **LSU native sandbox checkout** ReviewOS workflow runs this journey for the normal full HQ installation and the legacy LSU preview installation on the repository-scoped Mac runner. It requires secrets `LSU_NATIVE_STRIPE_SECRET_KEY`, `LSU_NATIVE_STRIPE_PUBLISHABLE_KEY` and `LSU_NATIVE_STRIPE_ACCOUNT` in the separate `lsu-native-sandbox` ReviewOS environment, restricted to main, all belonging to the approved test platform and a synthetic connected merchant that accepts charges. Live keys are refused. `LSU_NATIVE_APP=hq` selects the normal HQ driver profile for a local checkout journey; the default profile remains the legacy preview. This workflow does not establish acceptance of LSU's separately signed production installation. Fresh receipts are tracked in [issue 376](https://github.com/stacksjs/hq.training/issues/376).

After checkout, test recording and adaptation with an existing macOS virtual loopback audio device:

```sh
LSU_PREVIEW_SIMULATOR=<simulator-udid> LSU_NATIVE_PHASE=voice \
LSU_NATIVE_AUDIO_DEVICE=<virtual-device-uid> \
bun --no-env-file --config=scripts/bunfig.toml tests/native/lsu-full-flow.ts
```

The fixture refuses physical microphones and virtual drivers that cannot be selected as inputs. Pinning the owned simulator to the selected virtual device and reading the route back is mandatory before recording. The host microphone and output are unchanged; the simulator input is restored on completion or interruption. BlackHole 2ch is suitable. The Teams loopback driver reports that it cannot be a default input and is refused. BlackHole 0.7.1 is installed on the validation Mac; use `LSU_NATIVE_AUDIO_DEVICE=BlackHole2ch_UID` there. The native journey checks screen/background recording cleanup, real transcription, explicit transcript review, a change to only the next session, and Undo. Provider calls are billable. A completed private verification receipt and XCTest result establish acceptance; a test launch or an intermediate screenshot does not.

### Repeat the browser voice journey

With the preview running, supply a synthetic spoken-feedback WAV fixture:

```sh
LSU_PREVIEW_AUDIO=storage/lsu-preview/sample-feedback-canonical.wav \
bun --no-env-file --config=scripts/bunfig.toml tests/browser/lsu-preview.ts
```

The acceptance test signs in through the branded form, follows the published navigation through Workouts and Feedback, and records the fixture through Chrome's real MediaRecorder. It transcribes through HQ and OpenAI, reviews and edits the text, sends feedback to the configured coaching provider, checks the canonical member responses for a change to only the next session, and verifies Undo restores all twelve complete sessions and their calendar cards. It makes real billable provider requests against the sandbox. Supply only synthetic feedback. On macOS, a fixture can be generated with `say` and converted to mono PCM WAV with the installed FFmpeg.

Set `LSU_PREVIEW_FEEDBACK_LANGUAGE=de` with a German synthetic fixture to verify German transcription and send the reviewed adaptation request in German. This writes a separate `recorded-de-voice-verification.json` receipt. The seeded account's interface language remains its configured preference.

Set `LSU_PREVIEW_CAPTURE=upload` to test the existing file-upload control with the same synthetic fixture and providers. Its separate `uploaded-voice-verification.json` receipt explicitly reports that no browser recording occurred. Recording remains the default acceptance mode.

Only the disposable test browser disables Chromium's audio-service sandbox so the fake microphone can read its fixture file. This follows the [Chromium fake-capture diagnostic](https://chromium.googlesource.com/chromium/src.git/+/167f34ae932ed8f702d9127339acbff246b4eb47); application capture settings and browser security remain unchanged. Physical microphone capture still needs a device check.

### Speech costs and privacy

The restricted OpenAI preview key expires October 31, 2026. It is stored only in `storage/lsu-preview/speech.env`. The user added USD 5 prepaid API credit. Speech uses `gpt-transcribe`, currently USD 0.0045 per minute: a five-minute message is about USD 0.0225, and thirty minutes per month about USD 0.135 per athlete. Coaching inference uses HQ's separately configured Anthropic provider, billed separately from the OpenAI credit. One measured synthetic adaptation had an estimated cost of USD 0.084; actual inference costs vary with the model, context and cache use. See [OpenAI pricing](https://developers.openai.com/api/docs/pricing) and [speech-to-text](https://developers.openai.com/api/docs/guides/speech-to-text).

HQ accepts at most five minutes / 12 MiB, does not retain original recordings, and expires private transcript receipts after 24 hours. The sample is for synthetic preview feedback. Approved production methodology, provider consent/privacy wording, the live organization merchant and signing remain launch inputs. Chris approved EUR 19.99 running and EUR 29.99 running plus strength, with payments going directly to LSU and optional HQ sharing. Coach earnings are settled by LSU.

### Verification

Completed acceptance checks:

- The latest browser recording journey used real MediaRecorder capture, returned a 166-character OpenAI transcript, and completed reviewed coaching inference with no failed requests or console errors. Sending the transcript changed only the next session from twenty to fifteen minutes; Undo restored all twelve original durations. No provider responses were mocked. The separate upload control also produced a 147-character transcript and passed adaptation/Undo checks.
- Native sign-in and Stripe sandbox checkout completed on the owned iOS simulator using published Craft 0.0.345 and STX 0.2.694. The branded payment return reopened Account with “Renews monthly”; HQ confirmed one subscription and twelve enrolled sessions. The repeated checkout passed after fixing the journey to dismiss the number pad before declining Link and submitting checkout. Its final prepared form confirms Link saving is off. The iOS Wallet card-save prompt was declined manually in Device Hub; it can appear after the driver’s short optional dismissal check. XCTest completed with zero failures (`journey-1792942720530.xcresult`).
- The native baseline verifies sign-out/sign-in, training, feedback controls, the branded notification prompt, subscription status and the receipt route. The latest build uses published Craft 0.0.345 and STX 0.2.694 without source overrides. The typography fix makes the LSU Anton heading wrap without clipping or overlap.
- Native microphone denial and a fresh system permission prompt both produce the permission error without a provider request. A foreground member refresh preserves that recording error while clearing only its own request failure. Published Craft 0.0.345 removed two empty crash-placeholder files at launch while preserving a neighboring control file. A prepublication source build also removed abandoned recordings from earlier interrupted captures. Its regression suite passed 250 native tests covering cancellation, startup deadlines, late encoder completion and safe file cleanup; Android application and instrumentation APKs compiled, and both API 34 and API 35 emulator suites passed 75 native checks with zero skips in CI.
- LSU production comparison matches all 121 headings and 580 paragraphs across twelve existing pages. Desktop/mobile browser audits check typography, overflow, images, deferred story reveals and resource sizes. Initial HTML plus loaded resources are smaller than production at both audited sizes. The embedded HQ component works across origins and delegates microphone access.
- Branded sign-in, subscription returns, the portal and embedded coaching page settled without duplicate API requests, failed requests or console errors. Signed Connect webhooks independently updated HQ after a renewal change in Stripe.

Native voice acceptance passed after installing BlackHole 2ch. The actual iOS recorder captured 16.64 seconds of synthetic speech and HQ returned a 250-character OpenAI transcript. Review left training unchanged and erased the original audio; explicitly sending edited feedback changed only the next session from thirty to fifteen minutes, and Undo restored all twelve complete session objects. Screen departure and backgrounding each erased the recording without a provider request. The owned simulator's input returned to its previous system-default route; the host microphone and speakers were unchanged. XCTest completed with zero failures (`journey-1792942068885.xcresult`), using published dependencies without source overrides. The browser recording journey also passed again after the restart with a 166-character transcript, adaptation/Undo, zero failed requests and zero console errors.

Chrome's earlier synthetic-capture startup stall no longer reproduces in the latest isolated diagnostic or complete browser journey. Both shared feedback controls show pending startup and allow cancellation. Native iOS/Android tests reject late permission answers after cancellation and verify retry; a real browser pending-start cancellation completed without an upload. The acceptance runner waits for HQ, LSU and the configured logo before provider calls, rejects failed requests and console errors, and writes a completed success receipt only after all checks pass. Browser capture acceptance uses recording mode; upload remains a separately identified test.

Published Craft fixes retain query parameters when reopening a native tab, keep AVFoundation startup off the main thread, cancel late recording startup, and erase interrupted recordings. A failed simulator control hook stops the journey before subsequent microphone commands. HQ installs Craft 0.0.345 from npm after its source, native, artifact and security acceptance gates passed. The final native preview was regenerated, compiled, installed and checked without source overrides. Crash cleanup checks use empty filesystem fixtures and do not establish microphone capture or transcription.

HQ replaces the branded sign-in screen after authentication and performs normal account revocation/local cleanup on sign-out. Shared native prompts consume the published brand theme. PostgreSQL primary-key introspection is fixed upstream in published `bun-query-builder` 0.3.21. HQ installs its framework fixes from published packages.

The final full HQ unit run with PostgreSQL enabled passed 5,660 tests with five skips and zero failures (107,977 assertions across 507 files). It includes the foreground-refresh error regression and pending-recording cancellation/retry cases. All 76 focused branded/coaching checks passed, followed by 32 controller/cohort checks, lint and type checking after installing published Craft 0.0.345. The post-restart focused run passed all 41 checks, including subscription lifecycle coverage on SQLite and PostgreSQL, with zero skips or failures; lint and type checking also passed. STX is pinned to 0.2.694. The five skips belong to the optional active-workout browser cases. Private verification receipts, screenshots, logs and XCTest results remain under ignored preview storage; the completed native voice receipt records capture, review, adaptation and restoration.

The preview now runs the standard database queue worker alongside the API and frontend, so private coach-source indexing is exercised through the normal job lifecycle. Its app icon and separate transparent launch logo are rasterized from LSU’s supplied vector artwork. Re-seeding upgrades only the old seed introduction and exact sample session titles, preserving edited methods, purchases and workout results.
