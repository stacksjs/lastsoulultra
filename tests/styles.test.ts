import { describe, expect, it } from 'bun:test'
import { readdirSync } from 'node:fs'
import { assetExists, assetUrls } from '../scripts/audit-html'

/**
 * stx-site.css is the one sheet every route downloads. It drifted into being
 * the place page-specific rules went, and 7 of its 11.5 KB ended up being
 * /coaching rules served to twenty-four pages that cannot match them.
 */

const siteWide = await Bun.file('resources/assets/styles/site/stx-site.css').text()

/** Selectors a rule can be keyed on, one per top-level rule. */
function selectors(css: string): string[] {
  return [...css.matchAll(/(^|[}\n])([^{}@][^{}]*)\{/g)]
    .flatMap(match => match[2]!.split(','))
    .map(selector => selector.trim())
    .filter(Boolean)
}

describe('the sheet every page downloads', () => {
  it('carries nothing keyed to one page', () => {
    // Page sheets live beside it and are named for their route.
    const pages = readdirSync('resources/assets/styles/site')
      .filter(name => name.endsWith('.css') && !['base.css', 'stx-site.css'].includes(name))
      .map(name => name.slice(0, -'.css'.length))

    const offenders = selectors(siteWide).filter(selector =>
      pages.some(page => selector.includes(`.${page}-`) || selector.includes(`.lsu-scope-${page}`)))

    expect(offenders).toEqual([])
  })

  it('stays small enough to be worth sending everywhere', () => {
    expect(siteWide.length).toBeLessThan(5000)
  })

  it('still carries what every page needs', () => {
    // The skip link, the shared portal chrome, and the one global motion rule.
    expect(siteWide).toContain('.lsu-skip')
    expect(siteWide).toContain('.race-portal')
    expect(siteWide).toContain('prefers-reduced-motion')
  })
})

describe('what the stylesheets reference', () => {
  it('names only files the deploy carries', async () => {
    const missing: string[] = []
    for (const name of readdirSync('resources/assets/styles/site')) {
      if (!name.endsWith('.css')) continue
      const css = await Bun.file(`resources/assets/styles/site/${name}`).text()
      for (const url of assetUrls(css)) {
        if (!assetExists(url))
          missing.push(`${name}: ${url}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('checks a real number of them, not zero', async () => {
    // A regex that stopped matching would pass the test above silently.
    let found = 0
    for (const name of readdirSync('resources/assets/styles/site')) {
      if (!name.endsWith('.css')) continue
      found += assetUrls(await Bun.file(`resources/assets/styles/site/${name}`).text()).length
    }
    expect(found).toBeGreaterThan(20)
  })
})
