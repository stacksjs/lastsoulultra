/* eslint-disable no-console */
/**
 * The mistakes a template cannot catch about itself.
 *
 * A page renders perfectly well with a link to a page that was renamed, two
 * elements sharing an id, an h3 under an h1, a link whose only content is an
 * icon, or an image whose alt was never written. Nothing errors and nothing
 * fails to build; it is noticed by the first person using a keyboard or a
 * screen reader, which is to say not by us.
 *
 * The rules live here and run twice. tests/html-audit.test.ts applies them to
 * the rendered views, so the suite catches a regression with no build; this
 * script applies them to dist, so a release can be checked against what was
 * actually produced rather than what the source implies:
 *
 *   bun run build && bun run audit:html
 *
 * Exits non-zero on any finding.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'
import server from '../config/server'

const ROOT = 'dist'

export interface Finding {
  page: string
  rule: string
  detail: string
}

/** Built pages, depth first. `_`-prefixed directories are build internals. */
export function builtPages(dir: string = ROOT): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name.startsWith('_') ? [] : builtPages(path)
    return entry.name.endsWith('.html') ? [path] : []
  })
}

/** The URL a built file is served at. */
export function urlOf(file: string): string {
  const path = `/${relative(ROOT, file).replace(/\.html$/, '')}`
  return path === '/index' ? '/' : path
}

/** Strip comments, script and style so their contents are not read as markup. */
function visible(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
}

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag)
    ?? new RegExp(`\\s${name}\\s*=\\s*'([^']*)'`, 'i').exec(tag)
  if (match) return match[1]!
  return new RegExp(`\\s${name}(?=[\\s/>])`, 'i').test(tag) ? '' : null
}

/** Every URL the deployed site answers, which is what a link may point at. */
export function redirectSources(): string[] {
  return Object.keys(server.redirects ?? {})
}

/**
 * Whether a referenced asset is on disk. `public/` is the source of truth and
 * `dist/` holds what a build also generated, so both count.
 */
const assetSeen = new Map<string, boolean>()
export function assetExists(url: string): boolean {
  const path = url.split(/[?#]/)[0]!.replace(/^\/+/, '')
  if (!assetSeen.has(path))
    assetSeen.set(path, existsSync(join('public', path)) || existsSync(join(ROOT, path)))
  return assetSeen.get(path)!
}

/** Every site-absolute asset URL a page names, srcset entries included. */
export function assetUrls(html: string): string[] {
  const urls = [
    ...[...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/gi)].map(match => match[1]!),
    ...[...html.matchAll(/url\((['"]?)(\/[^)'"]+)\1\)/gi)].map(match => match[2]!),
  ]
  for (const [, set] of html.matchAll(/srcset="([^"]+)"/gi)) {
    for (const candidate of set!.split(',')) {
      const url = candidate.trim().split(/\s+/)[0]
      if (url?.startsWith('/')) urls.push(url)
    }
  }
  return [...new Set(urls)]
}

/** The rules, over one page. */
export function auditPage(page: string, raw: string, served: Set<string>): Finding[] {
  const findings: Finding[] = []
  const body = visible(raw)

  // 1. Internal links point at something this site serves.
  for (const [, href] of raw.matchAll(/<a\b[^>]*\shref="(\/[^"#?]*)[^"]*"/gi)) {
    const target = href!.length > 1 ? href!.replace(/\/$/, '') : href!
    if (served.has(target)) continue
    // Assets are files on disk rather than pages.
    if (/\.[a-z0-9]{2,5}$/i.test(target) || target.startsWith('/assets/')) continue
    findings.push({ page, rule: 'dead-link', detail: target })
  }

  // 2. Every image says what it shows, or declares itself decorative.
  for (const [tag] of body.matchAll(/<img\b[^>]*>/gi)) {
    if (attr(tag, 'alt') === null)
      findings.push({ page, rule: 'img-no-alt', detail: attr(tag, 'src') ?? tag.slice(0, 60) })
  }

  // 3. One id, one element.
  const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]!)
  for (const id of new Set(ids)) {
    if (ids.filter(value => value === id).length > 1)
      findings.push({ page, rule: 'duplicate-id', detail: id })
  }

  // 4. One h1, and no level skipped on the way down.
  const levels = [...body.matchAll(/<h([1-6])\b/gi)].map(match => Number(match[1]))
  const h1s = levels.filter(level => level === 1).length
  if (h1s !== 1)
    findings.push({ page, rule: 'h1-count', detail: String(h1s) })
  for (let index = 1; index < levels.length; index++) {
    if (levels[index]! - levels[index - 1]! > 1)
      findings.push({ page, rule: 'heading-skip', detail: `h${levels[index - 1]} to h${levels[index]}` })
  }

  // 5. A link a screen reader can announce.
  for (const [, tag, inner] of body.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/gi)) {
    const text = inner!.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim()
    if (text) continue
    if (attr(tag!, 'aria-label') || attr(tag!, 'title')) continue
    if (/<img\b[^>]*\salt="[^"]+"/i.test(inner!)) continue
    if (attr(tag!, 'aria-hidden') === 'true') continue
    findings.push({ page, rule: 'link-no-name', detail: attr(tag!, 'href') ?? '' })
  }

  // 6. A document that states its language.
  if (!/<html\b[^>]*\slang="[^"]+"/i.test(raw))
    findings.push({ page, rule: 'no-lang', detail: '' })

  // 7. A new tab the opener cannot be steered from. Without rel=noopener the
  //    opened page gets window.opener and can navigate this one elsewhere.
  for (const [tag] of body.matchAll(/<a\b[^>]*>/gi)) {
    if (attr(tag, 'target') !== '_blank') continue
    if ((attr(tag, 'rel') ?? '').split(/\s+/).includes('noopener')) continue
    findings.push({ page, rule: 'blank-no-noopener', detail: attr(tag, 'href') ?? '' })
  }

  // 8. An outbound link over plain HTTP, which a network between the reader
  //    and the host can read and rewrite. Loopback is the local preview.
  for (const [, href] of body.matchAll(/<a\b[^>]*\shref="(http:\/\/[^"]+)"/gi)) {
    const host = new URL(href!).hostname
    if (host === 'localhost' || host === '127.0.0.1') continue
    findings.push({ page, rule: 'insecure-link', detail: href! })
  }

  // 9. A control a screen reader can announce: an explicit label, an ARIA
  //    name, or the <label> it sits inside.
  for (const match of body.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const tag = match[0]
    const type = attr(tag, 'type') ?? ''
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue
    if (attr(tag, 'aria-label') || attr(tag, 'aria-labelledby') || attr(tag, 'title')) continue
    const id = attr(tag, 'id')
    if (id && new RegExp(`<label\\b[^>]*\\sfor="${id}"`, 'i').test(body)) continue
    // Wrapped in a label: the nearest <label> before it is still open.
    const before = body.slice(0, match.index)
    const opened = before.lastIndexOf('<label')
    if (opened !== -1 && !before.slice(opened).includes('</label>')) continue
    findings.push({ page, rule: 'control-no-label', detail: `${match[1]} ${attr(tag, 'name') ?? type}` })
  }

  // 10. A button with a name. Text bound at runtime counts: the markup is
  //     empty on purpose and the binding fills it.
  for (const [, tag, inner] of body.matchAll(/(<button\b[^>]*>)([\s\S]*?)<\/button>/gi)) {
    if (inner!.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim()) continue
    if (attr(tag!, 'aria-label') || attr(tag!, 'title')) continue
    if (/\s(?::text|x-text)=/i.test(tag!)) continue
    if (/<img\b[^>]*\salt="[^"]+"/i.test(inner!)) continue
    findings.push({ page, rule: 'button-no-name', detail: tag!.slice(0, 60) })
  }

  // 11. What the page says it is, for a search engine and a share sheet.
  if (!/<meta name="description" content="[^"]{20,}"/i.test(raw))
    findings.push({ page, rule: 'no-description', detail: '' })
  const canonical = /<link rel="canonical" href="([^"]+)"/i.exec(raw)?.[1]
  if (!canonical || !canonical.startsWith('http'))
    findings.push({ page, rule: 'no-canonical', detail: canonical ?? '' })

  // 12. An asset the page names and the deploy does not carry. A stylesheet,
  //     a font or a photograph that 404s is silent: the page still renders,
  //     just without it, and nothing in a build log says so.
  for (const url of assetUrls(raw)) {
    if (!assetExists(url))
      findings.push({ page, rule: 'missing-asset', detail: url })
  }

  return findings
}

/**
 * Class names the markup uses that no stylesheet defines.
 *
 * This is how /lottery's entry steps and open events, /404's whole heading
 * block and the results tables' .h3 were found: markup written against a
 * design system that was never shipped renders as unstyled body text, and
 * nothing errors. Read against the BUILT css, so the generated utilities
 * count as defined.
 *
 * The allowlist is a ratchet, not an exemption: it stops the set growing
 * while leaving what is already there visible. Every entry was opened in a
 * browser and checked to render correctly, with the note saying what carries
 * the styling instead - an unverified allowlist is how the next one of these
 * gets waved through.
 */
const UNSTYLED_ALLOWED = new Set([
  // Hooks with nothing of their own to paint: a sibling class or a child
  // carries the look. .seg-count and .enter-count wrap a .seg segment
  // display, .lap-link also carries .btn, .ls-cmp-yr is painted by a rule on
  // .ls-cmp-row, and .race-board and .carousel are scripting targets.
  'race-board', 'lap-link', 'carousel', 'seg-count', 'enter-count', 'ls-cmp-yr',
  // State modifiers the design does not act on: on /world-series the open
  // event is told apart by its red entry button against the others' "coming
  // soon" pill, not by the list item around it.
  'ws-soon', 'ws-apply',
  // Blocks whose typography comes from what is around them: the three leads
  // from .phero, .tiers-title from .h2 beside it, .begin-band from .band,
  // and .edon-l is a caption under a stat rather than a label.
  'sr-lead', 'ws-lead', 'tiers-title', 'begin-band', 'edon-l',
  // Utilities inside @stacksjs/components' Dialog, generated from that
  // package's own source rather than from this app's markup.
  'bg-black/25', 'dark:bg-black/50',
])

/** Every class name any shipped stylesheet keys a rule on. */
export function definedClasses(files: string[]): Set<string> {
  const names = new Set<string>()
  for (const file of files) {
    for (const [, name] of readFileSync(file, 'utf8').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g))
      names.add(name!)
  }
  return names
}

export function unstyledClasses(page: string, raw: string, defined: Set<string>): Finding[] {
  const findings: Finding[] = []
  const body = visible(raw)
  const seen = new Set<string>()
  for (const [, value] of body.matchAll(/\sclass="([^"]+)"/g)) {
    for (const name of value!.split(/\s+/)) {
      // stx writes a scope class per render and a wrapper id per component.
      if (!name || name.startsWith('lsu-sz') || name.startsWith('stx_')) continue
      if (defined.has(name) || UNSTYLED_ALLOWED.has(name) || seen.has(name)) continue
      seen.add(name)
      findings.push({ page, rule: 'unstyled-class', detail: name })
    }
  }
  return findings
}

/** Findings grouped by rule, for a terminal. */
export function formatFindings(findings: Finding[]): string {
  const byRule = new Map<string, Finding[]>()
  for (const finding of findings) {
    if (!byRule.has(finding.rule)) byRule.set(finding.rule, [])
    byRule.get(finding.rule)!.push(finding)
  }

  return [...byRule]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([rule, rows]) => [
      `${rule} (${rows.length})`,
      ...rows.slice(0, 12).map(row => `  ${row.page}  ${row.detail}`),
      ...(rows.length > 12 ? [`  ... ${rows.length - 12} more`] : []),
    ].join('\n'))
    .join('\n\n')
}

if (import.meta.main) {
  const files = builtPages()
  const served = new Set([...files.map(urlOf), ...redirectSources()])
  const styles = [...new Bun.Glob('**/*.css').scanSync({ cwd: ROOT, absolute: true })]
  const defined = definedClasses(styles)
  const findings = files.flatMap((file) => {
    const html = readFileSync(file, 'utf8')
    return [...auditPage(urlOf(file), html, served), ...unstyledClasses(urlOf(file), html, defined)]
  })

  console.log(`audited ${files.length} pages`)
  console.log(findings.length === 0 ? '\nno findings' : `\n${formatFindings(findings)}`)
  process.exit(findings.length === 0 ? 0 : 1)
}
