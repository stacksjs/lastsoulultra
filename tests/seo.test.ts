import { describe, expect, it } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { coachingPage } from '../resources/data/coaching'
import { legalPages } from '../resources/data/legal'
import { productionPages } from '../resources/data/production-pages'
import { indexablePaths } from '../resources/data/site'
import { publishedOrigin, robotsTxt, sitemapXml } from '../scripts/seo'

/**
 * The sitemap and robots.txt are committed static files, because the views
 * server serves public/ at the root while routes/ lives on the API site. A
 * committed artefact generated from code drifts the moment someone edits one
 * and not the other, and nothing about a stale sitemap errors - it just
 * quietly stops listing a page. These tests are the thing that notices.
 */
describe('seo artefacts', () => {
  it('the committed sitemap matches what the generator produces', async () => {
    const committed = await Bun.file('public/sitemap.xml').text()
    expect(committed).toBe(sitemapXml(publishedOrigin, indexablePaths))
  })

  it('the committed robots.txt matches what the generator produces', async () => {
    const committed = await Bun.file('public/robots.txt').text()
    expect(committed).toBe(robotsTxt(publishedOrigin))
  })

  /** Every view on disk, as the path the site serves it at. */
  function viewPaths(dir = 'resources/views', prefix = ''): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (entry.isDirectory())
        return viewPaths(join(dir, entry.name), `${prefix}/${entry.name}`)
      if (!entry.name.endsWith('.stx'))
        return []
      const name = entry.name.slice(0, -'.stx'.length)
      return [name === 'index' && prefix === '' ? '/' : `${prefix}/${name}`]
    })
  }

  /**
   * The canonical a view declares, read from its source. Views write it as a
   * literal, and the coaching modules build it from their slug.
   */
  function canonicalOf(path: string): string {
    const file = `resources/views${path === '/' ? '/index' : path}.stx`
    const source = readFileSync(file, 'utf8')
    const literal = /const canonicalPath = ['"]([^'"]+)['"]/.exec(source)
    if (literal)
      return literal[1]!
    const built = /const canonicalPath = modulePath\(['"]([^'"]+)['"]\)/.exec(source)
    if (built)
      return `/coaching/${built[1]}`
    throw new Error(`${file} declares no canonicalPath`)
  }

  /** A page that declares itself noindex is not expected in the sitemap. */
  function noindex(path: string): boolean {
    if (path === '/404')
      return true
    if (path.startsWith('/coaching/'))
      return coachingPage(path.slice('/coaching/'.length)).noindex === true
    return productionPages[path]?.noindex === true
  }

  it('lists every view that is not dynamic, private or noindex', () => {
    // Views on disk are the ground truth for what the site actually serves.
    // Recursive: /results and /coaching both hold pages a flat read missed.
    const expected = viewPaths().filter(path => !noindex(path) && canonicalOf(path) === path)

    expect(expected.length).toBeGreaterThan(13)
    for (const path of expected)
      expect(indexablePaths).toContain(path)
  })

  it('does not list a page that points its canonical somewhere else', () => {
    // /faq renders the contact page and canonicalises to /contact. Listing a
    // URL that tells a crawler it is not the canonical one asks for the page
    // to be ignored, and spends crawl budget doing it.
    const aliases = viewPaths().filter(path => !noindex(path) && canonicalOf(path) !== path)

    expect(aliases).toContain('/faq')
    for (const path of aliases) {
      expect(indexablePaths).not.toContain(path)
      // An alias must still point at a page the sitemap does list.
      expect(indexablePaths).toContain(canonicalOf(path))
    }
  })

  it('keeps the modules that need an account out of the sitemap', () => {
    const modules = viewPaths().filter(path => path.startsWith('/coaching/'))

    expect(modules).toHaveLength(8)
    for (const path of modules) {
      if (noindex(path))
        expect(indexablePaths).not.toContain(path)
    }
    expect(indexablePaths).toContain('/coaching/plans')
  })

  it('lists the canonical legal pages rather than the legacy redirects', () => {
    for (const page of legalPages)
      expect(indexablePaths).toContain(`/${page.slug}`)
    for (const page of legalPages)
      expect(indexablePaths).not.toContain(`/legal/${page.slug}`)
  })

  it('publishes absolute https URLs on a single origin', () => {
    const sitemap = sitemapXml(publishedOrigin, indexablePaths)
    const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1])

    expect(locs.length).toBe(indexablePaths.length)
    for (const loc of locs) {
      expect(loc.startsWith('https://')).toBe(true)
      expect(loc.startsWith(publishedOrigin)).toBe(true)
    }
    // A .localhost origin in a published sitemap is the failure this guards.
    expect(publishedOrigin).not.toContain('.localhost')
  })

  it('does not list the noindex 404 page', () => {
    expect(indexablePaths).not.toContain('/404')
  })
})
