---
title: Demo walkthrough
description: Review the private preview as a visitor, runner, coach and administrator.
---

# Demo walkthrough

This walkthrough and all demo credentials are protected by the same preview login as the race site. The seeded review training and conversations are fictional demonstration content. The authored twelve-week catalog is a separate set of records.

The [roles page](/roles) maps all twelve accounts and explains organization permissions versus training entitlements.

## Demo credentials

Use [Training](https://lsu.stacksjs.com/coaching/calendar) for athlete and browsing accounts, [Administration](https://lsu.stacksjs.com/admin) for Sam and Pawel, and the [Coach workspace](https://lsu.stacksjs.com/coach) for the coach. The race-entry Profile has a separate account system.

<DemoCredentials :accounts="data.demoAccounts" />

These are shared review accounts. Their `.test` addresses do not receive email. Use the listed passwords rather than email recovery, and keep real personal or payment information out of them. Complete your own policy choices when a workspace asks. If the welcome tour opens on first sign-in, choose **Skip**; it stays available from **Settings**.

The two real administrators, Chris Breuer and Pawel Dregan, sign in with their own accounts. Those are not review accounts and are not listed here. See [Roles and plan access](/roles#installation-administrators).

## 1. Check the preview gate

Open the site in a private browser window. Confirm that it asks for the shared preview credentials. Open this guide in that same window and confirm it uses the same gate.

## 2. Browse as a visitor

Sign in with the visitor account. Open Coaching and inspect the published offer. Confirm that private subscriber workouts are not available to a visitor without an enrollment.

Then open the training app's [store](https://training.lsu.stacksjs.com/store). Distinguish the current twelve-week catalog packages from the fictional RUN/SOUL review tiers and the six older one-off demo plans under Pawel Dregan's coach profile. Read them, but do not buy or take one on a shared account: a plan you take lands on that account's calendar for every other reviewer. See [Plans and subscriptions](/training/plans#demo-plans-in-the-store).

## 3. Review an enrolled athlete

Use Alex or Jamie. Both accounts use the same fictional SOUL tier with complimentary review access (see [Plans and subscriptions](/training/plans)). Open Workouts, inspect a completed session and a future session, then check Progress and The method. Each enrolled athlete starts with 48 sessions: 32 running and 16 strength, with 21 sessions completed at setup. Each also has 21 days of sample health metrics. The sample dates include recent history and upcoming sessions. Counts can change as reviewers complete or edit training.

Open a **Strength A** or **Strength B** session. Inspect its illustrated exercises, blocks and sets, and try ticking off a set. Compare it with a running session and its timed steps. The two disciplines belong to the same plan.

Open **Say how it felt**, select the combined method, and send a fictional training note. Wait for its AI response; if none arrives, see [Troubleshooting](/troubleshooting#feedback-sends-but-no-reply-arrives). Then record a short voice note or upload an audio file, transcribe it, review and correct the text, and send it. A completed transcript has not been submitted until you choose **Send feedback**. The current assistant provides insights; do not expect an automatic calendar rewrite. Both enrolled demo athletes can use these flows. See [Feedback](/training/feedback).

Open Health and Messages to inspect any supplied sample records. Avoid connecting real devices or entering personal information.

Open the [Style Guide](/style-guide/) to review the typefaces, colors and interface specimens alongside the workout figures.

If you have the iPhone app, sign in there as Alex too. Check the five tabs, then open **Me** → **Coaching accounts** and confirm that **SOUL** is listed. Its screen holds **Training feedback**, **Training progress** and **Your methods**.

## 4. Review the coach

Use a fresh session and the coach account. Open the [coach workspace](https://lsu.stacksjs.com/coach) and inspect the sample method and plan. Also open [Block reviews](https://training.lsu.stacksjs.com/coaches/block-reviews). A current catalog enrollment waits for feedback and coach approval before its next week reaches the calendar. The older seeded demo calendars do not exercise that release path, so use a dedicated test enrollment when reviewing it. Then open the [exercise library](/training/exercise-library) and [illustration catalog](/style-guide/illustrations). The demo plans do not prescribe every exercise in the reference. Keep demonstration methodology clearly identified as sample content.

## 5. Review administration

Open [Administration](https://lsu.stacksjs.com/admin) with Sam's or Pawel's administrator account. Complete your own policy choices if prompted. Administration opens the LSU Experience directly; verify that its settings and linked offers load. Use the workspace menu to reach the other management tools. Confirm that an athlete account cannot perform the same management action.

Explore the [data model and ERD](/erd) to trace account permissions, subscriptions, workouts and feedback.

## 6. Check the role boundaries

These five accounts exist to prove where one role stops, not to show LSU screens of their own.

Sign in as the demo manager and inspect the available staff controls. If testing role changes, use a designated temporary member and restore the original role afterwards. Do not change the shared trainer or coach: other reviewers depend on them. An attempt to grant administrator access should be refused with "Only the owner or an admin can change who is an admin". The Experience should refuse a manager's save with a permission error.

Sign in as the demo front desk and confirm that scheduling changes, refunds and reports are not available. Sign in as the demo trainer and confirm the training areas open but the desk and back office do not. Sign in as the demo member and confirm it reaches its own account and nothing else. The demo owner differs from an administrator in one way only: it can delete the organization. Do not.

If a role boundary here does not matter to LSU, say so in your review notes. Whether LSU needs all six roles is a fair question, and these five accounts are the evidence for answering it.

<span id="7-do-not-test-payments"></span>

## 7. Review payment testing separately

Sample training access is not a paid order and carries no real payment-provider subscription. The review accounts already hold the tier with complimentary access, so there is nothing to buy in order to review training.

On these shared review logins, do not enter a card, your own or a test one, and do not try to bill, refund or reverse a charge against a seeded record. The documented deployment uses a Stripe sandbox, but purchase testing still needs a dedicated throwaway account and confirmation that the target checkout is in test mode. Use that separate setup for test-card purchases, following [Payment testing and error scenarios](/payment-testing). Never apply those tests to the complimentary shared accounts or to the separate production race-entry service.

## Review notes

To switch roles, use sign-out where available or start a clean browser session as described in [Your account](/my-account#switch-roles-safely). Separate private windows can share a login until all private windows are closed.

Record the account role, page and observed behavior. Send feedback to the person who supplied the handoff. Keep passwords out of screenshots and shared issue reports.

## Admin and coach workspaces

[Administration](https://lsu.stacksjs.com/admin) opens LSU’s Experience settings directly for Sam and Pawel. [Coach workspace](https://lsu.stacksjs.com/coach) opens methods, with [Exercises](https://lsu.stacksjs.com/coach/exercises) and [Subscribers](https://lsu.stacksjs.com/coach/subscribers) in the workspace navigation. Both workspaces use the app’s controls and grouped layouts, with LSU’s black surfaces, red actions, Anton headings and Inter body text. The race site and this guide use Barlow. On a phone, open **Workspace menu** to reach the other tools and sign out. Links and saved changes stay in the LSU organization. The preview password also protects these entry pages.
