import { response, route } from '@stacksjs/router'
import { liveSnapshot, livePayload } from '../resources/data/live'
import { entryHeading, entryKicker, entryRows, raceEvents } from '../resources/data/race-events'
import { race } from '../resources/data/race'

/**
 * This file is the entry point for your application's API routes.
 * The routes defined here are automatically registered. Last but
 * not least, you may also create any other `routes/*.ts` files.
 *
 * Every route in this file is mounted under `/api`. The prefix comes from
 * the `'api'` key in `app/Routes.ts` and lines up with the path the dev
 * proxy forwards (`/api/*`), so `route.get('/hello', ...)` below answers
 * `GET /api/hello`. Paths at the document root belong in a route file
 * whose registry entry sets `prefix: ''`.
 *
 * Framework routes (auth, dashboard, commerce, CMS, etc.) are loaded
 * automatically from storage/framework/defaults/routes/dashboard.ts.
 * You do NOT need to define them here — only add your own custom routes.
 *
 * @see https://docs.stacksjs.com/routing
 */

// Your custom routes go here. This one answers `GET /api/hello`:
route.get('/hello', () => response.text('hello world'))

// `/coming-soon` is served as an STX view from
// `storage/framework/defaults/resources/views/coming-soon.stx`. The
// view auto-resolves through stx-serve, so no route registration is
// needed here. To activate the holding page across the whole app:
//
//   ./buddy coming-soon [--secret=my-magic-token]
//
// Launch the site with `./buddy launch`. Maintenance mode (503 page,
// distinct cookie + state file) is the separate `./buddy down` /
// `./buddy up` pair.


/**
 * The live scoreboard, mirrored onto this origin.
 *
 * The race's own board (see resources/data/live.ts) publishes no JSON, so the
 * standings used to sit behind an outbound link. This endpoint serves the same
 * state the page was server-rendered with, which is what lets the results page
 * refresh itself without a round trip to a third party - and it means the
 * browser never talks to the worker directly.
 *
 * Upstream is cached for a minute, so polling this costs nothing extra. A
 * failed upstream returns 503 with `ok: false` rather than a 200 full of
 * zeroes, so a client cannot mistake an outage for an empty field.
 */
route.get('/live', async () => {
  const payload = livePayload(await liveSnapshot(), race.loopMetres)

  return response.json(payload, {
    status: payload.ok ? 200 : 503,
    headers: {
      'cache-control': 'public, max-age=30, stale-while-revalidate=120',
    },
  })
})


/**
 * The season's events, mirrored onto this origin.
 *
 * Same reasoning as /live: the entry pages state each event's window, and
 * reading it from here rather than from the browser means a visitor's
 * request never leaves this origin, and the upstream is asked once per cache
 * window rather than once per reader.
 *
 * A failed upstream returns 503 with `ok: false` so a client cannot mistake
 * an outage for a season with no events in it.
 */
route.get('/events', async () => {
  const payload = await raceEvents()
  // Rows and heading come shaped, so the page does not re-decide what
  // "Coming soon" means in a second copy of the rules.
  const body = { ...payload, rows: entryRows(payload), heading: entryHeading(payload), kicker: entryKicker(payload) }

  return response.json(body, {
    status: payload.ok ? 200 : 503,
    headers: {
      'cache-control': 'public, max-age=120, stale-while-revalidate=600',
    },
  })
})


/**
 * The confirmation link from the double opt-in email.
 *
 * `POST /api/email/subscribe` and `GET /api/email/unsubscribe` already exist,
 * registered by the framework's dashboard routes; this is the missing middle
 * step. Named `email.confirm` because app/Mail/SubscriptionOptIn.ts builds the
 * link with `url('email.confirm', { token })` rather than hard-coding a path.
 *
 * skipCsrf because it is a GET arriving from a mail client with no session.
 */
route.get('/email/confirm', 'Actions/ConfirmSubscriptionAction').name('email.confirm').skipCsrf()
