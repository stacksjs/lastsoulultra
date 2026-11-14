---
title: Visual guide
description: See how LSU app access, weekly training and the data model fit together.
---

# Visual guide

Start here when you want the shape of a process before its details. Each visual has a short explanation and a link to the full guide or interactive diagram.

## One account across the apps

Your LSU account supplies the web and installed native apps. A host website can embed the app without receiving the account's credentials.

<AccountMap />

For first sign-in, follow [Getting started](/getting-started). To switch a shared review login, use [Your account](/my-account#switch-roles-safely). [Web-component integration](/integration) explains the embedded boundary.

## From this week to the next

Current catalog packages release seven days at a time. The next week passes through both your feedback and LSU's coach review.

<WeeklyTraining />

For a block ending on Sunday, qualifying feedback starts on Friday. A message earlier in the week remains useful context, but does not satisfy that check-in. An AI reply and coach approval are different events. Read [Feedback and weekly coach review](/training/feedback) for the complete path.

<details>
<summary>Open the interactive training workflow</summary>
<iframe class="guide-diagram" src="/docs/diagrams/weekly-training/index.html" title="Interactive workflow for LSU weekly training" loading="lazy"></iframe>
</details>

## Read a workout's movement figures

The fictional Strength A session includes the two movements below. The sampled poses help you recognize the exercise; the linked catalog provides the larger figure and animation.

<WorkoutFigures />

The full reference covers [184 exercises](/training/exercise-library) and [178 movement figures](/style-guide/illustrations). A figure is a shared demonstration, not a new training prescription. Use the instructions and equipment listed in your own session.

## How the records connect

The data model separates identity, access and the delivery of training. That distinction explains why an administrator can manage LSU without automatically receiving a training plan.

<TrainingModel />

The [data model guide](/erd) explains keys, relationships and the current schema's scope. The full interactive ERD is intended for exploring fields and tracing relationships; search for `training_blocks` and select it to highlight the weekly-review relationships.

<div class="guide-next"><p>Ready to use the app?</p><a href="/getting-started">Continue with Getting started</a></div>
