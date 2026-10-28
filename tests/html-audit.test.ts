import { describe, expect, it } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { processDirectives } from '@stacksjs/stx'
import { assetExists, assetUrls, attributeNames, auditPage, definedClasses, formatFindings, redirectSources, unstyledClasses } from '../scripts/audit-html'

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

/**
 * A rule whose pattern stopped matching reports nothing, which looks exactly
 * like a clean site. Each one is given a page it must complain about and a
 * page it must not.
 */
describe('each rule', () => {
  const served = new Set(['/', '/format'])

  function rules(html: string): string[] {
    const page = `<!DOCTYPE html><html lang="en"><head><title>t</title><meta name="description" content="A description long enough to count as one."><link rel="canonical" href="https://example.test/"></head><body><h1>One</h1>${html}</body></html>`
    return auditPage('/t', page, served).map(finding => finding.rule)
  }

  it('catches a link to a page that is not served', () => {
    expect(rules('<a href="/gone">gone</a>')).toContain('dead-link')
    expect(rules('<a href="/format">here</a>')).not.toContain('dead-link')
    expect(rules('<a href="/assets/x.css">asset</a>')).not.toContain('dead-link')
  })

  it('catches an image with no alt', () => {
    expect(rules('<img src="/a.png">')).toContain('img-no-alt')
    expect(rules('<img src="/a.png" alt="">')).not.toContain('img-no-alt')
  })

  it('catches two elements sharing an id', () => {
    expect(rules('<p id="x"></p><p id="x"></p>')).toContain('duplicate-id')
    expect(rules('<p id="x"></p><p id="y"></p>')).not.toContain('duplicate-id')
  })

  it('catches a skipped heading level and a second h1', () => {
    expect(rules('<h3>skip</h3>')).toContain('heading-skip')
    expect(rules('<h2>fine</h2><h3>fine</h3>')).not.toContain('heading-skip')
    expect(rules('<h1>two</h1>')).toContain('h1-count')
  })

  it('catches a link with nothing to announce', () => {
    expect(rules('<a href="/format"><span class="icon"></span></a>')).toContain('link-no-name')
    expect(rules('<a href="/format" aria-label="Home"><span></span></a>')).not.toContain('link-no-name')
    expect(rules('<a href="/format"><img src="/a.png" alt="Home"></a>')).not.toContain('link-no-name')
  })

  it('catches a new tab the opener can be steered from', () => {
    expect(rules('<a href="/format" target="_blank">x</a>')).toContain('blank-no-noopener')
    expect(rules('<a href="/format" target="_blank" rel="noopener">x</a>')).not.toContain('blank-no-noopener')
  })

  it('catches an outbound link over plain HTTP, but not the local preview', () => {
    expect(rules('<a href="http://hq.training/x">x</a>')).toContain('insecure-link')
    expect(rules('<a href="http://localhost:3940/x">x</a>')).not.toContain('insecure-link')
    expect(rules('<a href="https://hq.training/x">x</a>')).not.toContain('insecure-link')
  })

  it('catches a control with no label, in any of the four ways of giving it one', () => {
    expect(rules('<input name="email">')).toContain('control-no-label')
    expect(rules('<label>Email<input name="email"></label>')).not.toContain('control-no-label')
    expect(rules('<label for="e">Email</label><input id="e" name="email">')).not.toContain('control-no-label')
    expect(rules('<input name="email" aria-label="Email">')).not.toContain('control-no-label')
    expect(rules('<input type="hidden" name="token">')).not.toContain('control-no-label')
  })

  it('catches a button with no name, and allows one whose text is bound', () => {
    expect(rules('<button type="submit"></button>')).toContain('button-no-name')
    expect(rules('<button :text="label"></button>')).not.toContain('button-no-name')
    expect(rules('<button aria-label="Close">×</button>')).not.toContain('button-no-name')
  })

  it('catches a page that does not say what it is', () => {
    const bare = auditPage('/t', '<!DOCTYPE html><html lang="en"><body><h1>x</h1></body></html>', served).map(f => f.rule)
    expect(bare).toContain('no-description')
    expect(bare).toContain('no-canonical')
    expect(rules('')).not.toContain('no-description')
    expect(rules('')).not.toContain('no-canonical')
  })

  it('catches an asset the deploy does not carry', () => {
    expect(rules('<img src="/assets/lsu/images/nope.png" alt="x">')).toContain('missing-asset')
    expect(rules('<img src="/assets/lsu/images/lsu-logo.svg" alt="x">')).not.toContain('missing-asset')
  })

  it('reads a srcset candidate and a CSS url, not only src', () => {
    expect(assetUrls('<img srcset="/a.png 1x, /b.png 2x">')).toEqual(['/a.png', '/b.png'])
    expect(assetUrls('<div style="background-image:url(\'/c.webp\')">')).toEqual(['/c.webp'])
    expect(rules('<div style="background-image:url(/assets/lsu/images/nope.webp)"></div>')).toContain('missing-asset')
  })

  it('catches the same attribute written twice on one tag', () => {
    expect(rules('<div tabindex="0" data-track tabindex="0"></div>')).toContain('duplicate-attribute')
    expect(rules('<div tabindex="0" data-track></div>')).not.toContain('duplicate-attribute')
  })

  it('does not read an attribute name out of a value', () => {
    // An stx binding mentions its own state names inside the quoted value.
    const binding = `<button :text="mode === 'new' ? a : mode === 'old' ? b : c" :disabled="busy"></button>`
    expect(rules(binding)).not.toContain('duplicate-attribute')

    expect(attributeNames(` :text="mode === 'new'" :disabled="busy" data-x`))
      .toEqual([':text', ':disabled', 'data-x'])
    expect(attributeNames(` a=1 b='two words' c`)).toEqual(['a', 'b', 'c'])
  })

  it('catches a page with no language', () => {
    expect(auditPage('/t', '<html><body><h1>x</h1></body></html>', served).map(f => f.rule)).toContain('no-lang')
    expect(rules('')).not.toContain('no-lang')
  })
})

describe('classes the markup uses and no stylesheet defines', () => {
  const sheets = readdirSync('resources/assets/styles/site')
    .filter(name => name.endsWith('.css'))
    .map(name => join('resources/assets/styles/site', name))
  const defined = definedClasses(sheets)

  it('reads the real sheets, not an empty set', () => {
    expect(defined.size).toBeGreaterThan(300)
    expect(defined.has('kicker')).toBe(true)
    expect(defined.has('h3')).toBe(true)
  })

  it('names a class nothing defines', () => {
    const findings = unstyledClasses('/t', '<p class="kicker made-up-class">x</p>', defined)
    expect(findings.map(finding => finding.detail)).toEqual(['made-up-class'])
  })

  it('names it once however often it appears', () => {
    const html = '<p class="made-up-class"></p><p class="made-up-class"></p>'
    expect(unstyledClasses('/t', html, defined)).toHaveLength(1)
  })

  it('ignores the scope and wrapper names stx writes per render', () => {
    const html = '<p class="lsu-sz7xmlte stx_race_portal_2_1r3g0n"></p>'
    expect(unstyledClasses('/t', html, defined)).toEqual([])
  })

  it('allows the hooks that are on the ratchet, and nothing else', () => {
    expect(unstyledClasses('/t', '<div class="race-board"></div>', defined)).toEqual([])
    expect(unstyledClasses('/t', '<div class="race-boardx"></div>', defined)).toHaveLength(1)
  })

  it('does not look inside a script', () => {
    expect(unstyledClasses('/t', '<script>el.className = "made-up-class"</script>', defined)).toEqual([])
  })
})
