---
title: Roles and plan access
description: Understand LSU account permissions, the €29.99 Run + Strength tier and every private review account.
---

# Roles and plan access

An account's **organization role** controls what it can manage. Its **training enrollment** controls which plan and disciplines it receives. A coach profile provides an authoring workspace. These are separate: buying a plan does not make someone a coach or administrator, and being an administrator does not automatically enroll someone in training.

## The €29.99 tier includes running and strength

The private review offer is **Running and strength, demo**, shown at **€29.99 per month, tax included**. Both disciplines belong to one tier and one athlete calendar. Each enrolled demo athlete has the same eight-week sample: four running sessions and two structured strength sessions per week, for 48 sessions in total.

**Alex and Jamie are two people reviewing the same combined tier.** The names `runner@lsu-demo.test` and `runner2@lsu-demo.test` are historical login labels, not separate running-only roles. Both accounts can review running and strength, including exercise illustrations, sets and set-completion controls. A separate strength login is not required.

These accounts have complimentary review access. No payment-provider subscription or real charge is attached. The sample offer does not include personal one-to-one coaching or Mind training. The published offer defines the disciplines for any other tier. See [Plans and subscriptions](/training/plans).

For the stored relationships behind these distinctions, see the [data model and ERD](/erd).

## Organization roles

| Role | What it represents | Review focus |
| --- | --- | --- |
| Owner | The organization owner | LSU ownership, settings and member administration |
| Administrator | An administrator within LSU | Organization settings, members and the published Experience |
| Manager | Day to day operations staff | Members, plans, scheduling, refunds, reports, staff and the access system. Cannot change organization settings, cannot set up or change payment accounts, and cannot make anyone an administrator |
| Front desk | A desk staff member | Permitted member and front-desk operations |
| Trainer | A training staff member | Permitted training and staff areas |
| Member | An LSU organization member | Their own account and member-facing access |


Manager is the role for someone who runs LSU day to day without holding the organization itself or its money. It sits between front desk, which cannot change a schedule, issue a refund or see reports, and administrator, which can do everything an owner can except delete the organization. For LSU specifically the role adds nothing a reviewer will see, because everything it grants over front desk covers point of sale, door access, class scheduling, ranks and payroll, and none of those are among the sections LSU has switched on.

Owner and administrator accounts can manage the LSU **Experience**. The other supplied roles cannot save those settings. Staff access to a particular feature still depends on its permission checks. A trainer's organization role and a coach's authoring profile are separate, even when a person has both.

The demo visitor has no organization membership. “Visitor” describes its browsing access, not a staff role.

Sam and Pawel are **LSU organization administrators**. Their access applies to the Last Soul Ultra workspace and does not grant administration over other organizations.

## Private review accounts

All demo passwords are listed in the protected [demo walkthrough](/demo#demo-credentials). All accounts and sample data are fictional.

| Person or account | Login | Organization role | Training or authoring access |
| --- | --- | --- | --- |
| Sam | `sam@lsu-demo.test` | Administrator | LSU administration and Experience review |
| Pawel | `pawel@lsu-demo.test` | Administrator | LSU administration and Experience review |
| Demo owner | `owner@lsu-demo.test` | Owner | Organization ownership review |
| Demo administrator | `admin@lsu-demo.test` | Administrator | General administration and sample club conversation |
| Demo manager | `manager@lsu-demo.test` | Manager | Operations review |
| Demo front desk | `frontdesk@lsu-demo.test` | Front desk | Desk operations review |
| Demo trainer | `trainer@lsu-demo.test` | Trainer | Training staff and separate coach workspace |
| Demo coach | `coach@lsu-demo.test` | Trainer | Author of the sample method and plan; coach library |
| Alex | `runner@lsu-demo.test` | Member | Enrolled in €29.99 Run + Strength; sample calendar and health |
| Jamie | `runner2@lsu-demo.test` | Member | Same €29.99 Run + Strength tier; independent sample calendar and health |
| Demo member | `member@lsu-demo.test` | Member | Member account without the combined training enrollment |
| Demo visitor | `visitor@lsu-demo.test` | None | Browsing without the combined training enrollment |

The trainer and coach accounts have coach profiles; the published sample belongs to the demo coach. Member and visitor accounts help check the experience without an enrollment. Subscriber health and training remain private to the signed-in athlete; a staff title alone is not permission to read every athlete's private data.

## Start with the right workspace

For training, open [Workouts](https://lsu.stacksjs.com/coaching/calendar) with Alex or Jamie. Compare a run with **Strength A** or **Strength B**, then inspect Progress, Library and Health. The sample club conversation is attached to Alex and the general demo administrator.

For authoring, use the demo coach and open the [coach workspace](https://lsu.stacksjs.com/coach) or [coach exercise library](https://lsu.stacksjs.com/coach/exercises). For management, use Sam or Pawel and open [Administration](https://lsu.stacksjs.com/admin), which opens the LSU Experience directly. Use the workspace menu for team, member and organization settings. Complete your own policy choices if prompted.

Use sign-out or a separate browser profile when changing accounts. Private windows in one browser can share the same session. The shared preview password unlocks the website and docs; the email and personal password select your app account. See the [demo walkthrough](/demo) and [Your account](/my-account#switch-roles-safely).
