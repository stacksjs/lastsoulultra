/* eslint-disable no-console */
/** Compare the built STX pages with the current public site, without executing either site's scripts. */
import { productionPages } from '../resources/data/production-pages'

async function headings(html: string, selector = 'h1, h2, h3') {
  const values: string[] = []
  let text = ''
  await new HTMLRewriter().on(selector, {
    element(element) { text = ''; element.onEndTag(() => values.push(text.replace(/\s+/g, ' ').trim())) },
    text(chunk) { text += chunk.text },
  }).transform(new Response(html)).text()
  return values.filter(Boolean)
}
const report = []
for (const path of Object.keys(productionPages).filter(path => !['/lottery', '/profile', '/404', '/coaching'].includes(path))) {
  const file = Bun.file(`dist/${path === '/' ? 'index' : path.slice(1)}.html`)
  const response = await fetch(`https://www.lastsoulultra.com${path}`)
  if (!response.ok || !await file.exists()) throw new Error(`Unable to compare ${path}`)
  const remoteHtml = await response.text()
  const localHtml = await file.text()
  const remote = await headings(remoteHtml)
  const local = await headings(localHtml)
  // The preview loads no Google Analytics, so it must not claim otherwise in a copied consent banner.
  const remoteParagraphs = await headings(remoteHtml, 'p:not(.consent-copy)')
  const localParagraphs = await headings(localHtml, 'p:not(.consent-copy)')
  if (!remote.length || !local.length) throw new Error(`No headings found on ${path}; the comparison cannot pass without content.`)
  const missing = remote.filter(value => !local.includes(value))
  report.push({ path, production_headings: remote.length, matched_headings: remote.length - missing.length, missing, additional: local.filter(value => !remote.includes(value)), production_paragraphs: remoteParagraphs.length, missing_paragraphs: remoteParagraphs.filter(value => !localParagraphs.includes(value)) })
}
await Bun.write('storage/production-parity.json', `${JSON.stringify({ checked_at: new Date().toISOString(), source: 'https://www.lastsoulultra.com', excluded: 'Google Analytics consent copy: this preview does not load Google Analytics.', pages: report }, null, 2)}\n`)
for (const page of report) console.log(`${page.path}: ${page.matched_headings}/${page.production_headings} headings match; ${page.production_paragraphs - page.missing_paragraphs.length}/${page.production_paragraphs} paragraphs match${page.missing.length ? `; missing ${JSON.stringify(page.missing)}` : ''}`)
if (report.some(page => page.missing.length || page.missing_paragraphs.length)) process.exitCode = 1
