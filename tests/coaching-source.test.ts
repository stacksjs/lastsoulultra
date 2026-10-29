import type { Server } from 'bun'
import { afterEach, beforeEach, describe, expect, it, setSystemTime } from 'bun:test'
import { brandEndpoint, forgetBrand, loadBrand } from '../resources/functions/coaching-source'

/**
 * These stand a throwaway server in for HQ. The point is not the happy path -
 * coaching-surface.test.ts pins that against a recorded payload - it is that
 * every unhappy path ends in a null brand quickly and quietly, because a
 * coaching page that waits on another service is a page that does not render.
 */

let server: Server
let hits = 0

function serve(handler: (request: Request) => Response | Promise<Response>): string {
  hits = 0
  server = Bun.serve({
    port: 0,
    fetch(request) {
      hits += 1
      return handler(request)
    },
  })
  return `http://127.0.0.1:${server.port}`
}

const published = {
  slug: 'last-soul-ultra',
  settings: { name: 'Last Soul Ultra', headline: 'Train for the next start.', modules: ['plans'] },
  offers: [],
}

beforeEach(() => forgetBrand())
afterEach(async () => { await server?.stop(true) })

describe('loading the published brand', () => {
  it('asks the configured origin for the configured slug', () => {
    expect(brandEndpoint('https://hq.training', 'last-soul-ultra'))
      .toBe('https://hq.training/api/brands/last-soul-ultra')
  })

  it('escapes a slug rather than letting it reshape the path', () => {
    expect(brandEndpoint('https://hq.training', '../org/experience'))
      .toBe('https://hq.training/api/brands/..%2Forg%2Fexperience')
  })

  it('reads a published brand', async () => {
    const origin = serve(() => Response.json(published))
    expect((await loadBrand('last-soul-ultra', origin))?.name).toBe('Last Soul Ultra')
  })

  it('answers null for a brand that is not published yet', async () => {
    const origin = serve(() => new Response('not found', { status: 404 }))
    expect(await loadBrand('last-soul-ultra', origin)).toBeNull()
  })

  it('answers null when HQ errors, rather than failing the page', async () => {
    const origin = serve(() => new Response('boom', { status: 500 }))
    expect(await loadBrand('last-soul-ultra', origin)).toBeNull()
  })

  it('answers null for a response that is not JSON', async () => {
    const origin = serve(() => new Response('<html>maintenance</html>', { headers: { 'content-type': 'text/html' } }))
    expect(await loadBrand('last-soul-ultra', origin)).toBeNull()
  })

  it('answers null when nothing is listening at all', async () => {
    // Port 9 (discard) refuses fast and needs no server of its own.
    server = Bun.serve({ port: 0, fetch: () => new Response('') })
    expect(await loadBrand('last-soul-ultra', 'http://127.0.0.1:9')).toBeNull()
  })

  it('gives up on an HQ that never answers', async () => {
    const origin = serve(async () => { await Bun.sleep(30_000); return new Response('late') })
    const started = performance.now()

    expect(await loadBrand('last-soul-ultra', origin)).toBeNull()
    expect(performance.now() - started).toBeLessThan(5000)
  }, 10_000)

  it('makes one request for a whole render, not one per page', async () => {
    const origin = serve(() => Response.json(published))

    await loadBrand('last-soul-ultra', origin)
    await loadBrand('last-soul-ultra', origin)
    await loadBrand('last-soul-ultra', origin)

    expect(hits).toBe(1)
  })

  it('does not stampede a cold cache', async () => {
    const origin = serve(async () => { await Bun.sleep(50); return Response.json(published) })

    const all = await Promise.all([1, 2, 3, 4, 5].map(() => loadBrand('last-soul-ultra', origin)))

    expect(hits).toBe(1)
    expect(all.every(brand => brand?.name === 'Last Soul Ultra')).toBe(true)
  })

  it('caches an outage too, so a down HQ is not asked once per visitor', async () => {
    const origin = serve(() => new Response('boom', { status: 503 }))

    await loadBrand('last-soul-ultra', origin)
    await loadBrand('last-soul-ultra', origin)

    expect(hits).toBe(1)
  })
})

/**
 * Who pays for HQ being slow.
 *
 * `loadBrand` runs from the coaching nav, the offers list and the page meta,
 * so it sits on the render path of every coaching page. It used to await the
 * refresh the moment HIT_TTL_MS lapsed, which handed one visitor a minute a
 * wait of up to TIMEOUT_MS before any HTML. Last minute's tiers are worth far
 * more than this minute's tiers nobody has been shown yet.
 */
describe('refreshing the brand without making anyone wait', () => {
  afterEach(() => setSystemTime())

  it('answers from a stale brand and refreshes behind the response', async () => {
    let slow = false
    const origin = serve(async () => {
      if (slow) await new Promise(resolve => setTimeout(resolve, 5_000))
      return Response.json(published)
    })

    const first = await loadBrand('last-soul-ultra', origin)
    expect(first?.name).toBe('Last Soul Ultra')
    expect(hits).toBe(1)

    // Past the hit TTL, with an origin now slow enough that awaiting it would
    // be unmistakable.
    setSystemTime(new Date(Date.now() + 61_000))
    slow = true

    const began = performance.now()
    const second = await loadBrand('last-soul-ultra', origin)
    const waited = performance.now() - began

    expect(second?.name).toBe('Last Soul Ultra')
    expect(waited).toBeLessThan(1_000)
  })

  it('waits when the only cached answer is a miss', async () => {
    const origin = serve(() => new Response('nope', { status: 404 }))

    expect(await loadBrand('last-soul-ultra', origin)).toBeNull()
    setSystemTime(new Date(Date.now() + 61_000))

    // Nothing to stand in for the brand, so this one has to ask again.
    expect(await loadBrand('last-soul-ultra', origin)).toBeNull()
    expect(hits).toBe(2)
  })

  it('opens one request even when several callers arrive together', async () => {
    const origin = serve(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
      return Response.json(published)
    })

    await Promise.all([
      loadBrand('last-soul-ultra', origin),
      loadBrand('last-soul-ultra', origin),
      loadBrand('last-soul-ultra', origin),
    ])
    expect(hits).toBe(1)
  })
})

