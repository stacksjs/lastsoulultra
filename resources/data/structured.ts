import { coachingModule } from './coaching'
import { race } from './race'
import { absolute, siteOrigin } from './site'

/**
 * JSON-LD, for the two things a search engine cannot work out from the page.
 *
 * The site had none at all, so nothing tied its pages to one publisher and
 * nothing described where a nested page sits.
 *
 * Deliberately narrow. Every value here is one the site already prints in
 * visible text - the organisation's details come from the imprint, the
 * profiles from the footer - because markup that claims more than the page
 * shows is what gets a site's rich results turned off. In particular:
 *
 *   No Event. race.ts describes the August 2026 edition, which has been run;
 *   describing a finished race as an event invites a wrong date in a result.
 *   No FAQPage. The questions on /contact are written into that view, and
 *   resources/data/faq.ts is a second copy nothing renders, so marking up
 *   from it would publish answers that need not match the page.
 *   No Product or Offer for coaching. Those prices are the coach's, served
 *   from HQ, and are not approved LSU pricing.
 */

const ORGANIZATION_ID = `${siteOrigin}/#organization`
const WEBSITE_ID = `${siteOrigin}/#website`

/**
 * The publisher, as the imprint states it.
 *
 * `sameAs` carries the two profiles that belong to the organisation. The
 * footer also links Kim Gottwald's YouTube and Twitch; those are a person's
 * channels, and listing them as the company's own accounts would be a claim
 * the imprint does not make.
 */
export function organization(): Record<string, unknown> {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    'name': race.organiser,
    'alternateName': race.name,
    'url': absolute('/'),
    'logo': absolute('/assets/lsu/images/lsu-logo.svg'),
    'email': race.email,
    'telephone': '+49 176 3122 9027',
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': 'Ehrenfeldstr. 14',
      'postalCode': '44789',
      'addressLocality': 'Bochum',
      'addressCountry': 'DE',
    },
    'sameAs': [race.instagram, race.livestreams],
  }
}

export function website(): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    'url': absolute('/'),
    'name': race.name,
    'inLanguage': 'en-GB',
    'publisher': { '@id': ORGANIZATION_ID },
  }
}

/** The label a crumb uses for a section, in the site's own words. */
const SECTIONS: Record<string, string> = {
  results: 'Results',
  coaching: 'Coaching',
}

/** The label for the last crumb, which is the page itself. */
function leafName(path: string, title: string): string {
  const [, section, slug] = path.split('/')
  if (section === 'coaching' && slug)
    return coachingModule(slug)?.title ?? title
  // A results page is titled for its edition; the part before the first
  // separator is the name without the site's suffix.
  return title.split(' - ')[0]?.split(' | ')[0]?.trim() || title
}

/**
 * Where a nested page sits. Only for pages that have a parent: a breadcrumb
 * of one item describes nothing, and the top-level pages are all siblings.
 */
export function breadcrumbs(path: string, title: string): Record<string, unknown> | null {
  const segments = path.split('/').filter(Boolean)
  if (segments.length < 2)
    return null

  const section = segments[0]!
  const sectionName = SECTIONS[section]
  if (!sectionName)
    return null

  return {
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': race.name, 'item': absolute('/') },
      { '@type': 'ListItem', 'position': 2, 'name': sectionName, 'item': absolute(`/${section}`) },
      { '@type': 'ListItem', 'position': 3, 'name': leafName(path, title) },
    ],
  }
}

/** Everything one page publishes, as a single graph. */
export function structuredData(path: string, title: string): Record<string, unknown> {
  const graph: Record<string, unknown>[] = [organization(), website()]
  const crumbs = breadcrumbs(path, title)
  if (crumbs)
    graph.push(crumbs)

  return { '@context': 'https://schema.org', '@graph': graph }
}

/**
 * Serialised for a script element. `<` is escaped so a value can never close
 * the element it sits in, which is the one way JSON-LD becomes an injection.
 */
export function structuredDataJson(path: string, title: string): string {
  return JSON.stringify(structuredData(path, title)).replace(/</g, '\\u003c')
}
