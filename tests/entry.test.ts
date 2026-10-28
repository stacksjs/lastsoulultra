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
