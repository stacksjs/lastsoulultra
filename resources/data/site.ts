import { env } from '@stacksjs/env'
import { legalPages } from './legal'
import { at, shots } from './media'
import { race } from './race'

/**
 * Site-level constants: origin, navigation, footer.
 *
 * Anything a page prints twice lives here so the two copies cannot drift.
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
 * The share image. One frame for the whole site rather than a generated card
 * per route: this is an eight-page event site, and the photograph of a corral
 * under floodlights says more about it than any composed card would.
 */
/* Absolute, because og:image and twitter:image are read by machines that have
 * no page to resolve a path against. `at()` returns an origin-relative path
 * now that the photographs are served from here rather than a CDN. */
export const socialImage = absolute(at(shots.board, 1080))
export const socialImageAlt = shots.board.alt

export interface NavItem {
  label: string
  href: string
  /** Sends the visitor off-site. */
  external?: boolean
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
  '/',
  '/format',
  '/lottery',
  '/results',
  '/faq',
  '/sponsorship',
  '/contact',
  ...legalPages.map(page => `/legal/${page.slug}`),
]

export const nav: NavItem[] = [
  { label: 'the format', href: '/format' },
  { label: 'enter', href: '/lottery' },
  { label: 'results', href: '/results' },
  { label: 'faq', href: '/faq' },
  { label: 'sponsorship', href: '/sponsorship' },
]

export const footerLinks: NavItem[] = [
  { label: 'contact', href: '/contact' },
  { label: 'imprint', href: '/legal/imprint' },
  { label: 'privacy', href: '/legal/privacy' },
  { label: 'terms', href: '/legal/terms' },
]

export const elsewhere: NavItem[] = [
  { label: 'instagram', href: race.instagram, external: true },
  { label: 'livestreams', href: race.livestreams, external: true },
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
