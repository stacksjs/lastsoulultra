---
title: Screen atlas
description: Find every documented LSU app and conditional shared-kit screen, understand its purpose and review the capture coverage.
---

# Screen atlas

Use this atlas when you know the screen you want to understand. Use [Getting started](/getting-started) for your first session and [Onboarding](/onboarding) for the complete first-run sequence. The atlas explains each screen's job and why it exists; the linked guides explain the surrounding workflow.

The published atlas explains **149 app source templates** in the pinned training kit. This counts template-backed screens, not every tab, dialog, record, translation or error state. Conditional app modules are identified explicitly. Race and marketing website templates remain in the internal maintenance inventory but are excluded from this app guide. The same application views supply the web, iOS and Android implementations.


## Choose a section

| Section | What it explains |
| --- | --- |
| [Account and onboarding](/screens/account) | 19 template-backed screens |
| [Daily training screens](/screens/training) | 21 template-backed screens |
| [Health and device screens](/screens/health) | 19 template-backed screens |
| [Coaching and purchase screens](/screens/purchases) | 12 template-backed screens |
| [Messages and sharing screens](/screens/messages) | 7 template-backed screens |
| [Coach screens](/screens/coach) | 19 template-backed screens |
| [Organization screens](/screens/organization) | 20 template-backed screens |
| [Shared and conditional screens](/screens/shared) | 32 template-backed screens |

## Read a screen in context

Check the signed-in account, selected workspace and subscription before following an action. An administrator's visible tools are not a runner's entitlement. An empty chart can mean there is no connected data; an empty future week can mean feedback or coach approval is still due. A failed request should offer a visible explanation, not pretend the account has no records.

The current LSU iPhone navigation is Today, Week, Exercises, Backyard and Me. Health is a top shortcut; Progress and Workouts are under More. Store and Calendar have their own top controls. Native screens reuse much of the same view source, but a phone-width browser capture verifies only the web rendering. Check the installed app separately for native controls, permissions, hardware and return links.

## Capture and maintenance

The authored inventory is the coverage source for screenshot automation. Every template needs a documented screen or a specific reason it is outside capture scope. Dynamic routes require synthetic seeded records, and one-use links require a dedicated fixture. Never make up record ids or reuse a real person's authorization token to fill a gap.

[The capture workflow](/screens/automation) explains the reusable Stacks command, roles, fixtures, output and review checks. [Review ideas](/review-ideas) records potential improvements separately from the behavior shipped today. [Payment testing](/payment-testing) explains sandbox checkout states and error scenarios.

The coverage audit checks template inventory and generated prose. It does not mean every listed conditional route has been visually captured, and it does not replace behavioral tests.
