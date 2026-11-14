---
title: Shared and conditional screens
description: The purpose, rationale, entry route and review context for each shared screen.
---

<!-- Generated from resources/data/screens/inventory.json by scripts/sync-screen-guide.ts. -->

# Shared and conditional screens

Optional app modules and screens requiring a particular published profile, hardware or one-use link. Each is accounted for here. An explained exclusion is not a claim of visual verification.

32 template-backed screens in this section. The source snapshot is HQ kit 1.0.4333. Names and visibility can vary by account, language and enabled Experience.

## Public athlete profile

Read a published athlete biography, achievements and shared training activity.

**Why this screen exists:** Sharing settings determine what visitors can see; a private or unknown profile remains unavailable.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/[username]` | runner | [Read the guide](/getting-started) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Activity embed

Display a compact published-activity card inside another website.

**Why this screen exists:** Give host pages a responsive card with its own theme, rather than embedding the complete application.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/a/[id]/embed` | runner | [Read the guide](/training/progress) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Published activity

Read one deliberately published activity, including its recorded route and training statistics.

**Why this screen exists:** Let an athlete share a specific completed activity without granting access to the private account.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/a/[id]` | runner | [Read the guide](/training/progress) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Partner-provider check-in

Choose the supported membership aggregator and provide the required check-in reference.

**Why this screen exists:** Record partner attendance under its own provider agreement rather than assuming direct membership.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/check-in/[token]/aggregator` | runner | [Read the guide](/roles) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Door or membership check-in

Use a door poster code or membership-card token to enter the permitted check-in flow.

**Why this screen exists:** Resolve the intended location and member context before recording a visit.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/check-in/[token]` | runner | [Read the guide](/roles) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Claim a directory listing

Submit evidence that you are authorized to manage a listed person or organization.

**Why this screen exists:** A reviewed claim protects a public listing from unauthorized ownership changes.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/claim` | runner | [Read the guide](/getting-started) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

## Public club profile

Read a published club profile, people, locations and available classes.

**Why this screen exists:** Present public organization information without exposing internal management tools.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/clubs/[slug]` | runner | [Read the guide](/getting-started) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Connect / App

Provider/application handoff that requires a real authorization context.

**Why this screen exists:** Keep shared-platform routes visible in the inventory without presenting them as enabled LSU features.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/connect/app` | runner | [Read the guide](/getting-started) |

**Capture scope:** Provider/application handoff that requires a real authorization context.

## Connect / Hq

Legacy HQ connection handoff; LSU disables HQ sign-in.

**Why this screen exists:** Keep shared-platform routes visible in the inventory without presenting them as enabled LSU features.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/connect/hq` | runner | [Read the guide](/getting-started) |

**Capture scope:** Legacy HQ connection handoff; LSU disables HQ sign-in.

## Organization enquiry

Send an enquiry to the selected published organization.

**Why this screen exists:** Route a prospective customer to the correct organization before any membership commitment.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/enquire/[slug]` | runner | [Read the guide](/getting-started) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Discovery category

Browse the selected kind of public directory or training content.

**Why this screen exists:** Narrow discovery to a relevant category without exposing private records.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/explore/[kind]` | runner | [Read the guide](/getting-started) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Public discovery

Browse the shared platform discovery catalog.

**Why this screen exists:** Help visitors find published content outside their own private training workspace.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/explore` | runner | [Read the guide](/getting-started) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

## Public workout detail

Read a published workout from the discovery catalog.

**Why this screen exists:** Explain the session before a visitor chooses any permitted follow-up action.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/explore/workouts/[id]` | runner | [Read the guide](/getting-started) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Member class timetable

Browse and book classes permitted by the selected gym membership.

**Why this screen exists:** Keep capacity, bookings and membership eligibility attached to the correct organization.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/gym/classes` | runner | [Read the guide](/roles) |

**Capture scope:** Gym class booking; it requires a relevant membership and class fixture.

## Member visit history

Review recorded gym visits and attendance.

**Why this screen exists:** Keep attendance records separate from athlete workout history.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/gym/history` | runner | [Read the guide](/roles) |

**Capture scope:** Gym visit history; coaching workouts are recorded separately.

## Member home

Find the selected gym membership, classes and member tools.

**Why this screen exists:** Give members a relevant home without treating a coaching subscription as a gym membership.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/gym` | runner | [Read the guide](/roles) |

**Capture scope:** Gym membership home; it requires gym capability, which LSU runner accounts do not have.

## Create an organization

Start the shared platform organization-creation flow.

**Why this screen exists:** Separate organization setup from ordinary athlete onboarding.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/gym/new` | runner | [Read the guide](/roles) |

**Capture scope:** Organization-creation flow; ordinary LSU athletes do not create a new gym during onboarding.

## Gym member shop

Review purchases offered in the membership context.

**Why this screen exists:** Keep gym products and their access rules separate from LSU coaching offers.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/gym/shop` | runner | [Read the guide](/roles) |

**Capture scope:** Gym shop; it is not LSU coaching enrollment.

## Gym shop return

Recover the gym-shop purchase context after hosted checkout.

**Why this screen exists:** Return to the correct membership destination while server confirmation determines fulfillment.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/gym/shop/return` | runner | [Read the guide](/roles) |

**Capture scope:** Gym-shop checkout handoff; requires its own sandbox transaction context.

## Gym confirmation handoff

Complete the confirmation step associated with a specific gym flow.

**Why this screen exists:** Keep a confirmation attached to its organization and issued context.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/gyms/[slug]/confirm` | runner | [Read the guide](/roles) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Public gym profile

Read a published gym profile and its available locations, people and joining options.

**Why this screen exists:** Help a prospective member understand the organization before starting its own enrollment flow.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/gyms/[slug]` | runner | [Read the guide](/roles) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Join an organization

Review the selected organization, location and membership choices.

**Why this screen exists:** Keep a gym membership purchase distinct from an LSU coaching subscription.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/join/[slug]` | runner | [Read the guide](/roles) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Membership checkout return

Return from a membership checkout and open the corresponding application destination.

**Why this screen exists:** Recover the membership context across the browser and app handoff; the return itself is not proof of payment.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/join/return` | runner | [Read the guide](/roles) |

**Capture scope:** Membership checkout handoff; requires its own sandbox transaction context.

## Shared live session

Follow a live training session through the deliberately issued sharing link.

**Why this screen exists:** Scope access to a specific live session; withdrawn or invalid links remain unavailable.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/live/[token]` | runner | [Read the guide](/training/progress) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Live session discovery

Browse the deliberately published live-session list.

**Why this screen exists:** Make discoverable sessions available without revealing private live links.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/live` | runner | [Read the guide](/training/progress) |

**Capture scope:** Live-session discovery; a published live fixture is required for useful review.

## Membership keepsake

View the account identity card and its read-only onboarding replay.

**Why this screen exists:** Opening a keepsake must not restart setup, create a plan or change a membership.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/membership-card` | runner | [Read the guide](/getting-started) |

**Capture scope:** Membership-only presentation; coaching access does not imply gym membership.

## Personal plan builder

Draft a self-authored training plan using the shared platform builder.

**Why this screen exists:** Provide personal planning where enabled; LSU coaches supply training through coaching packages instead.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/plans/builder` | runner | [Read the guide](/getting-started) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

## Personal training plans

Manage self-authored plans and their calendar placement.

**Why this screen exists:** Keep personal plan editing separate from coach-authored subscription blocks.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/plans` | runner | [Read the guide](/getting-started) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

## Coach check-in questionnaire

Answer a coach-authored check-in using the supplied scales and written questions.

**Why this screen exists:** Keep structured personal check-ins distinct from workout feedback and weekly subscription feedback.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/review/[id]` | runner | [Read the guide](/training/progress) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Shared progress link

Read the progress an athlete deliberately exposes through a revocable link.

**Why this screen exists:** The link is the credential; private account access is not granted and unavailable links share a generic response.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/share/[token]` | runner | [Read the guide](/training/progress) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Public studio profile

Read a published studio profile and available classes, people and locations.

**Why this screen exists:** Provide a public introduction without granting member or administrator access.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/studios/[slug]` | runner | [Read the guide](/getting-started) |

**Capture scope:** Requires a specific published profile, organization or one-use sharing fixture; it is not an entry point in the LSU athlete flow.

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Marketing unsubscribe

Review the channel identified by an issued marketing link and confirm the unsubscribe action.

**Why this screen exists:** Require a deliberate choice so an email scanner opening the link does not change notification preferences.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/unsubscribe` | runner | [Read the guide](/getting-started) |

**Capture scope:** One-use communication preference link; never use a real recipient token for screenshots.

[Return to the screen atlas](/screens/)
