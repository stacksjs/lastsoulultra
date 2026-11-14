---
title: Troubleshooting
description: Resolve preview access, LSU sign-in, missing training, weekly review and service problems.
---

# Troubleshooting

## The browser keeps asking for a password

Use the shared preview username and password. A personal training password does not unlock that browser dialog. The gate protects the race site, this guide and their assets; the training website and iPhone app use LSU account authentication instead.

If the dialog returns only when you open a fresh private session, that session may simply have forgotten the shared preview credentials.

## I can open the site but cannot see training

Open a training section and confirm the account name. The race site sends private sections to the training app. A visitor without an enrollment has no subscriber sessions. Alex or Jamie should have fictional sample training; a newly created account may correctly be empty.

Check the subscription, current date range and published sections before assuming data was lost. Sign out and back in if another tab changed accounts.

## Signing up offers Continue with HQ

The current LSU installation disables HQ sign-in. If an older screen offers it, check that you are on `training.lsu.stacksjs.com` or using the current LSU app, then reload or update the app. Use the LSU account login. An HQ email address by itself does not grant an LSU session.

## Continue with HQ or Sign in with Apple does not work

HQ sign-in is disabled for LSU. Social providers work only when configured for the installation; use the options shown on the current sign-in screen. An LSU password login requires a usable password, not merely an account record.

For a newly provisioned installation administrator, ask the operator to set up the LSU password first. Demo `.test` addresses cannot receive reset mail. Use their current protected [credentials](/demo#demo-credentials).

## The welcome tour opened

It appears during first-time setup. Choose **Skip** to leave it. **Settings** → **Take the tour again** makes it available later.

## I cannot enter administration

Use an owner or administrator account and select **Last Soul Ultra** in the workspace menu. On iPhone, management is offered under **Me** → **Manage Last Soul Ultra** for permitted staff. A coach profile or training enrollment does not grant organization administration.

If a role just changed, sign out and back in. Check the actual permission error; a visible menu item does not override server authorization.

## A page says an offer or section is unavailable

Check whether LSU has published that section. For an offer, an administrator should verify the published method, author membership, active product, eligible plan and monthly billing setup. The public offer is filtered again when read, so later changes can make it disappear. See [Administration](/administration#manage-offers-and-methods).

## Next week's calendar is empty

The current catalog releases seven days at a time. Check the subscription's feedback prompt and review status. Feedback starts counting two days before the current block ends; a message sent earlier does not release the next block.

After qualifying feedback, an LSU coach still needs to approve the next draft. The AI conversation does not approve it. Do not purchase the plan again to fill an empty week. If approval is confirmed but sessions remain missing, refresh once and report the dates and subscription.

The older Alex and Jamie demo calendars were populated with eight weeks at setup. They are not evidence that a current catalog enrollment should receive twelve weeks immediately.

## Voice recording or transcription fails

Use HTTPS and allow microphone access for the training page or app. Check the selected input device. A recording or uploaded file must be no longer than five minutes and no larger than 12 MiB. The private speech service can also be busy or unavailable.

Type feedback if the audio path fails. Review any transcript before sending it, and check whether the message already appeared before retrying. If the browser offers separate dictation, remember that it uses the browser's speech service.

## Feedback sends but no reply arrives

Check the correct subscription conversation for the sent message. A reply can depend on AI availability and configured budget. If it remains pending after a minute or two, refresh once, then report the time and visible status. Avoid sending the same message again.

The next training block can remain in coach review even after an AI reply arrives. These are different stages. LSU's general assistant provides insights and does not automatically change workouts.

## Billing actions are unavailable for a demo

Complimentary demo access has no payment-provider subscription to cancel or refund. Review its status and existing sessions. Purchase testing requires a separate test account and a confirmed sandbox configuration, as described in the [demo walkthrough](/demo#7-do-not-test-payments).

## Race payment returned but the place is not confirmed

Open the race-entry **Profile** and check the current agreement, saved race details and payment status. All required tasks must be complete. A checkout return is not a payment receipt from the race service. Contact the organizer with the entry reference if the status remains pending; do not repeatedly pay or apply.

## What to include in a report

Include the page, role, action, expected result, actual result, visible error, time and time zone. For a calendar issue, include the subscription and affected dates. For an app issue, include the build number. Keep passwords, session tokens, health information and card data out of shared reports. Use LSU's [Contact page](https://lsu.stacksjs.com/contact) for the published support route.
