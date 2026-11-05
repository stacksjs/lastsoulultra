import { expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { resolveSiteOrigin } from '../resources/data/site-origin'

it('normalizes one public origin and rejects values that cannot be origins', () => {
  expect(resolveSiteOrigin('www.lastsoulultra.com/')).toBe('https://www.lastsoulultra.com')
  expect(resolveSiteOrigin('https://published.example:8443/')).toBe('https://published.example:8443')
  expect(resolveSiteOrigin('lastsoulultra.localhost:3000')).toBe('http://lastsoulultra.localhost:3000')
  for (const value of ['https://published.example/coaching', 'https://published.example?draft=1', 'https://published.example#draft', 'https://user:password@published.example'])
    expect(() => resolveSiteOrigin(value)).toThrow()
})

it('keeps canonical, social, STX and crawler URLs together across production preview hosts', () => {
  const script = `
    import ui from './config/ui'
    import { siteOrigin, absolute } from './resources/data/site'
    import { publishedOrigin, robotsTxt, sitemapXml } from './scripts/seo'
    console.log(JSON.stringify({ ui: ui.site.url, siteOrigin, canonical: absolute('/coaching'), publishedOrigin, robots: robotsTxt(publishedOrigin), sitemap: sitemapXml(publishedOrigin, ['/coaching']) }))
  `
  for (const [configured, expected] of [[undefined, 'https://www.lastsoulultra.com'], ['https://published.example/', 'https://published.example']] as const) {
    const env = { ...process.env, NODE_ENV: 'production', APP_ENV: 'production', APP_URL: 'https://preview.example' }
    delete env.SITE_ORIGIN
    if (configured) env.SITE_ORIGIN = configured
    const result = spawnSync(process.execPath, ['--no-env-file', '--config=/dev/null', '-e', script], { cwd: process.cwd(), env, encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(0)
    const output = JSON.parse(result.stdout.trim().split('\n').at(-1)!)
    expect(output.ui).toBe(expected)
    expect(output.siteOrigin).toBe(expected)
    expect(output.publishedOrigin).toBe(expected)
    expect(output.canonical).toBe(`${expected}/coaching`)
    expect(output.robots).toContain(`Sitemap: ${expected}/sitemap.xml`)
    expect(output.sitemap).toContain(`<loc>${expected}/coaching</loc>`)
    expect(JSON.stringify(output)).not.toContain('preview.example')
  }
})
