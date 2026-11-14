---
title: Health and device screens
description: The purpose, rationale, entry route and review context for each health screen.
---

<!-- Generated from resources/data/screens/inventory.json by scripts/sync-screen-guide.ts. -->

# Health and device screens

Measurements, supported connections and optional recovery practices. No chart is expected before its source has supplied data.

19 template-backed screens in this section. The source snapshot is HQ kit 1.0.4330. Names and visibility can vary by account, language and enabled Experience.

## Review an activity

Inspect a suggested activity and decide what to accept.

**Why this screen exists:** Keep automatic detection subject to a visible user decision.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/activity-review/[id]` | runner | [Read the guide](/training/workouts) |

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Activity suggestions

Review detected activities that need a decision.

**Why this screen exists:** Prevent a suggestion from silently becoming accepted training history.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/activity-review` | runner | [Read the guide](/training/workouts) |

## Nearby Garmin device

Find and pair supported nearby devices on a compatible host.

**Why this screen exists:** Separate a local Bluetooth capability from a server-side provider connection.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/connections/garmin-bluetooth` | runner | [Read the guide](/training/health) |

## LARQ connection

Connect a supported bottle and inspect its calibration controls.

**Why this screen exists:** Make device setup and its measurement context explicit.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/connections/larq` | runner | [Read the guide](/training/health) |

## Connected apps and devices

Choose a supported provider, review authorization and check connection state.

**Why this screen exists:** Make data access deliberate and diagnose missing imports.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/connections` | runner | [Read the guide](/training/health) |

## Eight Sleep

Review the available connected-bed settings and controls.

**Why this screen exists:** Keep a device-specific integration separate from general sleep charts.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/eight-sleep` | runner | [Read the guide](/training/health) |

## About body clock

Read how the body-clock view should be interpreted.

**Why this screen exists:** Explain a derived view before a reader treats it as a precise measurement.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/health/body-clock/about` | runner | [Read the guide](/training/health) |

## Body clock

Inspect the available circadian timing view and its explanation.

**Why this screen exists:** Make the assumptions behind the timing guidance discoverable.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/health/body-clock` | runner | [Read the guide](/training/health) |

## Health data

Review the supported measurements and data sources.

**Why this screen exists:** Help readers understand where values come from and why a chart can be empty.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/health/data` | runner | [Read the guide](/training/health) |

## Hydration

Review hydration entries and the available chart or recording controls.

**Why this screen exists:** Keep hydration history and connected-device data understandable.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/health/hydration` | runner | [Read the guide](/training/health) |

## Health and safety information

Read the current training-safety and data information.

**Why this screen exists:** Explain the documents referenced by consent and policy screens.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/health-safety` | visitor | [Read the guide](/training/health) |

## Import training

Choose the supported import source and review what will be added.

**Why this screen exists:** Give manually imported history a clear entry point.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/import` | runner | [Read the guide](/training/workouts) |

## Glucose

Inspect available glucose data and the selected unit and date.

**Why this screen exists:** Explain the record's source and context without treating it as a diagnosis.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/metrics/glucose` | runner | [Read the guide](/training/health) |

## Heart rate

Inspect heart-rate data, dates and zones from supported sources.

**Why this screen exists:** Keep an all-day signal distinct from a workout's own result.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/metrics/heart-rate` | runner | [Read the guide](/training/health) |

## Health overview

Review available measurements and open a metric's detail.

**Why this screen exists:** Bring supported data together while showing what is missing.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/metrics` | runner | [Read the guide](/training/health) |

## Nutrition today

Review the available daily nutrition view.

**Why this screen exists:** Keep today's entries distinct from nutrition preferences.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/nutrition` | runner | [Read the guide](/training/health) |

## Breathwork class

Review the practice, customize offered settings and follow its sequence.

**Why this screen exists:** Make the practice and any required agreement clear before starting.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/relax/class/[id]` | runner | [Read the guide](/training/health) |

This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.

## Relax sessions

Review practices and soundscape or journal controls.

**Why this screen exists:** Help users resume or reflect on a recovery practice.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/relax/sessions` | runner | [Read the guide](/training/health) |

## Relax and breathwork

Choose a breathing practice or inspect the available plan and BOLT controls.

**Why this screen exists:** Keep recovery practice in an optional, discoverable workspace.

| Entry | Review context | Full guide |
| --- | --- | --- |
| `/relax` | runner | [Read the guide](/training/health) |

[Return to the screen atlas](/screens/)
