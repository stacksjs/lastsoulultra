import type { CoachingBrand } from './coaching-brand'
import coaching from '../../config/coaching'
import type { CoachingPageMeta } from '../data/coaching'
import { coachingModule, coachingPage } from '../data/coaching'
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
/**
 * How long past `HIT_TTL_MS` a cached brand may still be served while a fresh
 * one is fetched behind the response. Past this it is too old to stand in for
 * what HQ publishes now, and a caller waits instead.
 */
const STALE_GRACE_MS = 10 * 60_000
/** A render blocked on another service is a broken page, not a slow one. */
const TIMEOUT_MS = 2500

interface Entry {
  brand: CoachingBrand | null
  until: number
}

const cache = new Map<string, Entry>()
/** One in-flight request per brand, so a cold cache does not stampede. */
const inFlight = new Map<string, Promise<CoachingBrand | null>>()

/**
 * The configured HQ origin, checked.
 *
 * An HQ reached over plain HTTP would carry a runner's training session in
 * clear, and a misconfigured HQ_ORIGIN is a deployment mistake that should
 * stop the build rather than quietly ship. Loopback is exempt so the local
 * preview stack works.
 */
export function coachingOrigin(value = coaching.origin): string {
  const url = new URL(value)
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
    throw new Error('HQ_ORIGIN must use HTTPS')
  return url.origin
}

/** The configured brand slug, checked against HQ's own slug shape. */
export function coachingBrand(value = coaching.brand): string {
  if (!/^[a-z0-9][a-z0-9-]{0,139}$/.test(value))
    throw new Error('HQ_BRAND_SLUG must be an organization slug')
  return value
}

/**
 * A section name HQ will accept, or ''. The registry is the list: a section
 * this site does not serve has no business being passed through to HQ, and
 * keeping a second copy of the eight names here is how the two drift.
 */
export function coachingSection(value: unknown): string {
  return typeof value === 'string' && coachingModule(value) ? value : ''
}

/** The endpoint, built from config rather than from anything a visitor sends. */
export function brandEndpoint(origin = coaching.origin, slug = coaching.brand): string {
  return new URL(`/api/brands/${encodeURIComponent(slug)}`, origin).toString()
}

/** Where the portal lives, for a link that works when the frame does not. */
export function portalUrl(section: unknown = '', origin = coaching.origin, slug = coaching.brand): string {
  const url = new URL(`/brands/${encodeURIComponent(coachingBrand(slug))}`, coachingOrigin(origin))
  const named = coachingSection(section)
  if (named) url.searchParams.set('section', named)
  return url.toString()
}

/** The host the panel is loaded from, for a page that says so out loud. */
export function portalHost(origin = coaching.origin): string {
  return new URL(coachingOrigin(origin)).host
}

/** The custom element HQ generates for embedding its portal. */
export function portalElementUrl(origin = coaching.origin): string {
  return `${coachingOrigin(origin)}/assets/elements/hq-coaching.js`
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
  const now = Date.now()
  if (cached && cached.until > now) return cached.brand

  // Stale but still usable: answer with it now and refresh behind the
  // response, the same bargain the live board makes. HQ being slow should
  // cost this site nothing it can avoid, and a coaching page that renders
  // last minute's tiers beats one that renders in two and a half seconds.
  //
  // Only a hit is served this way. A cached miss means the brand was absent
  // or rejected, and there is nothing to show from it, so that case waits.
  if (cached?.brand && cached.until + STALE_GRACE_MS > now) {
    if (!inFlight.has(key))
      void refreshBrand(key, slug, origin)
    return cached.brand
  }

  const existing = inFlight.get(key)
  if (existing) return existing

  return refreshBrand(key, slug, origin)
}

/**
 * Fetch the brand and replace its cache entry.
 *
 * One definition shared by the blocking path and the background one, holding
 * the single-flight promise so concurrent callers never open two requests.
 */
function refreshBrand(key: string, slug: string, origin: string): Promise<CoachingBrand | null> {
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

/**
 * Head metadata for a module route, with a preconnect when the page is going
 * to load HQ's element.
 *
 * The browser opens DNS, TCP and TLS to hq.training before the parser reaches
 * the module script in the body, which is the one request this page's content
 * waits on. It is only promised when the brand publishes this module: a
 * preconnect to an origin the page never calls is a socket held open for
 * nothing, and with no brand published these pages frame nothing at all.
 */
export async function coachingPageMeta(slug: string): Promise<CoachingPageMeta> {
  const page = coachingPage(slug)
  const brand = await loadBrand()
  if (!brand?.modules.includes(slug))
    return page
  return { ...page, preconnect: [coachingOrigin()] }
}
