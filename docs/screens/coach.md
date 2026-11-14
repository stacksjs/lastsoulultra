---
title: Coach screens
description: The purpose, rationale, entry route and review context for each coach screen.
---

<!-- Generated from resources/data/screens/inventory.json by scripts/sync-screen-guide.ts. -->

# Coach screens

Authoring, athlete context and weekly review. A coach profile and the appropriate roster or method access are required. Read the [coach guide](/coaches) before editing or approving work.

19 template-backed screens in this section. The source snapshot is HQ kit 1.0.4326. Names and visibility can vary by account, language and enabled Experience.

## Coach assistant

Use the offered AI-assisted review and authoring tools within the installation's permissions.

**Why this screen exists:** Support the coach without confusing a draft or suggestion with an approved plan.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/assistant` | coach | [Read the guide](/coaches) |

## Athlete workspace

Inspect the selected athlete's training and available context.

**Why this screen exists:** Let a coach assess an individual without losing account ownership boundaries.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/athletes/[id]` | coach | [Read the guide](/coaches) |

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Athlete roster

Find an athlete and review available status and access.

**Why this screen exists:** Keep coaching decisions scoped to the permitted roster.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/athletes` | coach | [Read the guide](/coaches) |

## Annual training plan

Arrange races, phases and weekly load across a season.

**Why this screen exists:** Give each week a place in the longer plan.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/atp` | coach | [Read the guide](/coaches) |

## Weekly block reviews

Review a pending block, inspect feedback and edit or approve the current draft.

**Why this screen exists:** Keep AI drafting separate from a coach's decision to release the next week.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/block-reviews` | coach | [Read the guide](/coaches) |

## Coach calendar

Review or schedule the selected athlete's training.

**Why this screen exists:** Make dates, assignment and coaching context visible before saving.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/calendar` | coach | [Read the guide](/coaches) |

## Coach dashboard

Review the available training and health summaries for the selected athlete.

**Why this screen exists:** Bring signals together while preserving their source and limitations.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/dashboard` | coach | [Read the guide](/coaches) |

## Coach equipment library

Review the equipment used by authored workouts.

**Why this screen exists:** Make equipment requirements explicit before training is assigned.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/equipment` | coach | [Read the guide](/coaches) |

## Coach exercise library

Search demonstrations and manage permitted custom exercises.

**Why this screen exists:** Keep exercise instructions and equipment consistent across sessions.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/exercises` | coach | [Read the guide](/coaches) |

## Coach home

Review the athlete roster and the work that needs attention.

**Why this screen exists:** Give a coach a clear starting point for reviewing their athletes.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches` | coach | [Read the guide](/coaches) |

## Coach messages

Open roster conversations and reply in context.

**Why this screen exists:** Separate coach communication from athlete-only navigation.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/messages` | coach | [Read the guide](/coaches) |

## Training methods

Read or manage the method, knowledge and rules behind coaching packages.

**Why this screen exists:** Keep the methodology visible alongside its implementation.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/methods` | coach | [Read the guide](/coaches) |

## Plan builder

Draft a sequence of training weeks using the offered builder.

**Why this screen exists:** Keep plan authoring separate from publication and athlete assignment.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/plan-builder` | coach | [Read the guide](/coaches) |

## Coach plan library

Browse and edit reusable plans and their weeks.

**Why this screen exists:** Reuse reviewed training instead of rebuilding each assignment.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/plans` | coach | [Read the guide](/coaches) |

## Recurring athlete check-ins

Create or edit scheduled athlete check-ins, their questions, audience, cadence and date range.

**Why this screen exists:** Ask structured questions on the intended athlete calendar days; weekly subscription-block approval belongs in Block reviews.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/reviews` | coach | [Read the guide](/coaches) |

## Coach Store

Manage the offers the coach is allowed to sell.

**Why this screen exists:** Separate product authoring from a buyer's checkout.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/store` | coach | [Read the guide](/coaches) |

## Coach subscribers

Review subscribers, their access and assigned training.

**Why this screen exists:** Distinguish a subscriber's entitlement from the coach's authoring permissions.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/subscribers` | coach | [Read the guide](/coaches) |

## Coaching tips

Read or manage the available coaching tips.

**Why this screen exists:** Keep short guidance distinct from a structured plan or individual prescription.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/tips` | coach | [Read the guide](/coaches) |

## Workout builder

Create or edit structured intervals, strength sets and targets.

**Why this screen exists:** Write one coherent session before assigning it.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/coaches/workout-builder` | coach | [Read the guide](/coaches) |

[Return to the screen atlas](/screens/)
