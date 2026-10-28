import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { resolve } from 'node:path'
import { processDirectives } from '@stacksjs/stx'
import { coachingModules } from '../resources/data/coaching'
import { absolute } from '../resources/data/site'
import { coachingOrigin, forgetBrand } from '../resources/functions/coaching-source'

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
      expect(html).toContain(`rel="canonical" href="${absolute(`/coaching/${module.slug}`)}"`)
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

    expect(calendar).toContain('<title>Your workouts - Last Soul Ultra coaching</title>')
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

describe('getting back out of a module', () => {
  it('links to the hub from every module, published or not', async () => {
    stubHq(null)
    for (const module of coachingModules)
      expect(await render(module.slug)).toMatch(/<a class="[^"]*coach-up[^"]*" href="\/coaching">Coaching<\/a>/)
  })

  it('leaves the storefront a way back when the nav has hidden itself', async () => {
    stubHq(null)
    const plans = await render('plans')

    // The nav only renders with more than one module to move between.
    expect(plans).not.toContain('coach-nav')
    expect(plans).toContain('href="/coaching"')
  })
})

describe('warming the connection to HQ', () => {
  it('promises it on a module the brand publishes', async () => {
    stubHq()
    const html = await render('calendar')

    expect(html).toContain(`<link rel="preconnect" href="${coachingOrigin()}" crossorigin>`)
    expect(html).toContain(`<link rel="dns-prefetch" href="${coachingOrigin()}">`)
  })

  it('promises nothing on a page that will not call HQ', async () => {
    // With nothing published the module frames nothing, so a held-open
    // socket would be a connection made for no request.
    stubHq(null)
    const html = await render('calendar')

    expect(html).not.toContain('rel="preconnect"')
    expect(html).not.toContain('rel="dns-prefetch"')
  })

  it('warms it before the element that needs it', async () => {
    stubHq()
    const html = await render('calendar')

    expect(html.indexOf('rel="preconnect"')).toBeLessThan(html.indexOf('hq-coaching.js'))
  })
})

describe('what a tier says it is', () => {
  it('prints what the tier includes and how the coach trains', async () => {
    stubHq()
    const plans = await render('plans')

    expect(plans).toContain('€19.99 is a sample price')
    expect(plans).toContain('Demonstration content, not an approved LSU coach method.')
  })

  it('prints one paragraph when HQ carries the same sentence in both', async () => {
    const same = structuredClone(payload)
    same.offers[0].method.summary = same.offers[0].product.description
    stubHq(same)
    const plans = await render('plans')

    expect(plans).not.toContain('coach-offer-method')
    expect([...plans.matchAll(/sample price/g)]).toHaveLength(1)
  })
})

describe('the coaching hub', () => {
  async function hub(): Promise<string> {
    const path = resolve('resources/views/coaching.stx')
    return processDirectives(await Bun.file(path).text(), {}, path, {
      enabled: true,
      cache: false,
      componentsDir: resolve('resources/components'),
      layoutsDir: resolve('resources/layouts'),
      partialsDir: resolve('resources/partials'),
    }, new Set())
  }

  it('embeds the portal and warms the connection when something is published', async () => {
    stubHq()
    const html = await hub()

    expect(html).toContain('<hq-coaching')
    expect(html).toContain('rel="preconnect"')
  })

  it('loads no remote script when there is nothing to show', async () => {
    // No published brand means no subscriptions, so no receipt can arrive
    // here either, and the element has nothing left to do.
    stubHq(null)
    const html = await hub()

    expect(html).not.toContain('<hq-coaching')
    expect(html).not.toContain('hq-coaching.js')
    expect(html).not.toContain('rel="preconnect"')
    expect(html).toContain('Nothing is open yet')
  })
})

describe('what the hub promises', () => {
  async function hubHtml(): Promise<string> {
    const path = resolve('resources/views/coaching.stx')
    return processDirectives(await Bun.file(path).text(), {}, path, {
      enabled: true,
      cache: false,
      componentsDir: resolve('resources/components'),
      layoutsDir: resolve('resources/layouts'),
      partialsDir: resolve('resources/partials'),
    }, new Set())
  }

  it('offers the portal only when there is one', async () => {
    stubHq()
    expect(await hubHtml()).toContain('Open the portal')
  })

  it('promises neither a portal nor eight panels it is not showing', async () => {
    stubHq(null)
    const html = await hubHtml()

    expect(html).not.toContain('Open the portal')
    expect(html).not.toContain('the eight panels your training lives in')
    expect(html).toContain('See what is coming')
    expect(html).toContain('Not open yet')
  })
})
