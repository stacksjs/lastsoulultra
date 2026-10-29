---
title: Colors and interface
description: LSU color swatches, wordmark, readable text and training interface specimens.
---

# Colors and interface

The race site uses black surfaces, white reading text and a red accent. The clock has a brighter red, while the favicon uses its own orange mark. These colors have different jobs and should remain distinct.

## Brand colors

<div class="lsu-guide"><div class="sg-colors">
<figure class="sg-color"><div class="sg-swatch sg-black"></div><figcaption><strong>Canvas</strong><code>#000000</code>Main black background.</figcaption></figure>
<figure class="sg-color"><div class="sg-swatch sg-band"></div><figcaption><strong>Section surface</strong><code>#050505</code>Subtle separation between page sections.</figcaption></figure>
<figure class="sg-color"><div class="sg-swatch sg-card"></div><figcaption><strong>Card surface</strong><code>#0d0d0f</code>Training and account surfaces.</figcaption></figure>
<figure class="sg-color"><div class="sg-swatch sg-card-alt"></div><figcaption><strong>Alternate surface</strong><code>#111111</code>A second dark surface.</figcaption></figure>
<figure class="sg-color"><div class="sg-swatch sg-white"></div><figcaption><strong>Reading text</strong><code>#ffffff</code>Primary text on dark surfaces.</figcaption></figure>
<figure class="sg-color"><div class="sg-swatch sg-red"></div><figcaption><strong>Brand accent</strong><code>#dd0f15</code>Emphasis, rules and primary actions.</figcaption></figure>
<figure class="sg-color"><div class="sg-swatch sg-seg-red"></div><figcaption><strong>Clock digits</strong><code>#ff2a1a</code>The segmented race display.</figcaption></figure>
<figure class="sg-color"><div class="sg-swatch sg-orange"></div><figcaption><strong>Favicon mark</strong><code>#f04800</code>The small square in the favicon.</figcaption></figure>
</div></div>

Muted site text uses white at 65%, 55% or 40% opacity. Dividers use white at 14%, 10% or 8%. Their final appearance depends on the surface underneath; check the composed result, especially at small sizes.

## Wordmark

Keep the supplied wordmark's proportions and leave clear space around it. The white asset is shown on black here so its full shape remains visible.

<div class="lsu-guide"><figure class="sg-brand"><img src="/docs/style-guide/lsu-logo.svg" width="438" height="88" alt="Last Soul Ultra wordmark on black"><figcaption>Supplied white wordmark on the main canvas.</figcaption></figure></div>

## Readable actions and fields

Use white for ordinary reading text on black. The brand red against black has about 4.15:1 contrast, so it needs care at small text sizes. White labels on the red action background provide a clearer small-text pairing. Reserve accent-only treatment for appropriate large type, borders and graphics.

<div class="lsu-guide"><div class="sg-specimen"><p class="sg-label">ACTION AND FIELD SPECIMEN</p><p class="sg-body">Read the session instructions before you start.</p><div class="sg-links"><a class="sg-action" href="https://lsu.stacksjs.com/coaching/calendar">Open workouts</a><a class="sg-action sg-action-secondary" href="/training/workouts">Read the workout guide</a></div><label class="sg-field" for="sg-athlete">Athlete name, read-only example</label><input class="sg-input" id="sg-athlete" value="Alex Morgan, LSU Demo" readonly></div></div>

The links open real pages. The field is a read-only sample and does not update an account. Focus it with the keyboard to inspect the focus treatment.

## Training information hierarchy

Use a clear title, then the details needed to act. Keep the session's status and instructions in text so their meaning does not depend on color.

<div class="lsu-guide"><div class="sg-specimen"><article class="sg-session"><p class="sg-session-meta">FICTIONAL DEMO SESSION · COMPLETED</p><p class="sg-session-title">Recovery run</p><p class="sg-body">Keep the effort comfortable. Review the session instructions before training.</p><p class="sg-session-meta">PLANNED DURATION · 00:30:00</p></article></div></div>

## Space and responsive layout

The site's horizontal gutters grow from 18 to 40 pixels, and its main content is capped at 1,360 pixels. Section spacing grows from 72 to 130 pixels. The docs use a narrower reading column; these values describe the app rather than the documentation layout.

Review the [typefaces](/style-guide/typography) and [illustration palettes](/style-guide/illustrations) at narrow widths as well as on desktop. Text should wrap, controls should remain readable and the page should not require horizontal scrolling.
