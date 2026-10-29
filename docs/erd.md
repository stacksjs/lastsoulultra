---
title: Data model and ERD
description: Explore how LSU accounts, roles, Run + Strength plans, sessions, feedback and messages relate.
---

# Data model and ERD

[Open the interactive LSU ERD](/diagrams/lsu-erd/index.html).

The diagram documents 23 related tables, all 465 physical columns in those tables and 53 declared foreign-key relationships from the deployed schema. It contains structure only: no account records, passwords, payment details, health readings or conversations. It covers the LSU review flows rather than every supporting database table.

## Explore the diagram

Use **Lens** or the search control to locate a table. Pan and zoom to inspect it, then select it to focus its relationships. The flow table below identifies the tables for accounts and roles, Run + Strength access, AI and voice feedback, and health and messages. On a phone, open the full diagram and zoom into one area at a time. The full schema is deliberately larger than a phone screen.

`PK` identifies a primary key, `FK` a foreign key and `UK` a unique key. A column can carry several roles. Unique-together notes identify compound constraints; a nullable type ends in `?`. Relationship ends distinguish one from many and optional from required. Lines represent declared foreign keys; application-level references without a database constraint remain visible as columns rather than invented relationships.

## Read the main flows

| Flow | Tables and meaning |
| --- | --- |
| Accounts and permissions | `users`, `organizations` and `org_members` associate a person with an organization role. A `coaches` or `athletes` profile is a separate capability. See [Roles and plan access](/roles). |
| A combined training tier | `products`, `coaching_methods`, `coaching_subscriptions` and `product_enrollments` describe an offer and access to it. `training_plans` and `workouts` hold the resulting calendar. Running and strength sessions can belong to one subscription. |
| AI feedback | `assistant_conversations` records a request and its response in the subscription's coaching context. `coaching_method_revisions` and `plan_drafts` support versioned methods and proposed training. See [Feedback](/training/feedback). |
| Voice review | `coaching_voice_feedback` holds the private, expiring transcript receipt. Transcription and sending feedback are separate actions. Raw recordings are temporary processing files, not a public media library. |
| Personal records | `health_metrics` belongs to an athlete. `chat_conversations` and `chat_messages` describe participant messaging. An organization role alone does not authorize reading every private record. |
| Purchases and presentation | `customers`, `orders` and `coupons` support purchases. `brand_experiences` describes the published LSU experience. Seeded complimentary access does not represent a real payment. |

## Scope and freshness

This snapshot was checked against the deployed database on 29 October 2026 (UTC). Column names and foreign keys describe stored structure; the [roles guide](/roles) describes authorization. Use both when reviewing access. Schema changes require regenerating the [diagram source](/diagrams/lsu-erd/schema.json).
