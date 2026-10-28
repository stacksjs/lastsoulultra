import { env } from '@stacksjs/env'
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

/**
 * The canonical origin, read from APP_URL rather than hard-coded, so a
 * canonical or an og:image never names a host this build does not serve.
 * APP_URL is a bare host in development and a full URL in production.
 */
export const siteOrigin = normalizeOrigin(String(env.APP_URL || 'https://lastsoulultra.com'))

function normalizeOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (/^https?:\/\//.test(trimmed)) return trimmed
  const host = trimmed.split(':')[0] ?? ''
  const local = /(^|\.)localhost$|^127\.|^0\.0\.0\.0$/.test(host)
  return `${local ? 'http' : 'https'}://${trimmed}`
}

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
  '/imprint', '/privacy', '/terms', '/coaching', '/faq',
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
