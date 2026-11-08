import { siteOrigin } from './site-origin'
export { siteOrigin } from './site-origin'
import { indexableModulePaths } from './coaching'
import { race } from './race'

/**
 * Site-level constants: the origin, and the list of what the site publishes.
 *
 * Anything a page prints twice lives here so the two copies cannot drift. The
 * navigation used to live here as well, in a second copy that no template read
 * and that still pointed at `/legal/*` routes this site does not serve;
 * SiteNav and SiteFooter are the only copy now. Share cards moved to
 * `share.ts`, which maps each page to one of the cards on disk.
 */

/** Absolute URL for a site-relative path. */
export function absolute(path: string): string {
  return `${siteOrigin}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Every indexable URL on the site, in one place.
 *
 * The sitemap and robots.txt are generated from this (scripts/seo.ts) rather
 * than hand-maintained, and tests/seo.test.ts fails if a view exists on disk
 * that is not listed here - a page nobody can find is the kind of thing that
 * stays broken for months because nothing errors.
 *
 * /404 is deliberately absent: it is noindex.
 */
export const indexablePaths: string[] = [
  '/', '/format', '/world-series', '/soul-races', '/sponsorship', '/contact',
  '/lottery', '/results', '/results/last-soul-ultra-2026', '/results/last-soul-ultra-2025',
  '/imprint', '/privacy', '/terms', '/coaching', '/app', '/app/coaches', '/press',
  // /faq is served, and stays served: it is a URL the previous site published
  // and other people's links still point at. It is not listed, because it
  // renders the contact page and canonicalises to /contact - advertising a
  // URL that tells a crawler it is not the canonical one asks for the page to
  // be ignored and spends the site's crawl budget doing it.
  // The storefront only. The other seven training modules show a sign-in
  // prompt to anyone without an account, which is not a search result.
  ...indexableModulePaths(),
]

/** "14 august 2026", lowercase like the rest of the site's voice. */
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`
}

/**
 * Whole days from now until the race, or null once it has started.
 * Derived at render time so the page cannot advertise a stale countdown.
 */
export function daysUntilRace(): number | null {
  const start = new Date(`${race.startsOn}T00:00:00Z`).getTime()
  const days = Math.ceil((start - Date.now()) / 86400000)
  return days > 0 ? days : null
}

/**
 * The Google Analytics 4 property this site reports to. It only ever loads
 * after a reader accepts the consent banner (resources/functions/analytics.ts).
 * Set GA_MEASUREMENT_ID to an empty string to turn analytics and the banner off.
 */
export const analyticsId: string = process.env.GA_MEASUREMENT_ID ?? 'G-0MMFR4S2T0'
