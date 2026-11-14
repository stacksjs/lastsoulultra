---
title: Review findings and future ideas
description: Separate verified behavior, improvements made during review and potential next steps for the LSU experience.
---

# Review findings and future ideas

This page records product questions and useful next steps. The ideas below are proposals, not promises or descriptions of features already available. The [onboarding guide](/onboarding), [screen atlas](/screens/) and workflow guides describe the current behavior.

## Clarifications made during this review

The documentation now focuses on the shared app account, separate preview gate and embedded application boundary; the iPhone navigation follows LSU's product configuration; and onboarding explains how role-specific questions, replay and setup differ from buying coaching or publishing a training week. Payment return checks use server state and distinguish a failed status request from a payment still processing.

The screen inventory makes shared-platform routes visible without implying that every feature is enabled for LSU athletes. The screenshot workflow records failures and explained exclusions rather than silently publishing a login page as a successful account screen.

## Make the next week easier to understand

**Idea:** give the Week screen a compact explanation of the next required action: feedback not open yet, feedback due, awaiting review or the next block ready.

**Why:** an empty future calendar can look like missing training even when it is the correct feedback/approval state.

**Acceptance check:** the explanation uses the account's time zone and actual block state, links to the correct subscription feedback, and does not claim that an AI reply releases training. Test early feedback, qualifying feedback, late review and a block that has already partly elapsed.

## Explain which progress view is open

**Idea:** put a short scope label beside Progress: account-wide recorded training or a subscription's assigned/completed training.

**Why:** the same word can otherwise suggest the totals should match.

**Acceptance check:** an athlete with imported activities and assigned sessions can identify why the two views differ without leaving the page. Counts and time ranges use the same source definitions as the labels.

## Show the account's onboarding reason

**Idea:** introduce a coach, staff or athlete tour with a short explanation of why that tour was selected, plus a route back to account/workspace selection.

**Why:** an administrator who also has a coach profile follows the coach tour. A generic organization-role description does not explain that priority.

**Acceptance check:** the explanation follows capability and permission checks, never offers a way to grant oneself access, and stays accurate after changing accounts.

## Make setup recovery inspectable

**Idea:** show completed, failed and unfinished setup tasks together, with a retry action limited to unfinished tasks.

**Why:** a partially completed setup is easier to recover when it names what changed. Replaying should not invite the same athlete again or create duplicate starters.

**Acceptance check:** interrupt setup between tasks, reopen it, retry and confirm idempotent behavior. Preserve the person's consent choices and make failures visible.

## Keep examples close to real review data

**Idea:** use model relationships, native factories and tagged application seeders to maintain small synthetic fixtures for every important UI state.

**Why:** screenshots become less useful when they show empty panels, invented ids or data unrelated to the flow being documented.

**Acceptance check:** fixture planning reports missing required values and parent dependencies; capture binds dynamic routes to existing synthetic records; an empty state is intentional; and a dedicated disposable environment is used for record creation. Never reset a shared or production database as a side effect of documentation capture.

## Expand the capture matrix deliberately

**Idea:** maintain a small core set on every UI change, with a full role/viewport/state capture for releases. Add native simulator review for permissions, checkout returns, hardware connections and offline use.

**Why:** a route inventory prevents missing pages, while state and native checks cover behavior a single top-of-page image cannot show.

**Acceptance check:** the report identifies source/build, viewport, role and capture failures, and reviewers see changed images alongside their prose. A screenshot of a blocked screen is not counted as a successful capture of its intended content.

## Improve checkout recovery without guessing payment state

**Idea:** provide a dedicated **Check payment status again** action and a support reference on purchase confirmation errors.

**Why:** a network failure after checkout should not encourage another payment or leave the buyer wondering whether the first one succeeded.

**Acceptance check:** decline, cancelled authentication, return before webhook, unavailable confirmation, duplicate return and renewal failure all lead to visible, recoverable states. Only authenticated server/provider confirmation grants paid access. Use the [sandbox matrix](/payment-testing) and record which cases were actually executed.
