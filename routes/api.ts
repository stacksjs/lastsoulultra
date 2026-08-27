import { response, route } from '@stacksjs/router'
import { liveSnapshot, livePayload } from '../resources/data/live'
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
