import { afterEach, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { documentationLinkAudit } from '../scripts/audit-doc-links'

const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

async function guide() {
  const root = await mkdtemp(join(tmpdir(), 'lsu-doc-links-'))
  directories.push(root)
  await mkdir(join(root, 'training'), { recursive: true })
  await Bun.write(join(root, 'training/index.html'), '<h1 id="weekly-review">Weekly review</h1>')
  await Bun.write(join(root, 'logo.svg'), '<svg></svg>')
  return { root, check: documentationLinkAudit(root), page: join(root, 'index.html') }
}

it('accepts mounted pages, relative assets and existing heading fragments', async () => {
  const { page, check } = await guide()
  const html = '<h1 id="start">Start</h1><a href="#start">Here</a><a href="/docs/training/#weekly-review">Review</a><img src="./logo.svg"><script>const example = \'href="/not-a-link"\'</script>'
  await Bun.write(page, html)
  expect(await check(page, html)).toEqual([])
})

it('rejects missing headings and relative files even when the page exists', async () => {
  const { page, check } = await guide()
  const errors = await check(page, '<a href="/docs/training/#old-title">Old section</a><img src="./missing.svg">')
  expect(errors).toEqual(['missing linked heading or anchor: /docs/training/#old-title', 'missing linked artifact: ./missing.svg'])
})

it('permits application navigation in specimens while checking their assets', async () => {
  const { page, check } = await guide()
  const html = '<a href="/world-series">Series</a><img src="/missing.svg">'
  expect(await check(page, html, true)).toEqual(['link escapes docs mount: /missing.svg'])
  expect(await check(page, html)).toContain('link escapes docs mount: /world-series')
})
