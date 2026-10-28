import { describe, expect, it } from 'bun:test'
import { coachingModule, coachingModules, enabledModules, indexableModulePaths, modulePath } from '../resources/data/coaching'
import { formatPrice, formatTrial, parseBrand } from '../resources/functions/coaching-brand'

describe('the coaching module registry', () => {
  it('uses each HQ module key once, as its own URL segment', () => {
    const slugs = coachingModules.map(module => module.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z]+$/)
      expect(modulePath(slug)).toBe(`/coaching/${slug}`)
    }
  })

  it('covers the eight modules HQ publishes, and nothing invented', () => {
    expect(coachingModules.map(module => module.slug).sort()).toEqual(
      ['account', 'calendar', 'feedback', 'health', 'library', 'messages', 'plans', 'progress'],
    )
  })

  it('shows only the storefront when no brand is published', () => {
    // An unreachable or draft brand must not advertise panels that cannot load.
    expect(enabledModules(undefined).map(module => module.slug)).toEqual(['plans'])
    expect(enabledModules([]).map(module => module.slug)).toEqual(['plans'])
  })

  it('keeps this site\'s order rather than the order the brand happens to list', () => {
    expect(enabledModules(['account', 'plans', 'calendar']).map(module => module.slug))
      .toEqual(['plans', 'calendar', 'account'])
  })

  it('ignores a module the brand names that this site does not serve', () => {
    expect(enabledModules(['plans', 'whiteboard']).map(module => module.slug)).toEqual(['plans'])
  })

  it('indexes only what a visitor without an account can actually read', () => {
    expect(indexableModulePaths()).toEqual(['/coaching/plans'])
    for (const module of coachingModules) {
      if (module.scope !== 'public')
        expect(indexableModulePaths()).not.toContain(modulePath(module.slug))
    }
  })

  it('marks health and messages as account-private, because a brand never sees them', () => {
    expect(coachingModule('health')?.scope).toBe('private')
    expect(coachingModule('messages')?.scope).toBe('private')
  })

  it('says what each panel does in a full sentence', () => {
    for (const module of coachingModules) {
      expect(module.summary.length).toBeGreaterThan(40)
      expect(module.summary.endsWith('.')).toBe(true)
      // The site's one hard typographic rule.
      expect(module.summary).not.toContain('—')
      expect(module.title).not.toContain('—')
    }
  })

  it('does not know about a module that is not registered', () => {
    expect(coachingModule('nope')).toBeUndefined()
  })
})

/**
 * The fixture is a verbatim capture of `GET /api/brands/last-soul-ultra` from
 * the HQ preview stack, preview wording and sample price included. It is here
 * to pin the shape of the contract, not to describe LSU's real offer.
 */
const payload = await Bun.file('tests/fixtures/brand-last-soul-ultra.json').json()

/** A deep copy, so a test that breaks one field cannot leak into the next. */
function sample(): any {
  return structuredClone(payload)
}

describe('reading the published brand', () => {
  it('reads the real HQ payload', () => {
    const brand = parseBrand(sample(), 'last-soul-ultra')

    expect(brand?.name).toBe('Last Soul Ultra Preview')
    expect(brand?.headline).toBe('Train for the next start.')
    expect(brand?.modules).toContain('calendar')
    expect(brand?.offers).toHaveLength(1)
    expect(brand?.offers[0].coach).toBe('LSU Preview Coach')
    expect(brand?.offers[0].method.version).toBe(1)
    expect(brand?.offers[0].product.priceCents).toBe(1999)
  })

  it('refuses a payload published for a different brand', () => {
    expect(parseBrand(sample(), 'another-race')).toBeNull()
  })

  it('treats an unpublished brand, a broken payload and an outage alike', () => {
    for (const raw of [null, undefined, 'nope', 42, {}, { settings: {} }, { slug: 'last-soul-ultra' }])
      expect(parseBrand(raw, 'last-soul-ultra')).toBeNull()
  })

  it('drops one malformed offer rather than the whole storefront', () => {
    const raw = sample()
    raw.offers.push({ label: 'Broken', method: { name: 'x' } })
    const brand = parseBrand(raw, 'last-soul-ultra')

    expect(brand?.offers.map((offer: { label: string }) => offer.label)).toEqual(['Preview running'])
  })

  it('refuses an offer with no price rather than printing a free one', () => {
    const raw = sample()
    delete raw.offers[0].product.price_cents
    expect(parseBrand(raw, 'last-soul-ultra')?.offers).toEqual([])
  })

  it('keeps a javascript: or relative URL out of an href', () => {
    const raw = sample()
    raw.settings.support_url = 'javascript:alert(1)'
    raw.settings.privacy_url = '/privacy'
    raw.offers[0].method.contact_url = 'data:text/html,<script>'
    const brand = parseBrand(raw, 'last-soul-ultra')

    expect(brand?.supportUrl).toBeNull()
    expect(brand?.privacyUrl).toBeNull()
    expect(brand?.offers[0].method.contactUrl).toBeNull()
    expect(brand?.termsUrl).toBe('https://www.lastsoulultra.com/terms')
  })

  it('ignores a module key that is not a plain lower-case word', () => {
    const raw = sample()
    raw.settings.modules = ['plans', '../admin', 42, 'calendar']
    expect(parseBrand(raw, 'last-soul-ultra')?.modules).toEqual(['plans', 'calendar'])
  })

  it('falls back to English for a locale HQ does not publish', () => {
    const raw = sample()
    raw.settings.locale = 'fr'
    expect(parseBrand(raw, 'last-soul-ultra')?.locale).toBe('en')
  })
})

describe('printing a coach\'s price', () => {
  const base = { id: 1, name: 'Running', description: '', priceCents: 1999, currency: 'EUR', interval: 'month', trialDays: 0 }

  it('prints the coach\'s own amount and interval', () => {
    expect(formatPrice(base)).toBe('€19.99 a month')
    expect(formatPrice({ ...base, priceCents: 12000, interval: 'year' })).toBe('€120 a year')
    expect(formatPrice({ ...base, currency: 'GBP', priceCents: 2500 })).toBe('£25 a month')
  })

  it('prints a German brand\'s price the German way', () => {
    expect(formatPrice(base, 'de')).toContain('19,99')
  })

  it('names an interval it does not have a phrase for', () => {
    expect(formatPrice({ ...base, interval: 'week' })).toBe('€19.99 per week')
  })

  it('says nothing about a trial the coach did not set', () => {
    expect(formatTrial(base)).toBe('')
    expect(formatTrial({ ...base, trialDays: 1 })).toBe('1 day free first')
    expect(formatTrial({ ...base, trialDays: 14 })).toBe('14 days free first')
  })
})
