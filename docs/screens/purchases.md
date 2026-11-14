---
title: Coaching and purchase screens
description: The purpose, rationale, entry route and review context for each purchases screen.
---

<!-- Generated from resources/data/screens/inventory.json by scripts/sync-screen-guide.ts. -->

# Coaching and purchase screens

The Store, purchased content, subscriptions and checkout returns. Provider-backed purchases and complimentary review access are different records.

12 template-backed screens in this section. The source snapshot is HQ kit 1.0.4326. Names and visibility can vary by account, language and enabled Experience.

## Billing and membership

Review applicable membership, credits and billing records.

**Why this screen exists:** Separate provider-backed purchases from complimentary training access.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/billing` | runner | [Read the guide](/training/plans) |

## Branded account and payment handoff

Use a brand-specific sign-in, sign-up, password recovery or payment-return screen.

**Why this screen exists:** Preserve the selected organization and branding while an account or checkout transition completes.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/brands/[slug]/[flow]` | runner | [Read the guide](/training/plans) |

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## LSU coaching portal

Review the LSU offers, active coaching and weekly feedback in the branded portal.

**Why this screen exists:** Keep enrollment and subscription feedback together in the correct organization experience.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/brands/[slug]` | runner | [Read the guide](/training/plans) |

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Subscription workspace

Open the selected subscription's calendar, feedback, progress or method section.

**Why this screen exists:** Scope feedback and assigned training to the correct organization and enrollment.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaching/[brand]/[section]` | runner | [Read the guide](/training/plans) |

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Coaching accounts

Choose a coaching relationship or subscription available to the account.

**Why this screen exists:** Keep different coaches and methods separate.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaching` | runner | [Read the guide](/training/plans) |

## Your purchases

Review acquired products and subscriptions, confirm a returning checkout and open purchased content.

**Why this screen exists:** Use authenticated server state rather than a success URL to decide access.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/purchases` | runner | [Read the guide](/training/plans) |

## Product details and checkout

Read one offer, select required options and follow the checkout action.

**Why this screen exists:** Make the commercial decision explicit before opening the payment provider.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/store/[slug]` | runner | [Read the guide](/training/plans) |

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Store

Compare the published products and coaching packages.

**Why this screen exists:** Make the offer, seller, price and term visible before checkout.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/store` | runner | [Read the guide](/training/plans) |

## Purchased content

Open the purchased plan, video or other permitted item.

**Why this screen exists:** Check account access before presenting paid content.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/store/library/[id]` | runner | [Read the guide](/training/plans) |

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Purchased library

Browse the content made available to the account.

**Why this screen exists:** Separate browsing an offer from actually owning its content.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/store/library` | runner | [Read the guide](/training/plans) |

## Recommended equipment

Review equipment called for by workouts or the coach, split into items still needed and already owned.

**Why this screen exists:** Help an athlete prepare for the session without confusing an external equipment-shop link with a coaching purchase.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/store/recommended` | runner | [Read the guide](/training/plans) |

## Return from checkout

Continue on the website or hand back to the app, then check the actual purchase state.

**Why this screen exists:** Returning from Stripe does not itself prove a successful payment.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/store/return` | runner | [Read the guide](/training/plans) |

[Return to the screen atlas](/screens/)
