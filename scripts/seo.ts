/**
 * Generate public/robots.txt and public/sitemap.xml from the one list of
 * indexable paths in resources/data/site.ts.
 *
 * These are static files because the views server serves `public/` at the root
 * while `routes/` is registered on the API site, which the gateway only sends
 * `/api/*` to - a route at `/sitemap.xml` would never be reachable.
 *
 * Generated rather than hand-written so the sitemap cannot quietly fall behind
 * the site. tests/seo.test.ts re-runs this in memory and fails if the
 * committed files differ, or if a view exists that nothing lists.
 *
 *   bun run scripts/seo.ts        # writes the files
 */

import { indexablePaths, siteOrigin } from '../resources/data/site'

/**
 * The origin the published files must name. `siteOrigin` follows APP_URL,
 * which in dev is the .localhost host - baking that into a committed sitemap
 * would publish URLs nobody can reach. Pass SITE_ORIGIN to regenerate for a
 * new domain; tests/seo.test.ts pins the committed files to this value, so a
 * domain move fails the test rather than shipping a stale sitemap.
 */
export const publishedOrigin: string = process.env.SITE_ORIGIN
  || (siteOrigin.includes('.localhost') ? 'https://lastsoulultra.hq.training' : siteOrigin)

export function robotsTxt(origin: string): string {
  return [
    '# Every page here is public and meant to be indexed.',
    'User-agent: *',
    'Allow: /',
    '',
    '# The live-board mirror is a JSON endpoint, not a page.',
    'Disallow: /api/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
}

export function sitemapXml(origin: string, paths: string[]): string {
  const urls = paths
    .map(path => `  <url>\n    <loc>${origin}${path}</loc>\n  </url>`)
    .join('\n')

  // No <lastmod>: the honest value would be the deploy time, which changes on
  // every unrelated deploy and teaches crawlers to ignore the field. No
  // <priority> or <changefreq> either - Google has ignored both for years.
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

if (import.meta.main) {
  const robots = robotsTxt(publishedOrigin)
  const sitemap = sitemapXml(publishedOrigin, indexablePaths)

  await Bun.write('public/robots.txt', robots)
  await Bun.write('public/sitemap.xml', sitemap)

  console.log(`wrote public/robots.txt and public/sitemap.xml`)
  console.log(`  origin : ${publishedOrigin}`)
  console.log(`  urls   : ${indexablePaths.length}`)
}
