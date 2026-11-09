import { describe, expect, it } from 'bun:test'
import { resolve } from 'node:path'
import { processDirectives } from '@stacksjs/stx'

/**
 * The entry page's job is one form. It shipped with two: a placeholder that
 * read "Loading account access…" in the section the page calls #form, which
 * nothing ever replaced, and the working portal more than a thousand pixels
 * below it. Nothing errored, and the page looked like it was still loading.
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

describe('the entry page', () => {
  it('puts the form in the section it calls the form', async () => {
    const html = await render('lottery')
    const form = html.slice(html.indexOf('id="form"'))

    expect(form.indexOf('race-portal')).toBeGreaterThan(-1)
    // Before the next section begins.
    expect(form.indexOf('race-portal')).toBeLessThan(form.indexOf('open-now'))
  })

  it('has one portal, not a working one and a decorative one', async () => {
    const html = await render('lottery')
    expect([...html.matchAll(/class="race-portal"/g)]).toHaveLength(1)
  })

  it('shows no loading state that nothing ever clears', async () => {
    const html = await render('lottery')

    expect(html).not.toContain('Loading account access')
    expect(html).not.toContain('data-lottery-portal')
  })

  it('offers the same account on the profile page', async () => {
    expect(await render('profile')).toContain('race-portal')
  })
})

/**
 * The published site opens every entry link as a window over the page
 * (Stage 1 sign in, Stage 2 request, Stage 3 complete). It shipped here as a
 * separate page you were sent away to instead.
 */
describe('the race-entry window', () => {
  const origin = 'https://www.lastsoulultra.com'
  const click = (href: string, extra: Record<string, unknown> = {}) => ({
    button: 0,
    target: { closest: () => ({ href, target: '' }) },
    ...extra,
  })

  it('takes a plain click on an entry link, with the race it names', async () => {
    const { entryLinkQuery } = await import('../resources/functions/entry-dialog')
    expect(entryLinkQuery(click('/lottery?event=lsu-2027-uk'), origin)?.get('event')).toBe('lsu-2027-uk')
    expect(entryLinkQuery(click(`${origin}/lottery`), origin)).not.toBeNull()
    expect(entryLinkQuery(click('/de/lottery/'), origin)).not.toBeNull()
  })

  it('leaves every other click to the browser', async () => {
    const { entryLinkQuery } = await import('../resources/functions/entry-dialog')
    expect(entryLinkQuery(click('/world-series'), origin)).toBeNull()
    expect(entryLinkQuery(click('/lottery-results'), origin)).toBeNull()
    expect(entryLinkQuery(click('https://elsewhere.example/lottery'), origin)).toBeNull()
    expect(entryLinkQuery(click('/lottery', { metaKey: true }), origin)).toBeNull()
    expect(entryLinkQuery(click('/lottery', { button: 1 }), origin)).toBeNull()
    expect(entryLinkQuery(click('/lottery', { defaultPrevented: true }), origin)).toBeNull()
    expect(entryLinkQuery({ button: 0, target: { closest: () => ({ href: '/lottery', target: '_blank' }) } }, origin)).toBeNull()
    expect(entryLinkQuery({ button: 0, target: { closest: () => null } }, origin)).toBeNull()
  })

  it('is on the pages that link to the entry page, with the three stages', async () => {
    const html = await render('world-series')
    const dialog = html.slice(html.indexOf('class="entry-dialog"'))
    expect(html).toContain('class="entry-dialog"')
    expect(dialog).toContain('race-portal')
    for (const stage of ['Sign in', 'Request', 'Complete'])
      expect(dialog).toContain(`<span class="entry-dialog-label">${stage}</span>`)
  })

  it('stays off the pages that already carry the portal', async () => {
    for (const view of ['lottery', 'profile']) {
      const html = await render(view)
      expect(html).not.toContain('class="entry-dialog"')
      expect([...html.matchAll(/class="race-portal"/g)]).toHaveLength(1)
    }
  })
})
