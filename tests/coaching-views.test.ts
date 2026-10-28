import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { resolve } from 'node:path'
import { processDirectives } from '@stacksjs/stx'
import { coachingModules } from '../resources/data/coaching'
import { forgetBrand } from '../resources/functions/coaching-source'

/**
 * The eight module routes, rendered the way the site renders them.
 *
 * Each view is four lines that name a slug three times, so the failure these
 * guard against is a copied file that still says 'calendar' somewhere: a page
 * whose nav highlights the wrong tab, whose canonical points at its neighbour,
 * or which quietly loses its noindex.
 */

const payload = await Bun.file('tests/fixtures/brand-last-soul-ultra.json').json()
const realFetch = globalThis.fetch

/** Answer the brand endpoint from the fixture; refuse everything else. */
function stubHq(body: unknown = payload): void {
  globalThis.fetch = (async (input: any) => {
    const url = String(typeof input === 'string' ? input : input.url)
    if (url.includes('/api/brands/'))
      return body === null ? new Response('not found', { status: 404 }) : Response.json(body)
    throw new Error(`unexpected request: ${url}`)
  }) as typeof fetch
}

async function render(slug: string): Promise<string> {
  const path = resolve(`resources/views/coaching/${slug}.stx`)
  return processDirectives(await Bun.file(path).text(), {}, path, {
    enabled: true,
    cache: false,
    componentsDir: resolve('resources/components'),
    layoutsDir: resolve('resources/layouts'),
    partialsDir: resolve('resources/partials'),
  }, new Set())
}

beforeEach(() => forgetBrand())
afterEach(() => { globalThis.fetch = realFetch })

describe('a module route, with a brand published', () => {
  beforeEach(() => stubHq())

  it('has a view on disk for every registered module', async () => {
    for (const module of coachingModules)
      expect(await Bun.file(`resources/views/coaching/${module.slug}.stx`).exists()).toBe(true)
  })

  it('titles, describes and canonicalises itself from the registry', async () => {
    for (const module of coachingModules) {
      const html = await render(module.slug)

      expect(html).toContain(`<title>${module.title} - Last Soul Ultra coaching</title>`)
      expect(html).toContain(`content="${module.summary}"`)
      expect(html).toContain(`rel="canonical" href="https://lastsoulultra.com/coaching/${module.slug}"`)
    }
  })

  it('highlights its own tab, once', async () => {
    for (const module of coachingModules) {
      const html = await render(module.slug)
      const current = [...html.matchAll(/href="\/coaching\/([a-z]+)"\s+aria-current="page"/g)].map(match => match[1])

      expect(current).toEqual([module.slug])
    }
  })

  it('links out to the section it is standing in for', async () => {
    for (const module of coachingModules) {
      const html = await render(module.slug)
      expect(html).toContain(`/brands/last-soul-ultra?section=${module.slug}`)
    }
  })

  it('keeps the modules that need an account out of search results', async () => {
    for (const module of coachingModules) {
      const html = await render(module.slug)
      const noindex = html.includes('name="robots" content="noindex,nofollow"')

      expect(noindex).toBe(module.scope !== 'public')
    }
  })

  it('says which scope a panel is before the click', async () => {
    expect(await render('plans')).not.toContain('coach-scope')
    expect(await render('calendar')).toContain('Needs a training account')
    expect(await render('health')).toContain('Only you see this')
    expect(await render('messages')).toContain('Only you see this')
  })

  it('renders the storefront on the storefront, and nowhere else', async () => {
    const plans = await render('plans')

    expect(plans).toContain('coach-offers')
    expect(plans).toContain('€19.99 a month')
    expect(await render('calendar')).not.toContain('coach-offers')
  })

  it('frames the panel on every published module', async () => {
    for (const module of coachingModules) {
      const html = await render(module.slug)
      expect(html).toContain(`<hq-coaching brand="last-soul-ultra"`)
      expect(html).not.toContain('Not open yet')
    }
  })
})

describe('a module route, with nothing published', () => {
  beforeEach(() => stubHq(null))

  it('says so rather than showing an empty storefront', async () => {
    const plans = await render('plans')

    expect(plans).toContain('Nothing is open yet')
    expect(plans).not.toContain('coach-offers')
  })

  it('offers no nav to panels that cannot load', async () => {
    const plans = await render('plans')

    expect(plans).not.toContain('coach-nav')
    expect(plans).not.toContain('/coaching/calendar')
  })

  it('still renders the page it was asked for', async () => {
    const calendar = await render('calendar')

    expect(calendar).toContain('<title>Your week - Last Soul Ultra coaching</title>')
    expect(calendar).toContain('Not open yet')
  })

  it('frames no panel, and loads no remote script, for a module nobody published', async () => {
    const calendar = await render('calendar')

    expect(calendar).not.toContain('<hq-coaching')
    expect(calendar).not.toContain('hq-coaching.js')
  })

  it('drops the notice that promised an account would open the panel', async () => {
    // With nothing to sign in to, "needs a training account" is an excuse,
    // not an explanation.
    expect(await render('calendar')).not.toContain('Needs a training account')
    expect(await render('health')).not.toContain('Only you see this')
  })

  it('leaves the storefront one empty state, not two', async () => {
    const plans = await render('plans')

    expect([...plans.matchAll(/class="coach-empty"/g)]).toHaveLength(1)
    expect(plans).toContain('Nothing is open yet')
  })
})
