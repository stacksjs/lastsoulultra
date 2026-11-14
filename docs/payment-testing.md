---
title: Payment testing and error scenarios
description: Test card payments, authentication and checkout recovery in a dedicated Stripe sandbox account.
---

# Payment testing and error scenarios

Use a dedicated throwaway buyer and a confirmed Stripe sandbox checkout. The shared review accounts already have complimentary coaching access; they are not payment fixtures. The separate race-entry service has its own payment configuration and records. A sandbox purchase in training does not test race-entry payment.

## Confirm the environment first

Ask the operator to confirm the checkout's Stripe account, test credentials and webhook destination. A private preview URL or a page behind a password does not prove sandbox mode. Check the checkout's test-mode indication and the corresponding transaction in the sandbox Dashboard. If either is unclear, stop before submitting a card.

Use a future expiry, for example `12/34`, and a three-digit CVC, or four digits for Amex. For code-based processor tests, use Stripe's named test PaymentMethods rather than sending card numbers through an application API. [Stripe testing instructions](https://docs.stripe.com/testing#how-to-use-test-cards).

## Successful card entry

Start with `4242424242424242`, the familiar 4242 Visa. These successful fixtures cover the card-input shapes and brands, subject to the merchant's enabled methods. [Official card-brand fixtures](https://docs.stripe.com/testing#cards).

| Card | Scenario |
| --- | --- |
| `4242424242424242` | Visa |
| `4000056655665556` | Visa debit |
| `5555555555554444` | Mastercard |
| `2223003122003222` | Mastercard 2-series |
| `5200828282828210` | Mastercard debit |
| `5105105105105100` | Mastercard prepaid |
| `378282246310005` | Amex |
| `371449635398431` | Amex alternative |
| `6011111111111117` | Discover |
| `6011000990139424` | Discover alternative |
| `6011981111111113` | Discover debit |
| `3056930009020004` | Diners Club |
| `36227206271667` | Diners 14-digit |
| `6555900000604105` | BCcard/DinaCard |
| `3566002020360505` | JCB |
| `6200000000000005` | UnionPay |
| `6200000000000047` | UnionPay debit |
| `6205500000000000004` | UnionPay 19-digit |

For country-specific, co-branded and additional processor fixtures, use [Stripe's full current catalog](https://docs.stripe.com/testing#international-cards). A brand fixture does not mean LSU has enabled that payment method.

## Declines and input errors

Use each row as a separate sandbox attempt. Stripe Checkout should keep the buyer on an actionable payment form; LSU must not unlock access merely because checkout was opened. [Official decline fixtures](https://docs.stripe.com/testing#declined-payments).

| Card | Result/code |
| --- | --- |
| `4000000000000002` | `generic_decline` |
| `4000000000009995` | `insufficient_funds` |
| `4000000000009987` | `lost_card` |
| `4000000000009979` | `stolen_card` |
| `4000000000000069` | `expired_card` |
| `4000000000000127` | `incorrect_cvc` |
| `4000000000000119` | `processing_error` |
| `4242424242424241` | `incorrect_number` |
| `4000000000006975` | `card_velocity_exceeded` |
| `4000000000000341` | Declines after attachment |

Also try incomplete number, expiry and CVC fields. The hosted form should explain what needs correcting and remain usable. For an issuer/CVC decline, actually enter a CVC. A generic decline is an appropriate customer message for lost/stolen cards; the UI should not reveal a more sensitive issuer reason. [Stripe decline guidance](https://docs.stripe.com/declines/codes).

## Authentication and saved cards

Test through checkout, including completing, failing and closing the challenge. Authentication and payment are separate outcomes: a successful challenge does not establish a paid purchase. [Stripe authentication flow](https://docs.stripe.com/payments/3d-secure/authentication-flow).

| Card | Scenario |
| --- | --- |
| `4000000000003220` | Required authentication |
| `4000008400000027` | Required authentication, US |
| `4000008400001629` | Authenticates, then declines |
| `4000008400001280` | Authentication processing error |
| `4000000000003055` | Optional authentication |
| `4000000000003097` | Optional authentication error |
| `4000002500003155` | Authenticate unless set up for off-session use |
| `4000002760003184` | Always authenticate |
| `4000003800000446` | Already set up off-session |
| `4000008260003178` | Authentication then insufficient funds |

These are defined processor scenarios, not a promise that every merchant requests the same challenge. Use [Stripe's current authentication fixtures](https://docs.stripe.com/testing#regulatory-cards) and record the account's settings alongside the result.

## Risk, address checks and post-payment changes

These scenarios can depend on merchant rules. A failed check is not necessarily a declined payment. Do not assert the same outcome for every Radar configuration. [Stripe risk and post-payment fixtures](https://docs.stripe.com/testing#fraud-prevention).

| Card | Scenario |
| --- | --- |
| `4100000000000019` | Radar blocked |
| `4000000000004954` | Highest risk |
| `4000000000009235` | Elevated risk |
| `4000000000000101` | CVC check fails |
| `4000000000000036` | Postal check fails |
| `4000000000000028` | Address-line check fails |
| `4000000000000010` | Both address checks fail |
| `4000000000000044` | Address unavailable |
| `4000000000007726` | Asynchronous refund success |
| `4000000000005126` | Asynchronous refund failure |

Only exercise refunds against disposable sandbox transactions created for the test. Review the provider's final state and the application record afterward. For dispute simulation and extended card cases, use [the complete dispute catalog](https://docs.stripe.com/testing#disputes).

## What a correct LSU flow should show

| Stage | Expected user-visible behavior | State to verify |
| --- | --- | --- |
| Checkout cannot start | A visible, useful error and an enabled retry action. | No successful order or new paid access is implied. |
| Card is declined | Stripe's hosted form displays the payment error and lets the buyer correct details or choose another card. | The purchase remains unpaid. |
| Authentication is closed or fails | A clear path back to retry or abandon checkout. | The app does not treat the challenge as proof of payment. |
| Buyer cancels | A cancellation message and a usable route back to the product or current purchase status. | Cancellation does not overwrite a server-confirmed payment. |
| Buyer returns successfully | A visible confirmation-in-progress state while the server checks the order/subscription. | Only server-verified payment grants the corresponding access. |
| Confirmation request fails | A visible connection/service error, with a way to retry the status check. | Do not report the purchase as empty, paid or permanently failed from an unavailable response. |
| Webhook or confirmation is delayed | Explain that payment is still processing and show the current purchase when confirmed. | Repeated returns and duplicate webhooks must not duplicate delivery. |
| Saved-card renewal fails | Billing exposes the actionable payment state; the customer can follow the offered payment-method update. | Access follows the actual subscription state and configured terms. |
| Free/fully discounted purchase | The offered content becomes available after the server completes fulfillment. | No card collection is required just to display a successful free order. |

For a card decline, the checkout error belongs in Stripe's form. LSU should not invent an issuer reason or replace it with an unrelated account error. Application request errors, on the other hand, must be visible in LSU's own UI. The product page, purchase confirmation, billing management and native return path each need their own checks.

## Repeatable review

1. Create a fresh synthetic buyer for one scenario. Record the offer, seller, price, currency and whether it is a one-time purchase or subscription.
2. Confirm the sandbox account and webhook configuration. Open the offer through the same web or app path a buyer uses.
3. Run the chosen card scenario. Capture the hosted error or authentication outcome and LSU's return state. Keep API secrets, full customer identifiers and browser authorization out of screenshots and logs.
4. Inspect the authenticated purchase/subscription record and content access. Reload, return again and confirm that fulfillment is not repeated.
5. Test web and the installed iPhone app separately. A phone-width website image cannot prove a native checkout sheet or app-return scheme works.

For trials, renewals, overdue invoices, cancellation and recovery over time, use a dedicated Billing test scenario and [Stripe test clocks](https://docs.stripe.com/billing/testing). Those transitions need more than the initial 4242 checkout.

The card catalog is a testing reference, not a report that every processor case has been executed against this deployment. The automated capture report and test results should state which scenarios were actually run, which failed and which require a separate sandbox fixture.


## Recorded verification

On 14 November 2026, four named PaymentMethod probes ran with LSU's test-only Stripe credential: Visa success returned `succeeded`; generic decline and insufficient funds returned `requires_payment_method` with their respective decline codes; required authentication returned `requires_action`. Each response explicitly identified a sandbox intent. These processor probes did not purchase a coaching package or test every card in the catalog.

A separate phone-width browser check signed in as a dedicated synthetic buyer and intercepted the checkout-start request with HTTP 503. The product screen showed the translated payment-configuration error as an alert and restored its purchase button. The interceptor handled the request locally; no checkout or payment was submitted by this UI check. The captured interface is German because that buyer's selected language is German.

<figure class="guide-figure">
  <img src="/docs/screens/checkout-start-error-mobile.png" alt="Synthetic checkout-start failure showing the visible German payment error and available purchase button" width="390" height="844" loading="lazy" style="max-width:390px;margin-inline:auto">
  <figcaption>A simulated checkout-start failure in the actual phone-width product screen. The buyer can correct the configuration issue before retrying.</figcaption>
</figure>

Regression tests also cover confirmation network failures, HTTP errors, malformed responses, pending payment, cancellation, verified access and stale screens. Race-entry tests cover the separate race-payment confirmation and recovery. A delayed confirmation must remain distinct from a failed request.

The live sandbox checkout preflight for the sample Strength for Ultrarunners plan returned HTTP 409 because its merchant has not selected a tax classification. The application correctly refused to create a checkout. The merchant must choose the classification in product administration before that plan can be used for hosted card testing. Do not bypass this validation or select a tax classification merely to make a test pass.

A complete hosted-checkout review still needs entering the relevant cards in the sandbox form, completing and cancelling authentication challenges, following each return link and checking fulfillment. Record those outcomes separately from these processor and simulated UI checks.
