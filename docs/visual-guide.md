---
title: Visual guide
description: See how LSU accounts, weekly training, race confirmation and the data model fit together.
---

# Visual guide

Start here when you want the shape of a process before its details. Each visual has a short explanation and a link to the full guide or interactive diagram.

## Three kinds of access

The preview gate, training account and race-entry account have different jobs. Use the credentials for the screen you are opening.

<AccountMap />

For the first sign-in, follow [Getting started](/getting-started). To switch a shared review login, use [Your account](/my-account#switch-roles-safely).

## From this week to the next

Current catalog packages release seven days at a time. The next week passes through both your feedback and LSU's coach review.

<WeeklyTraining />

For a block ending on Sunday, qualifying feedback starts on Friday. A message earlier in the week remains useful context, but does not satisfy that check-in. An AI reply and coach approval are different events. Read [Feedback and weekly coach review](/training/feedback) for the complete path.

<details>
<summary>Open the interactive training workflow</summary>
<iframe class="guide-diagram" src="/docs/diagrams/weekly-training/index.html" title="Interactive workflow for LSU weekly training" loading="lazy"></iframe>
</details>

## From a selected place to a confirmed entry

A race application asks for a place. If LSU selects it, these three tasks confirm that place. They can be completed in any order.

<RaceConfirmation />

Check the deadline and the service's final status in your race-entry Profile. Returning from checkout alone does not prove payment succeeded. [Race information](/races#confirm-a-selected-place) explains the required fields and agreement version.

## Read a workout's movement figures

The fictional Strength A session includes the two movements below. The sampled poses help you recognize the exercise; the linked catalog provides the larger figure and animation.

<WorkoutFigures />

The full reference covers [184 exercises](/training/exercise-library) and [178 movement figures](/style-guide/illustrations). A figure is a shared demonstration, not a new training prescription. Use the instructions and equipment listed in your own session.

## How the records connect

The data model separates identity, access and the delivery of training. That distinction explains why an administrator can manage LSU without automatically receiving a training plan.

<TrainingModel />

The [data model guide](/erd) explains keys, relationships and the current schema's scope. The full interactive ERD is intended for exploring fields and tracing relationships; search for `training_blocks` and select it to highlight the weekly-review relationships.

<div class="guide-next"><p>Ready to use the app?</p><a href="/getting-started">Continue with Getting started</a></div>
