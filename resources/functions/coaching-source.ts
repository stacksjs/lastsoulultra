import type { CoachingBrand } from './coaching-brand'
import coaching from '../../config/coaching'
import { parseBrand } from './coaching-brand'

/**
 * Fetching the published brand, once, for a whole render.
 *
 * Nine pages on this site want the same payload, and a page render must never
 * wait on another service to finish: a slow HQ would otherwise hold the whole
 * coaching section open, and a down HQ would hold it open until the proxy gave
 * up. So the call is bounded, it never throws, and the answer is remembered
 * for a short while.
 *
 * A miss is remembered too, for a shorter time. An outage that is not cached
 * turns one visitor per render into one upstream request per render, which is
 * precisely the load an outage cannot absorb.
 */

/** Long enough that a visitor moving between modules makes one request. */
const HIT_TTL_MS = 60_000
/** Short enough that a brand going live shows up within a minute. */
const MISS_TTL_MS = 10_000
/** A render blocked on another service is a broken page, not a slow one. */
const TIMEOUT_MS = 2500

interface Entry {
  brand: CoachingBrand | null
  until: number
}

const cache = new Map<string, Entry>()
/** One in-flight request per brand, so a cold cache does not stampede. */
const inFlight = new Map<string, Promise<CoachingBrand | null>>()

/** The endpoint, built from config rather than from anything a visitor sends. */
export function brandEndpoint(origin = coaching.origin, slug = coaching.brand): string {
  return new URL(`/api/brands/${encodeURIComponent(slug)}`, origin).toString()
}

async function request(slug: string, origin: string): Promise<CoachingBrand | null> {
  try {
    const response = await fetch(brandEndpoint(origin, slug), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    // 404 is the correct answer for a brand that is not published yet.
    if (!response.ok) return null
    return parseBrand(await response.json(), slug)
  }
  catch {
    // A timeout, a DNS failure and malformed JSON are all "nothing to show".
    return null
  }
}

/**
 * The published brand, or null. Never throws, never waits more than a moment,
 * and never makes the same call twice in a row.
 */
export async function loadBrand(slug = coaching.brand, origin = coaching.origin): Promise<CoachingBrand | null> {
  const key = `${origin}|${slug}`
  const cached = cache.get(key)
  if (cached && cached.until > Date.now()) return cached.brand

  const existing = inFlight.get(key)
  if (existing) return existing

  const pending = request(slug, origin)
    .then((brand) => {
      cache.set(key, { brand, until: Date.now() + (brand ? HIT_TTL_MS : MISS_TTL_MS) })
      return brand
    })
    .finally(() => inFlight.delete(key))

  inFlight.set(key, pending)
  return pending
}

/** For tests, and for a dev server that should not hold a stale brand. */
export function forgetBrand(): void {
  cache.clear()
  inFlight.clear()
}
