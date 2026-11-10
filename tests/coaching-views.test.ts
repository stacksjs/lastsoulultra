import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { resolve } from 'node:path'
import { processDirectives } from '@stacksjs/stx'
import { coachingModules } from '../resources/data/coaching'
import { absolute } from '../resources/data/site'
import { coachingOrigin, forgetBrand } from '../resources/functions/coaching-source'

/**
 * The module routes this site serves, rendered the way the site renders them.
 *
 * Only the storefront is a page here. Every module that needs an account is
 * the training app's own screen, reached by a redirect (config/server.ts,
 * tests/account-only.test.ts), so it has no view to render and none may be
 * added: a page behind a sign-in that this site cannot check is a page anyone
 * can open.
 */

/** The modules with a page on this site. */
const served = coachingModules.filter(module => module.scope === 'public')

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

  it('has a view on disk for the storefront, and for nothing that needs an account', async () => {
    for (const module of coachingModules)
      expect(await Bun.file(`resources/views/coaching/${module.slug}.stx`).exists()).toBe(module.scope === 'public')
  })

  it('titles, describes and canonicalises itself from the registry', async () => {
    for (const module of served) {
      const html = await render(module.slug)

      expect(html).toContain(`<title>${module.label} - Last Soul Ultra coaching</title>`)
      expect(html).toContain(`content="${module.summary}"`)
      expect(html).toContain(`rel="canonical" href="${absolute(`/coaching/${module.slug}`)}"`)
    }
  })

  // The two are allowed to differ and mostly do, so assert the split rather
  // than the strings: the tab takes the nav word a reader just clicked, the
  // heading keeps LSU's own sentence. Collapsing either into the other is the
  // change this guards against.
  it('puts the nav word in the tab and the site voice in the heading', async () => {
    for (const module of served) {
      const html = await render(module.slug)

      expect(html).toContain(`<title>${module.label} - Last Soul Ultra coaching</title>`)
      expect(html).toContain(module.title)
    }

    const store = await render('plans')
    expect(store).toContain('<title>Store - Last Soul Ultra coaching</title>')
    expect(store).toContain('What is open')
  })

  it('highlights its own tab, once', async () => {
    // Only the storefront is served here. Every other module's link leaves
    // for the training app, so it is never the page a visitor is on.
    for (const module of coachingModules.filter(item => item.scope === 'public')) {
      const html = await render(module.slug)
      const current = [...html.matchAll(/href="\/coaching\/([a-z]+)"\s+aria-current="page"/g)].map(match => match[1])

      expect(current).toEqual([module.slug])
    }
  })

  it('links out to the section it is standing in for', async () => {
    for (const module of served) {
      const html = await render(module.slug)
      expect(html).toContain(`/brands/last-soul-ultra?section=${module.slug}`)
    }
  })

  it('keeps the modules that need an account out of search results', async () => {
    for (const module of served) {
      const html = await render(module.slug)
      const noindex = html.includes('name="robots" content="noindex,nofollow"')

      expect(noindex).toBe(module.scope !== 'public')
    }
  })

  it('puts no account notice on the storefront', async () => {
    expect(await render('plans')).not.toContain('coach-scope')
  })

  it('renders the storefront on the storefront, and nowhere else', async () => {
    const plans = await render('plans')

    expect(plans).toContain('coach-offers')
    expect(plans).toContain('€19.99 a month')
  })

  it('frames the panel on every published module', async () => {
    for (const module of served) {
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

  it('frames no panel, and loads no remote script, when nobody has published', async () => {
    const plans = await render('plans')

    expect(plans).not.toContain('<hq-coaching')
    expect(plans).not.toContain('hq-coaching.js')
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
    for (const module of served)
      expect(await render(module.slug)).toMatch(/<a class="[^"]*coach-up[^"]*" href="\/coaching"[^>]*>Coaching<\/a>/)
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
    const html = await render('plans')

    expect(html).toContain(`<link rel="preconnect" href="${coachingOrigin()}" crossorigin>`)
    expect(html).toContain(`<link rel="dns-prefetch" href="${coachingOrigin()}">`)
  })

  it('promises nothing on a page that will not call HQ', async () => {
    // With nothing published the module frames nothing, so a held-open
    // socket would be a connection made for no request.
    stubHq(null)
    const html = await render('plans')

    expect(html).not.toContain('rel="preconnect"')
    expect(html).not.toContain('rel="dns-prefetch"')
  })

  it('warms it before the element that needs it', async () => {
    stubHq()
    const html = await render('plans')

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
