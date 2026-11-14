---
title: Web-component integration
description: Embed the LSU application into a host website while keeping identity, data and permissions inside the app.
---

# Web-component integration

The LSU web app is the application origin at [training.lsu.stacksjs.com](https://training.lsu.stacksjs.com). Its reusable `hq-coaching` web component embeds a published LSU experience into another website. The native apps compile the same application screens with native controls and device services.

This guide documents the application and its integration contract. It does not document or replace the race and marketing website. Publishing an app update does not install a component into lastsoulultra.com; that website's maintainer must add the integration to the intended pages.

## Embed the published experience

Load the module once on a host page, then place the component where the app should appear:

```html
<script type="module" src="https://training.lsu.stacksjs.com/assets/elements/hq-coaching.js"></script>
<hq-coaching
  brand="last-soul-ultra"
  api="https://training.lsu.stacksjs.com"
  label="Last Soul Ultra training and coaching">
  <a href="https://training.lsu.stacksjs.com/brands/last-soul-ultra">Open training</a>
</hq-coaching>
```

The component creates an iframe served by the application. The fallback link keeps the application reachable when the module cannot load. Keep a visible full-page option, especially where an embedded browser limits sign-in, storage, recording or payment returns.

## Choose a module

Use `section` to select a reusable app module. The published LSU Experience determines which modules are available; naming a section cannot enable it or grant access.

| Section | Purpose | Account boundary |
| --- | --- | --- |
| `plans` | Browse published coaching offers | Public browsing; checkout requires an app account |
| `calendar` | Read assigned training | Athlete's authorized training |
| `feedback` | Review and send training feedback | The signed-in subscriber's conversation |
| `progress` | Compare assigned and completed training | The signed-in account's permitted enrollments |
| `library` | Read the purchased method's published material | Existing access and publication rules |
| `health` | Read personal health and connected data | Personal account and explicit sharing choices |
| `messages` | Read and compose conversations | Account and conversation permissions |
| `account` | Review subscriptions and billing controls | The signed-in account's subscriptions |

For example, a storefront can embed just the offers:

```html
<hq-coaching brand="last-soul-ultra"
  api="https://training.lsu.stacksjs.com"
  section="plans" label="Last Soul Ultra coaching plans"
  style="--hq-coaching-height: 1200px"></hq-coaching>
```

A named section hides the portal header because the host supplies navigation. `embedded` does the same when showing the full experience without a section. The component defaults to a minimum iframe height of 1100 px; set `--hq-coaching-height` to fit the intended layout and verify it on a phone. The iframe may scroll when its content is taller.

## Keep credentials and authorization inside LSU

The host supplies the public brand, origin and optional section. It must not put passwords, bearer tokens or personal records in element attributes, URLs or analytics. Signing into the host website does not authenticate the app. Browser storage restrictions can also make an embedded session behave differently from a full-page session.

The application authenticates each private request and checks the account, subscription and organization permissions. The embedding website does not gain access to health data or conversations by loading the component. [Roles and plan access](/roles) describes the actual permissions.

The LSU Experience allows the intended production origins, including `https://lastsoulultra.com` and `https://www.lastsoulultra.com`. A host's content-security policy must permit the module from the app origin in `script-src` and the iframe in `frame-src`. For voice feedback, permit microphone delegation to the app origin in the host's Permissions Policy. The component itself includes `allow="microphone"`; HTTPS and the person's browser permission are still required.

## Checkout and return links

The optional `order` and `subscription` attributes carry numeric purchase-return references. They are references, not proof of payment or access. The app verifies ownership and current server/provider state before showing success. Do not copy another buyer's reference into a public embed.

Use the app's generated checkout links and return flow. [Payment testing](/payment-testing) explains cancellation, pending confirmation, failures and sandbox cards. A host redirect alone must never display a paid state.

## Verify a host integration

1. Open the actual host page on desktop and a phone. Confirm the module loads and its fallback link reaches the app.
2. Browse offers while signed out, then use a synthetic app account to test one private section. Confirm the visible account before continuing.
3. Change language without leaving the screen. Preserve typed text and completed verification state.
4. Review keyboard navigation, frame title, focus, height and any nested scrolling. Test the full-page option with restricted browser storage.
5. If voice feedback is included, test permission allowed and denied. If checkout is included, use a confirmed sandbox and verify cancellation and server-confirmed return behavior.

A browser capture verifies the embedded web presentation. Native permissions, recording and checkout returns require the installed app's own review.
