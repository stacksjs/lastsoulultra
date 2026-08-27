import { describe, expect, it } from 'bun:test'
import { readdirSync } from 'node:fs'
import { legalPages } from '../resources/data/legal'
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

  it('lists every view that is not dynamic, private or noindex', () => {
    // Views on disk are the ground truth for what the site actually serves.
    const views = readdirSync('resources/views')
      .filter(name => name.endsWith('.stx'))
      .map(name => name.slice(0, -'.stx'.length))

    const expected = views
      // 404 is noindex on purpose, and index is the root path.
      .filter(name => name !== '404')
      .map(name => (name === 'index' ? '/' : `/${name}`))

    for (const path of expected)
      expect(indexablePaths).toContain(path)
  })

  it('lists every legal page the dynamic route can serve', () => {
    for (const page of legalPages)
      expect(indexablePaths).toContain(`/legal/${page.slug}`)
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
