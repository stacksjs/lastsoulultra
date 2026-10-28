/* eslint-disable no-console */
/**
 * Lift a page's own module bundle out of its HTML.
 *
 * The build externalises the blobs that repeat across pages - the signals
 * runtime, the router, the generated stylesheet - and leaves a bundle that
 * only one page uses inline. That is the wrong way round for the biggest one
 * here: /world-series carries @ts-maps inline, 844 KB of minified JavaScript
 * in the first 1% of the document, which the browser must download and parse
 * before it paints anything below it, on every single visit, because an
 * inline script cannot be cached.
 *
 * Moving it to a file named by its contents makes it cacheable, lets the
 * document stream, and costs one request. `/_stx/modules.<hash>.js` is the
 * shape stx's own SPA router already recognises as a module bundle, so a
 * client-side navigation that fails to load it recovers the page rather than
 * running a setup that can only throw.
 *
 * The tag keeps its attributes and gains no defer or async: an inline script
 * runs at its position in document order, and so does an external one without
 * those, so execution order is unchanged.
 *
 *   bun run build   # runs this after ./buddy build
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'

const ROOT = 'dist'
const ASSET_DIR = join(ROOT, '_stx')
/** Below this, a request costs more than the bytes saved. */
const MIN_BYTES = 16 * 1024

if (!existsSync(ROOT)) {
  console.error(`${ROOT}/ does not exist. Run the build first.`)
  process.exit(1)
}

function pages(dir = ROOT): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '_stx' ? [] : pages(path)
    return entry.name.endsWith('.html') ? [path] : []
  })
}

/** The name stx's router matches as a module bundle: 16 hex characters. */
function bundleName(code: string): string {
  return `modules.${new Bun.CryptoHasher('sha256').update(code).digest('hex').slice(0, 16)}.js`
}

const written = new Map<string, number>()
let movedBytes = 0
let touchedPages = 0

for (const file of pages()) {
  const html = readFileSync(file, 'utf8')
  let changed = false

  const next = html.replace(
    /<script([^>]*\bdata-stx-modules\b[^>]*)>([\s\S]*?)<\/script>/gi,
    (whole, attrs: string, code: string) => {
      // Already a reference, or small enough to leave where it is.
      if (/\bsrc\s*=/i.test(attrs) || code.length < MIN_BYTES) return whole

      const name = bundleName(code)
      if (!written.has(name)) {
        mkdirSync(ASSET_DIR, { recursive: true })
        writeFileSync(join(ASSET_DIR, name), code)
        written.set(name, code.length)
      }
      changed = true
      movedBytes += code.length
      return `<script${attrs} src="/_stx/${name}"></script>`
    },
  )

  if (!changed) continue
  writeFileSync(file, next)
  touchedPages += 1
  console.log(`  ${relative(ROOT, file)}  ${(html.length / 1024).toFixed(0)}KB -> ${(next.length / 1024).toFixed(0)}KB`)
}

console.log(written.size === 0
  ? 'No page-local module bundle was large enough to externalize.'
  : `Externalized ${written.size} page module bundle(s) from ${touchedPages} page(s) (${(movedBytes / 1024).toFixed(1)}KB removed from HTML)`)
