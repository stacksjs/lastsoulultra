---
title: Messages and sharing screens
description: The purpose, rationale, entry route and review context for each messages screen.
---

<!-- Generated from resources/data/screens/inventory.json by scripts/sync-screen-guide.ts. -->

# Messages and sharing screens

Conversations, notifications and deliberate sharing choices. Confirm the participant and account before composing or publishing.

7 template-backed screens in this section. The source snapshot is HQ kit 1.0.4323. Names and visibility can vary by account, language and enabled Experience.

## Conversation

Read and respond to the selected participant.

**Why this screen exists:** Avoid mixing private conversations across accounts.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/messages/[person]` | runner | [Read the guide](/training/messages) |

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Messages

Open an available conversation and read or compose a message.

**Why this screen exists:** Keep communication attached to the correct account and participants.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/messages` | runner | [Read the guide](/training/messages) |

## Moderation

Inspect and handle the moderation items permitted to the account.

**Why this screen exists:** Keep community administration separate from ordinary messaging.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/moderation` | runner | [Read the guide](/training/workouts) |

## Enable notifications

Review notification support and choose whether to allow it.

**Why this screen exists:** Ask for device permission in the context of its benefit.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/notifications/turn-on` | runner | [Read the guide](/training/workouts) |

## Notifications

Review account notifications and follow their destinations.

**Why this screen exists:** Provide a recoverable list of updates outside transient alerts.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/notifications` | runner | [Read the guide](/training/workouts) |

## Sent items

Review the items or invitations previously sent by the account.

**Why this screen exists:** Make follow-up possible without repeating an action blindly.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/sent` | runner | [Read the guide](/training/workouts) |

## Sharing settings

Review the available sharing relationships and controls.

**Why this screen exists:** Make visibility an explicit account choice.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/sharing` | runner | [Read the guide](/training/workouts) |

[Return to the screen atlas](/screens/)
