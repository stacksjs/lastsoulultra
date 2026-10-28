import { describe, expect, it } from 'bun:test'
import { breadcrumbs, organization, structuredData, structuredDataJson } from '../resources/data/structured'

/**
 * Structured data makes claims on the site's behalf in places nobody on the
 * team will ever look. The rule this suite enforces is that it may only claim
 * what the site already prints in visible text, because markup that outruns
 * the page is what gets a site's rich results withdrawn.
 */

const imprint = await Bun.file('resources/views/imprint.stx').text()
const footer = await Bun.file('resources/components/SiteFooter.stx').text()

describe('the organisation', () => {
  it('states nothing the imprint does not', () => {
    const org = organization() as any

    expect(imprint).toContain(org.name)
    expect(imprint).toContain(org.email)
    expect(imprint).toContain(org.telephone)
    expect(imprint).toContain(org.address.streetAddress)
    expect(imprint).toContain(org.address.postalCode)
    expect(imprint).toContain(org.address.addressLocality)
  })

  it('claims only the profiles that belong to the company', () => {
    const org = organization() as any

    for (const profile of org.sameAs)
      expect(footer).toContain(new URL(profile).host)
    // The footer also links a person's YouTube and Twitch. Listing those as
    // the company's own accounts is a claim the imprint does not make.
    expect(org.sameAs.join(' ')).not.toContain('youtube')
    expect(org.sameAs.join(' ')).not.toContain('twitch')
  })

  it('is one node the rest of the graph points at, not a copy per page', () => {
    const graph = structuredData('/results/last-soul-ultra-2026', 'x') as any
    const ids = graph['@graph'].map((node: any) => node['@id']).filter(Boolean)

    expect(new Set(ids).size).toBe(ids.length)
    expect(graph['@graph'][1].publisher['@id']).toBe(graph['@graph'][0]['@id'])
  })
})

describe('breadcrumbs', () => {
  it('describes where a nested page sits', () => {
    const crumbs = breadcrumbs('/results/last-soul-ultra-2025', 'Last Soul Ultra 2025 results | Last Soul Ultra') as any

    expect(crumbs.itemListElement.map((item: any) => item.name))
      .toEqual(['Last Soul Ultra', 'Results', 'Last Soul Ultra 2025 results'])
    expect(crumbs.itemListElement.map((item: any) => item.position)).toEqual([1, 2, 3])
    // The page itself carries no item: it is the URL being described.
    expect(crumbs.itemListElement[2].item).toBeUndefined()
  })

  it('names a coaching module the way the module pages do', () => {
    const crumbs = breadcrumbs('/coaching/account', 'Billing and renewal - Last Soul Ultra coaching') as any
    expect(crumbs.itemListElement[2].name).toBe('Billing and renewal')
  })

  it('says nothing about a page with no parent', () => {
    for (const path of ['/', '/format', '/coaching', '/results'])
      expect(breadcrumbs(path, 'x')).toBeNull()
  })

  it('says nothing about a section it has no name for', () => {
    expect(breadcrumbs('/some/unknown', 'x')).toBeNull()
  })
})

describe('what is deliberately not published', () => {
  it('describes no event, no FAQ and no offer', () => {
    // The 2026 edition has been run, the FAQ answers live in a view rather
    // than in data, and coaching prices are the coach's and served from HQ.
    const json = structuredDataJson('/coaching/plans', 'What is open - Last Soul Ultra coaching')

    for (const type of ['Event', 'SportsEvent', 'FAQPage', 'Offer', 'Product', 'Review'])
      expect(json).not.toContain(`"${type}"`)
  })
})

describe('serialising it', () => {
  it('parses, and declares the vocabulary', () => {
    const parsed = JSON.parse(structuredDataJson('/', 'Last Soul Ultra'))
    expect(parsed['@context']).toBe('https://schema.org')
    expect(Array.isArray(parsed['@graph'])).toBe(true)
  })

  it('cannot close the script element it sits in', () => {
    const json = structuredDataJson('/results/last-soul-ultra-2026', '</script><img src=x onerror=alert(1)>')

    expect(json).not.toContain('<')
    expect(json).toContain('\\u003c')
    expect(JSON.parse(json)['@graph'][2].itemListElement[2].name).toContain('</script>')
  })
})
