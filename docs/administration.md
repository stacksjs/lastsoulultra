---
title: Administration
description: Manage LSU organization access, published experience settings and offers.
---

# Administration

## Enter the LSU workspace

Open [Administration](https://training.lsu.stacksjs.com/staff/experience) and sign in with an LSU owner or administrator account. Use the account menu to enter the organization or staff workspace and select **Last Soul Ultra**. Confirm the organization name before changing anything. On first sign-in, read the policies and complete your own consent choices before continuing.

The Sam and Pawel review accounts are organization administrators. Inside Last Soul Ultra that is everything the owner can do except delete the organization. Among other things, such an account can change what the organization charges, issue refunds, alter staff and read payroll figures, so treat it as full access rather than as a limited review login. They grant nothing over any other organization.

For the full account map and the difference between permissions and training subscriptions, see [Roles and plan access](/roles).

In the iPhone app, an owner, administrator or manager reaches the same tools from **Me** → **Manage Last Soul Ultra**.

## Who runs the organization

The installation's deployment settings list its administrators by email. Today the list holds the HQ account addresses and the LSU addresses of Chris Breuer and Pawel Dregan. Every deploy runs `buddy installation:admins`, which makes each listed address an active administrator of Last Soul Ultra and gives it an athlete profile and a coach profile, so one account opens every athlete and coach tool. An address with no account gets one with a verified email and no usable password. LSU disables HQ sign-in, so an operator must provision an LSU password before that person can sign in. The administrator list grants organization access; it does not authenticate the person or copy an HQ training history.

To add an administrator, add their email to `admins` in `enterprise/deployment.json` and deploy. The list only grants: it never turns the owner into an administrator, and removing an address does not take the role away. Change or remove a role in the staff screen, under the rules in [Manage access](#manage-access).

## Roles and permissions

| Role | Purpose |
| --- | --- |
| Owner | Owns the organization and its settings |
| Administrator | Everything an owner can do except delete the organization: payment setup, pricing, refunds, staff changes, the access system and payroll figures |
| Manager | Runs LSU day to day: members, plans, scheduling, refunds, reports, staff and the access system. Cannot change organization settings and cannot set up or change payment accounts |
| Front desk | Members and desk work. No scheduling changes, no refunds, no reports |
| Trainer | Sees members and the schedule, books their own sessions, manages ranks |
| Member or subscriber | Uses their own enrolled training and account |

Those six are the organization roles. **Coach is not one of them**: a coach is a separate authoring profile, and someone who authors methods usually holds Trainer as well. **Visitor is not a role either**; it describes someone browsing without a membership. Neither appears in the staff screen, so do not go looking for them there.

A user can have both a training identity and an organization membership. A subscription alone does not make its holder an administrator.

## Manage the experience

Open the **Experience** area in the staff workspace. This is the published LSU app itself: the brand name, logo, description, the sections of the app that are switched on, its navigation, its links and its published offers. Review changes before publishing. Publish only when the available methods and offers match the intended experience. The preset is a starting point; staff edits to the saved Experience can change which sections and offers are visible.

## Manage offers and methods

The published offer must connect eligible records:

| Record | What to check |
| --- | --- |
| Method | Published, in the LSU organization |
| Author | Active LSU owner, administrator, manager or trainer, with a coach profile |
| Product | Same author, active, monthly, and self-coaching rather than a personal-coaching product |
| Training plan | Attached to the product and eligible for that offer |
| Contributors | Coach profiles with active LSU membership |

An invalid offer can be omitted from the public response rather than shown with an error. Check the published page after saving. Eligibility is checked again on reads, so changing an author's membership or product status can remove an existing offer. Review currency, price and recurring terms before publication. Keep sample records separate from real purchases.

A standalone training plan is simpler: it is a one-off product in the store, owned by a coach in the organization, with no method behind it. The six demo plans are of this kind. The documented preview payment configuration is a Stripe sandbox, which is separate from complimentary demo enrollment; see [Plans and subscriptions](/training/plans#demo-plans-in-the-store).

## Review the next training week

The current catalog packages use seven-day blocks with `review: coach` and `wait_for: feedback`. Open the coach workspace's **Block reviews** queue. Review the runner's responses and submitted feedback alongside the draft sessions. Make any changes, save them, then approve the block or request another draft.

For example, a runner reports that Saturday is unavailable. Check the proposed next week against that feedback and adjust its sessions before approval. Saving draft edits does not put them on the runner's calendar; approval does. If a draft has changed while you were reviewing it, reload it before deciding.

Do not use the general AI assistant as a release control. LSU configures it for insights. See [Coach guide](/coaches#review-and-release-a-training-block).

## Manage access

Review members and their organization roles. Use the least access needed for the job. After changing a role, sign in with that account and check the actual screen and API permissions. A hidden navigation item is not a permission check by itself.

Three rules apply when you change a role. The owner's role cannot be changed by anyone. Only the owner or an administrator can make someone an administrator, or change someone who already is one, so a manager is refused here even though it can otherwise edit staff. And owner is not on the list you can choose from: the roles you can assign are administrator, manager, front desk, trainer and member.

## Review safely

Use the supplied demo accounts to check the complete path from published offer to enrolled workout. Seeded records are sample content and should stay separate from real purchases and approved coach methods.
