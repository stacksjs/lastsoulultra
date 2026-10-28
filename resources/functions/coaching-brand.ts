/**
 * The published brand, read from HQ's one public endpoint.
 *
 * `GET {HQ}/api/brands/{slug}` is the only coaching endpoint this site may
 * call: everything else is account-scoped and its tokens never cross the
 * embedding boundary. What comes back is another service's JSON, so nothing
 * here trusts it. Every field is checked, anything unexpected drops the whole
 * payload, and a null brand renders the draft state rather than a half page.
 *
 * The published theme is deliberately NOT read. HQ applies it inside its own
 * frame, and this site's chrome is LSU's - black, #dd0f15, Anton over Barlow -
 * held in CSS where it cannot depend on a request completing. A site whose
 * palette arrives over the network paints unstyled when that network is slow.
 */

export interface CoachingProduct {
  id: number
  name: string
  description: string
  priceCents: number
  currency: string
  interval: string
  trialDays: number
}

export interface CoachingMethod {
  id: number
  name: string
  summary: string
  version: number
  /** Where a runner reaches this coach directly. Always absolute https. */
  contactUrl: string | null
}

export interface CoachingOffer {
  label: string
  method: CoachingMethod
  coach: string
  product: CoachingProduct
}

export interface CoachingBrand {
  slug: string
  name: string
  headline: string
  description: string
  /** 'en' or 'de'. HQ publishes no other locale. */
  locale: 'en' | 'de'
  /** HQ module keys the brand has enabled. */
  modules: string[]
  offers: CoachingOffer[]
  supportUrl: string | null
  privacyUrl: string | null
  termsUrl: string | null
}

function text(value: unknown, max = 400): string | null {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value.trim() : null
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

/**
 * An absolute http(s) URL, or null. A relative or javascript: URL from a
 * remote payload has no business reaching an href on this site.
 */
function link(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  }
  catch {
    return null
  }
}

/** ISO 4217, upper case. Anything else and the price is not printed. */
function currency(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : null
}

function parseOffer(raw: unknown): CoachingOffer | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, any>

  const label = text(row.label, 80)
  const methodName = text(row.method?.name, 120)
  const methodSummary = text(row.method?.summary, 600)
  const methodId = count(row.method?.id)
  const version = count(row.method?.version)
  const productId = count(row.product?.id)
  const productName = text(row.product?.name, 120)
  const priceCents = count(row.product?.price_cents)
  const unit = currency(row.product?.currency)
  const interval = text(row.product?.billing_interval, 16)

  if (label === null || methodName === null || methodSummary === null) return null
  if (methodId === null || version === null || productId === null) return null
  if (productName === null || priceCents === null || unit === null || interval === null) return null

  return {
    label,
    coach: text(row.coach?.name, 120) ?? 'The coach',
    method: { id: methodId, name: methodName, summary: methodSummary, version, contactUrl: link(row.method?.contact_url) },
    product: {
      id: productId,
      name: productName,
      description: text(row.product?.description, 600) ?? '',
      priceCents,
      currency: unit,
      interval,
      trialDays: count(row.product?.trial_days) ?? 0,
    },
  }
}

/**
 * The published brand, or null.
 *
 * Null covers every failure the same way on purpose: an unpublished brand, an
 * HQ that is down, and a payload this site does not recognise all mean the
 * same thing to a visitor, which is that there is nothing to buy yet.
 */
export function parseBrand(raw: unknown, expectedSlug: string): CoachingBrand | null {
  if (!raw || typeof raw !== 'object') return null
  const body = raw as Record<string, any>
  const settings = body.settings
  if (!settings || typeof settings !== 'object') return null

  // A payload for another brand is a misconfiguration, not content.
  if (body.slug !== expectedSlug) return null

  const name = text(settings.name, 120)
  const headline = text(settings.headline, 200)
  if (name === null || headline === null) return null

  const modules = Array.isArray(settings.modules)
    ? settings.modules.filter((value: unknown): value is string => typeof value === 'string' && /^[a-z]+$/.test(value))
    : []

  const offers = Array.isArray(body.offers)
    ? body.offers.map(parseOffer).filter((offer: CoachingOffer | null): offer is CoachingOffer => offer !== null)
    : []

  return {
    slug: expectedSlug,
    name,
    headline,
    description: text(settings.description, 600) ?? '',
    locale: settings.locale === 'de' ? 'de' : 'en',
    modules,
    offers,
    supportUrl: link(settings.support_url),
    privacyUrl: link(settings.privacy_url),
    termsUrl: link(settings.terms_url),
  }
}

/** The site renders in en-GB; a German brand prints German money. */
const LOCALES: Record<'en' | 'de', string> = { en: 'en-GB', de: 'de-DE' }

/** "€19.99 a month", from the coach's own product. This site sets no price. */
export function formatPrice(product: CoachingProduct, locale: 'en' | 'de' = 'en'): string {
  const amount = new Intl.NumberFormat(LOCALES[locale], {
    style: 'currency',
    currency: product.currency,
    // Whole prices read better without the trailing zeroes the race uses nowhere else.
    minimumFractionDigits: product.priceCents % 100 === 0 ? 0 : 2,
  }).format(product.priceCents / 100)

  const every = product.interval === 'month' ? 'a month' : product.interval === 'year' ? 'a year' : `per ${product.interval}`
  return `${amount} ${every}`
}

/** "14 days free first", or nothing at all when the coach set no trial. */
export function formatTrial(product: CoachingProduct): string {
  if (product.trialDays <= 0) return ''
  return product.trialDays === 1 ? '1 day free first' : `${product.trialDays} days free first`
}
