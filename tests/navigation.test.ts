import { describe, expect, it } from 'bun:test'
import { resolve } from 'node:path'
import { processDirectives } from '@stacksjs/stx'

/**
 * The chrome every page shares marked nothing, so the navigation read the
 * same on all twenty-five routes and no assistive technology could say which
 * one you were on.
 */

async function render(view: string): Promise<string> {
  const path = resolve(`resources/views/${view}.stx`)
  return processDirectives(await Bun.file(path).text(), {}, path, {
    enabled: true,
    cache: false,
    componentsDir: resolve('resources/components'),
    layoutsDir: resolve('resources/layouts'),
    partialsDir: resolve('resources/partials'),
  }, new Set())
}

/** Every href marked as the current page, deduplicated. */
async function marked(view: string): Promise<string[]> {
  const html = await render(view)
  return [...new Set([...html.matchAll(/<a\b[^>]*aria-current="(?:page|location)"[^>]*>/g)].map(match => /href="([^"]+)"/.exec(match[0])?.[1]).filter(Boolean))] as string[]
}

describe('knowing which page you are on', () => {
  it('marks the page itself', async () => {
    expect(await marked('format')).toEqual(['/format'])
    expect(await marked('sponsorship')).toEqual(['/sponsorship'])
  })

  it('marks home only at the root, not on every path under it', async () => {
    expect(await marked('index')).toEqual(['/'])
    expect(await marked('format')).not.toContain('/')
  })

  it('marks the section a nested page belongs to', async () => {
    expect(await marked('coaching/calendar')).toContain('/coaching')
    expect(await marked('results/last-soul-ultra-2026')).toContain('/results')
  })

  it('follows the canonical, so an alias marks the page it points at', async () => {
    // /faq renders the contact page and canonicalises to /contact.
    expect(await marked('faq')).toEqual(await marked('contact'))
    expect(await marked('faq')).toContain('/contact')
  })

  it('marks nothing on a page that is in neither nav', async () => {
    expect(await marked('404')).toEqual([])
  })

  it('marks it in the drawer and the footer too, not just the bar', async () => {
    const html = await render('format')
    // Three copies of the Format link: the bar, the mobile drawer, the footer.
    expect([...html.matchAll(/href="\/format"[^>]*aria-current="(?:page|location)"/g)].length).toBeGreaterThanOrEqual(3)
  })

  it('tells it apart by more than colour', async () => {
    const css = await Bun.file('resources/assets/styles/site/stx-site.css').text()
    expect(css).toContain('[aria-current=page]{color:var(--lsu-white);box-shadow')
    expect(css).toContain('text-decoration:underline')
  })
})
