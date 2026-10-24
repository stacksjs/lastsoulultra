/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { launch, waitFor } from '@stacksjs/testing/browser'

const browser = await launch()
const results = []
try {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await browser.cdp.send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: viewport.width < 600 })
    await browser.cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
    for (const [name, origin] of [['production', 'https://www.lastsoulultra.com'], ['preview', 'http://localhost:3942']]) {
      await browser.cdp.send('Page.navigate', { url: origin })
      await waitFor(() => browser.cdp.evaluate('document.readyState === "complete" && Boolean(document.querySelector("h1"))'), 30_000)
      await browser.cdp.evaluate('document.fonts.ready')
      const result = await browser.cdp.evaluate(`(() => {
        const heading = document.querySelector('h1')
        const resources = performance.getEntriesByType('resource')
        return { title: document.title, heading: heading.innerText, font: getComputedStyle(heading).fontFamily, font_size: getComputedStyle(heading).fontSize, background: getComputedStyle(document.body).backgroundColor,
          width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
          requests: resources.length, script_bytes: resources.filter(item => item.initiatorType === 'script').reduce((sum, item) => sum + item.decodedBodySize, 0),
          inline_script_bytes: [...document.scripts].filter(script => !script.src).reduce((sum, script) => sum + new TextEncoder().encode(script.textContent).length, 0),
          document_bytes: performance.getEntriesByType('navigation')[0]?.decodedBodySize || 0,
          resource_bytes: resources.reduce((sum, item) => sum + item.decodedBodySize, 0),
          image_bytes: resources.filter(item => item.initiatorType === 'img' || /[.](?:webp|avif|png|jpe?g)(?:[?]|$)/.test(item.name)).reduce((sum, item) => sum + item.decodedBodySize, 0),
          largest_images: resources.filter(item => /[.](?:webp|avif|png|jpe?g)(?:[?]|$)/.test(item.name)).map(item => ({ path: new URL(item.name).pathname, bytes: item.decodedBodySize })).sort((a, b) => b.bytes - a.bytes).slice(0, 6),
          broken_images: [...document.images].filter(image => image.complete && image.naturalWidth === 0).map(image => image.getAttribute('src')) }
      })()`)
      assert.equal(result.overflow, false, `${name} horizontal overflow at ${viewport.width}`)
      assert.deepEqual(result.broken_images, [], `${name} broken images`)
      results.push({ name, viewport, ...result })
      if (name === 'preview') {
        for (const selector of ['.lapscroll', '.duelscroll', '.attr-band', '.enter']) {
          await browser.cdp.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'center' })`)
          await waitFor(() => browser.cdp.evaluate(`document.querySelector(${JSON.stringify(selector)}).querySelector('h1,h2,h3,p').checkVisibility({ contentVisibilityAuto: true })`), 10_000)
        }
        const statement = viewport.width > 760 ? 'statement-1080.webp' : 'statement-720.webp'
        await waitFor(() => browser.cdp.evaluate(`performance.getEntriesByType('resource').some(item => item.name.endsWith(${JSON.stringify(statement)}) && item.responseEnd > 0)`), 10_000)
      }
    }
  }
  for (const width of [1280, 390]) {
    const [production, preview] = results.filter(result => result.viewport.width === width)
    assert.equal(preview.heading, production.heading)
    assert.equal(preview.font, production.font)
    assert.equal(preview.font_size, production.font_size)
    assert.ok(preview.document_bytes + preview.resource_bytes < production.document_bytes + production.resource_bytes, `Preview initial page bytes exceed production at ${width}px`)
  }
  await Bun.write('storage/browser-parity.json', `${JSON.stringify({ checked_at: new Date().toISOString(), results, console_errors: browser.cdp.errors }, null, 2)}\n`)
  console.log(JSON.stringify(results, null, 2))
}
finally { await browser.close() }
