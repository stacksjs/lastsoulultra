/* eslint-disable no-console */
/**
 * Audit the built site for the mistakes a template cannot catch itself.
 *
 * A page renders perfectly well with a link to a page that was renamed, two
 * elements sharing an id, an h3 under an h1, or an image whose alt was never
 * written. Nothing errors, nothing fails to build, and nobody notices until
 * somebody using a screen reader or a keyboard does.
 *
 *   bun run build && bun scripts/audit-html.ts
 *
 * Reads dist/, so it checks what is actually deployed rather than what the
 * source says should be. Exits non-zero on any finding.
 */

import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'
import server from '../config/server'

const ROOT = 'dist'

interface Finding {
  page: string
  rule: string
  detail: string
}

function pages(dir = ROOT): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name.startsWith('_') ? [] : pages(path)
    return entry.name.endsWith('.html') ? [path] : []
  })
}

/** The URL a built file is served at. */
function urlOf(file: string): string {
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

const built = new Set(pages().map(urlOf))
const redirected = new Set(Object.keys(server.redirects ?? {}))
const findings: Finding[] = []

for (const file of pages()) {
  const page = urlOf(file)
  const raw = await Bun.file(file).text()
  const body = visible(raw)

  // 1. Internal links point at something this build serves.
  for (const [, href] of raw.matchAll(/<a\b[^>]*\shref="(\/[^"#?]*)[^"]*"/gi)) {
    const target = href!.length > 1 ? href!.replace(/\/$/, '') : href!
    if (built.has(target) || redirected.has(target)) continue
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
  for (const [match, tag, inner] of body.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/gi)) {
    void match
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
}

const byRule = new Map<string, Finding[]>()
for (const finding of findings) {
  if (!byRule.has(finding.rule)) byRule.set(finding.rule, [])
  byRule.get(finding.rule)!.push(finding)
}

console.log(`audited ${built.size} pages`)
for (const [rule, rows] of [...byRule].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${rule} (${rows.length})`)
  for (const row of rows.slice(0, 12)) console.log(`  ${row.page}  ${row.detail}`)
  if (rows.length > 12) console.log(`  ... ${rows.length - 12} more`)
}
if (findings.length === 0) console.log('\nno findings')
process.exit(findings.length === 0 ? 0 : 1)
