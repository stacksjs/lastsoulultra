---
title: Data model and ERD
description: Explore LSU identity, training access, feedback and the weekly coach-review schema.
---

# Data model and ERD

LSU keeps a person's identity, management permissions and training access in separate records. The simplest way to read the model is to follow those responsibilities into the weekly training block.

<TrainingModel />

[Open the current interactive ERD](/diagrams/lsu-erd/index.html). It includes **22 tables, all 493 columns in those tables and 62 declared foreign keys**. Of those keys, 61 connect different tables and one is a self-reference retained in the fields.

## Choose an area

| You want to understand | Area | Follow |
| --- | --- | --- |
| Why a coach or administrator has particular access | Accounts and roles | `users` → organization membership, athlete and coach profiles |
| How a purchased or complimentary package supplies training | Training access | `products` → `coaching_subscriptions` → `product_enrollments` |
| Why the next week is waiting | Weekly coach review | `training_blocks` → enrollment, subscription and reviewing coach |
| Where feedback and temporary transcripts belong | Feedback and privacy | `assistant_conversations`, `coaching_voice_feedback` and `health_metrics` |

Press `/` to search for one of the tables above, then select it to highlight its relationships. Use `?` for help, `M` for the full map or `R` to trace a relationship. Select a table to focus its connections. On a phone, open the standalone diagram and zoom into one area at a time.

## Follow one training week

1. A **product** describes the package and its terms.
2. A **coaching subscription** records the person's access to that offer.
3. A **product enrollment** carries the plan snapshot and delivery state.
4. A **training block** links that enrollment to a dated draft, the runner's evidence and coach review.
5. Approved sessions reach **workouts**, which holds planned training and recorded results.

For example, a runner can have an active subscription while the next block remains in review. Billing access and approval of future sessions are different facts. A draft saved by a coach is not yet a released week.

In `training_blocks`, inspect `feedback_at`, `revision`, `reviewed_by_coach_id`, `reviewed_at` and `released_at`. They distinguish the runner's qualifying check-in, draft changes, the reviewer and release. The diagram records database constraints; [Feedback](/training/feedback) explains the user-facing sequence.

## Read keys and optional relationships

`PK` marks a primary key, `FK` a foreign key and `UK` a single-column unique constraint. A type ending in `?` allows null. Compound unique constraints are listed in the diagram's notes; they do not mean each participating column is individually unique.

A relationship end distinguishes one from many and optional from required. Lines represent declared foreign keys. A column with only an application-level relationship is not given an invented database constraint.

The self-reference `plan_drafts.parent_id → plan_drafts.id` records draft ancestry. It appears in the fields rather than as a loop. SQL enum names are preserved as declared by the migrations, rather than flattened into the older snapshot's `USER-DEFINED` label.

## Scope and freshness

This diagram is generated from the migration declarations in the pinned training kit, identified in the linked source manifest. It describes the expected schema in that source. It does not claim that a production database was inspected today or that every supporting table is included.

The [source manifest](/diagrams/lsu-erd/manifest.json) records the pin and hashes of the migrations used. There are no account rows, passwords, health readings or conversations in the artifact. Permission rules still belong to the application: read [Roles and plan access](/roles) alongside the structural diagram.

<div class="guide-next"><p>Want the process before the fields?</p><a href="/visual-guide#from-this-week-to-the-next">See the weekly training flow</a></div>
