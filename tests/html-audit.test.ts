import { describe, expect, it } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { processDirectives } from '@stacksjs/stx'
import { auditPage, formatFindings, redirectSources } from '../scripts/audit-html'

/**
 * The same rules scripts/audit-html.ts runs over dist, run here over the
 * rendered views so a regression fails the suite rather than waiting for
 * somebody to build and remember to check.
 *
 * One gap worth knowing: component resolution here is not the build's.
 * `<dialog>` on /soul-races resolves through the @stacksjs/components bun
 * plugin at build time and renders as nothing in this pass, so what is inside
 * that dialog is checked by the script against dist rather than here.
 */

function viewFiles(dir = 'resources/views', prefix = ''): { url: string, file: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory())
      return viewFiles(join(dir, entry.name), `${prefix}/${entry.name}`)
    if (!entry.name.endsWith('.stx'))
      return []
    const name = entry.name.slice(0, -'.stx'.length)
    return [{ url: name === 'index' && prefix === '' ? '/' : `${prefix}/${name}`, file: join(dir, entry.name) }]
  })
}

const views = viewFiles()
const served = new Set([...views.map(view => view.url), ...redirectSources()])

async function render(file: string): Promise<string> {
  const path = resolve(file)
  return processDirectives(await Bun.file(path).text(), {}, path, {
    enabled: true,
    cache: false,
    componentsDir: resolve('resources/components'),
    layoutsDir: resolve('resources/layouts'),
    partialsDir: resolve('resources/partials'),
  }, new Set())
}

describe('every page the site serves', () => {
  it('has no dead internal link, duplicate id, skipped heading or unnamed link', async () => {
    const findings = (await Promise.all(views.map(async view => auditPage(view.url, await render(view.file), served)))).flat()

    expect(formatFindings(findings)).toBe('')
  }, 120_000)

  it('checks every view, not a handful', () => {
    expect(views.length).toBeGreaterThanOrEqual(23)
    expect(views.map(view => view.url)).toContain('/coaching/feedback')
  })
})
