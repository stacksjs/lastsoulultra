/** Public metadata belongs to the published site, independently of preview/API hosts. */
export function resolveSiteOrigin(value = process.env.SITE_ORIGIN): string {
  const raw = value?.trim() || 'https://www.lastsoulultra.com'
  const host = raw.split(':')[0] || ''
  const local = /(^|\.)localhost$|^127\.|^0\.0\.0\.0$/.test(host)
  const url = new URL(/^https?:\/\//.test(raw) ? raw : `${local ? 'http' : 'https'}://${raw}`)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw new Error('SITE_ORIGIN must be an HTTP(S) origin without credentials, a path, query or fragment')
  return url.origin
}

export const siteOrigin = resolveSiteOrigin()
