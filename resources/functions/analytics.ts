/**
 * Google Analytics, only after the reader says yes.
 *
 * The answer lives in localStorage rather than a cookie, as the privacy
 * notice says: clearing site data asks again. Nothing is requested from
 * Google until consent is granted, and Consent Mode starts every signal
 * denied, granting analytics storage alone. Local hosts never load the tag,
 * so development and previews do not count as visits.
 */

const KEY = 'lsu-consent'

export type Consent = 'granted' | 'denied'

export function storedConsent(): Consent | null {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'granted' || value === 'denied' ? value : null
  }
  catch {
    return null
  }
}

export function rememberConsent(value: Consent): void {
  try {
    localStorage.setItem(KEY, value)
  }
  catch {}
}

let loaded = false

export function loadAnalytics(id: string | undefined): void {
  if (loaded || !id || typeof document === 'undefined') return
  const host = location.hostname
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.test') || /^127\.|^\[?::1\]?$/.test(host)) return
  loaded = true
  const w = window as unknown as { dataLayer: unknown[], gtag: (...args: unknown[]) => void }
  w.dataLayer = w.dataLayer || []
  // gtag reads the arguments object itself, so this must stay a function expression.
  // eslint-disable-next-line prefer-rest-params
  w.gtag = function gtag() { w.dataLayer.push(arguments) }
  w.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' })
  w.gtag('consent', 'update', { analytics_storage: 'granted' })
  w.gtag('js', new Date())
  w.gtag('config', id, { anonymize_ip: true })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  document.head.appendChild(script)
}
