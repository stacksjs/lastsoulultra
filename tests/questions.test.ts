import { describe, expect, it } from 'bun:test'
import { resolve } from 'node:path'
import { processDirectives } from '@stacksjs/stx'
import { absolute } from '../resources/data/site'

/**
 * /contact and /faq are the same page under two published URLs. They used to
 * be two byte-identical 238-line views, which is the arrangement where one of
 * them silently stops matching the other the first time an answer is edited.
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

describe('the questions page', () => {
  it('renders the same answers at both URLs', async () => {
    // stx stamps each render with its own scope id, which is not content.
    const scrub = (html: string): string => html.replace(/[a-z0-9]{6,}(?=["'\s])/gi, '')

    expect(scrub(await render('faq'))).toBe(scrub(await render('contact')))
  })

  it('keeps one copy of the answers, not one per view', async () => {
    for (const view of ['contact', 'faq'])
      expect((await Bun.file(`resources/views/${view}.stx`).text()).split('\n').length).toBeLessThan(15)

    const body = await Bun.file('resources/partials/contact-body.stx').text()
    expect(body).toContain('How does the Last Soul Ultra work?')
  })

  it('still answers the fifteen questions', async () => {
    const html = await render('contact')
    expect([...html.matchAll(/class="faq-q[^"]*">/g)]).toHaveLength(15)
  })

  it('canonicalises both to /contact', async () => {
    // Built from APP_URL rather than written out: CI materialises a .env from
    // .env.example, where APP_URL is stacks.localhost, so a hard-coded
    // production origin passes on a laptop and fails on a runner.
    for (const view of ['contact', 'faq'])
      expect(await render(view)).toContain(`rel="canonical" href="${absolute('/contact')}"`)
  })
})
