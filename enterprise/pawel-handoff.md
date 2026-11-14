# Pawel customer test handoff

The customer entry point is <https://lsu.stacksjs.com/coaching/plans>.
The preview gate and the training account are separate logins. The shared
Passwords group **LSU** contains the website preview, Pawel's actual coach
account, the demo visitor and two empty customer accounts labelled RUN and SOUL.
Chris invites Pawel to that group. Do not put passwords in this document.

The training application and its API run at
<https://training.lsu.stacksjs.com>. LSU sign-in is independent of HQ sign-in
and of the production race-entry account.

## Catalog and delivery

The catalog contains Pawel's 30 twelve-week plans: five programs, three levels,
RUN and SOUL. Each program, level and tier is its own product, so the purchased
prescription and sports are explicit before payment. Four subscriptions are
published for the first test. Older demo offers are drafts in the general
store as well as absent from the branded storefront; their review calendars
remain usable:

| Program | Level | Tier | Monthly price |
| --- | --- | --- | --- |
| Backyard | Fortgeschritten | RUN | EUR 19.99 |
| Backyard | Fortgeschritten | SOUL | EUR 39.99 |
| 10 km | Einsteiger | RUN | EUR 19.99 |
| 10 km | Einsteiger | SOUL | EUR 39.99 |

`POST /api/coach/plans` accepts the supplied HQ import format. The imported
plans have been compared against the ZIP and the live API. The 239 distinct
workouts are present; rest days correctly create no calendar workout.

Every product sets `training_blocks` to `length_days: 7`, `review: coach`,
`wait_for: feedback`, `source: plan`. The explicit authored-plan mode keeps
Pawel's steps, exercises, sets and video links. It does not regenerate his
prescriptions through AI. The coach can edit the draft and must approve it
before its workouts appear for the athlete, including the first week.

Feedback for the following week opens two days before the current block ends.
Its date is shown by the app. Early feedback remains a coaching conversation
and cannot unlock the next block. The next draft must also be approved.
The chat assistant can explain the athlete's information; LSU's installation
limits it to insights, so it cannot change the calendar itself.

## Customer test

1. Open the preview in a clean browser and use the website entry from Passwords.
2. Use an empty RUN or SOUL customer account, or register a real address of your own.
   The supplied synthetic `.test` addresses cannot receive recovery mail.
3. Pick one of the four products and check its price and monthly billing.
4. Confirm that Stripe shows test mode. Use card `4242 4242 4242 4242`, a future
   expiry and any three-digit CVC. Use fictional billing information.
5. Return to LSU after payment. The first block initially waits for coach review.
6. In a separate browser, sign in as Pawel and open
   <https://training.lsu.stacksjs.com/coaches/block-reviews>.
   On first entry, read and accept the terms yourself.
   Check the week and its prescriptions, then approve it.
7. Return to the athlete account and refresh the training. Open a workout,
   inspect the original prescription, open a demonstration, log a set where
   relevant and save completion with duration and effort. Reload to verify it.
8. Record or upload voice feedback. Transcribe it, review and edit the text,
   then send it. Text feedback works through the same conversation.
9. On or after the shown feedback date, send the week's feedback. Review and
   approve the next draft as coach, then verify the athlete's following week.
10. In the athlete account, cancel renewal and inspect the paid-through date.
    Use **Keep renewing** to reverse cancellation before access ends.

The older complimentary review accounts already have sample access. Use the
empty customer accounts for the purchase path. Do not buy subscriptions on
Pawel's coach account.

## Website embed

The preview uses the real `<hq-coaching>` element. The preview and both
production origins, `https://lastsoulultra.com` and
`https://www.lastsoulultra.com`, are allowed by LSU's brand configuration.

```html
<script type="module" src="https://training.lsu.stacksjs.com/assets/elements/hq-coaching.js"></script>
<hq-coaching brand="last-soul-ultra" api="https://training.lsu.stacksjs.com"></hq-coaching>
```

The element delegates microphone permission to its training iframe. Production
`lastsoulultra.com` is maintained outside this repository. Its production page
has not been changed by deploying this preview. Its maintainer must publish
the element there before the same entry path is available on that domain.

## Source video requiring review

Public provider metadata succeeds for 144 of the 145 distinct supplied video
URLs. YouTube returns 404 for `https://www.youtube.com/shorts/rfMyMmD-Jys`,
the **Oblique sit** demonstration in both **Hip/Piriformis stretch** workout
variants. The original prescription and link remain intact. Pawel needs to
supply the intended working replacement; an unrelated video is not substituted.

## Verification on 14 November 2026

- All 30 live plans compared with the normalized ZIP imports, including 239
  distinct workouts and 5,303 non-rest sessions.
- All four subscriptions purchased through real Stripe sandbox checkouts,
  confirmed by the payment integration and delivered through coach approval.
- All 52 delivered first-week workouts checked: authored run structures and
  SOUL video references retained across all four purchases.
- Browser workout completion, set log, duration and effort persisted after reload.
- Real browser MediaRecorder upload, local speech transcription, transcript edit,
  feedback submission and coaching response verified with synthetic audio.
- Cancellation and restored renewal verified through the live account controls.
- No second week released by early feedback. Future-date lifecycle tests use
  isolated SQLite and PostgreSQL databases, not the live clock or live row edits.
- Clean checkout: 337 tests, lint and type check passed. Deployed verification:
  67 checks passed, including desktop/mobile styling, roles and the four offers.

The synthetic purchase tests have renewal cancelled or their Stripe sandbox
subscription terminated through the provider API. The two customer accounts reserved for Pawel have no
purchases or workouts, and their language preference is German.

Native acceptance and TestFlight delivery have their own workflow receipts.
A successful web check does not establish native delivery.
