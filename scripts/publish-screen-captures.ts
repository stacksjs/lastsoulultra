/** Publish only this explicitly reviewed selection, retaining its source and image hashes. */
import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import source from '../native/hq-source.json'
import { assertReviewSource } from './screenshot-support'

const selection = [
  { id: 'training-home', role: 'runner', viewport: 'mobile', title: 'Start with Today', caption: 'The signed-in runner sees today’s work and available recovery context. This is a phone-width web rendering.', guide: '/getting-started' },
  { id: 'training-week', role: 'runner', viewport: 'mobile', title: 'Read the training week', caption: 'The week puts running and supporting work in date order. Assignment, completion and next-week release are different states.', guide: '/training/plans' },
  { id: 'training-coaching-brand-section', role: 'runner', viewport: 'mobile', title: 'Keep feedback with the subscription', caption: 'The LSU portal’s feedback section is the place for weekly subscription feedback. It is separate from a personal coach conversation.', guide: '/training/feedback' },
  { id: 'onboarding-goals', role: 'runner', viewport: 'mobile', title: 'Choose training goals', caption: 'A browser-only synthetic setup state explains the choice without changing the shared account’s saved tour progress.', guide: '/onboarding' },
  { id: 'onboarding-safety', role: 'runner', viewport: 'mobile', title: 'Make the safety choice yourself', caption: 'The two confirmations remain unsubmitted in this fixture. Capturing the screen does not accept a consent.', guide: '/onboarding' },
  { id: 'training-home', role: 'runner', viewport: 'desktop', title: 'The desktop view', caption: 'The same account has more room for training and recovery context on desktop. Navigation differs from the installed iPhone app.', guide: '/getting-started' },
]
interface Published { id: string, role: string, viewport: string, title: string, caption: string, guide: string, file: string, sha256: string, width: number, height: number }
interface Manifest { format: 1, publishedAt: string, source: { version: string, revision: string }, captures: Published[] }
const directory = resolve('docs/public/screens')
const manifestFile = resolve(directory, 'reviewed.json')
const pageFile = resolve('docs/screens/captures.md')
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
function page(manifest: Manifest): string {
  return `---\ntitle: Screen walkthroughs\ndescription: Reviewed desktop and phone examples from synthetic LSU accounts, with their source snapshot.\n---\n\n# Screen walkthroughs\n\nThese are real browser captures of synthetic review accounts, published on ${manifest.publishedAt.slice(0, 10)} from HQ kit ${manifest.source.version}. Sample dates and values can change. A phone-width browser capture demonstrates web layout; native gestures, permissions and hardware still need an installed-app check.\n\n${manifest.captures.map(item => `## ${item.title}\n\n${item.caption}\n\n<figure class="guide-figure">\n  <img src="/docs/screens/${item.file}" alt="${item.title}" width="${item.width}" height="${item.height}" loading="lazy" style="display:block;max-width:${Math.min(item.width, 900)}px;width:100%;height:auto;margin-inline:auto">\n  <figcaption><a href="${item.guide}">Read the workflow</a>. Review profile: ${item.role}. Viewport: ${item.width} by ${item.height} pixels.</figcaption>\n</figure>\n`).join('\n')}[Return to the screen atlas](/screens/)\n`
}
if (process.argv.includes('--check')) {
  if (!await Bun.file(manifestFile).exists()) {
    if (await Bun.file(pageFile).exists()) throw new Error('The screen walkthrough needs its reviewed image manifest')
    console.log('No curated capture gallery has been published yet.')
  }
  else {
    const manifest = await Bun.file(manifestFile).json() as Manifest
    if (manifest.format !== 1 || manifest.captures.length !== selection.length || new Set(manifest.captures.map(item => `${item.id}/${item.role}/${item.viewport}`)).size !== selection.length) throw new Error('Invalid reviewed capture selection')
    for (const item of manifest.captures) {
      if (!selection.some(chosen => chosen.id === item.id && chosen.role === item.role && chosen.viewport === item.viewport) || item.file !== `${item.id}-${item.viewport}.png`) throw new Error('Unknown published capture')
      if (hash(await readFile(resolve(directory, item.file))) !== item.sha256) throw new Error(`Published capture changed: ${item.file}`)
    }
    if (await Bun.file(pageFile).text() !== page(manifest)) throw new Error('Stale screen walkthrough prose')
    console.log(`Verified ${manifest.captures.length} reviewed screen images and their walkthrough.`)
  }
}
else {
  const { captureScreenshots } = await import('@stacksjs/docs/screenshots')
  const current = await captureScreenshots({ config: 'config/screenshots.training.ts', list: true })
  const root = await realpath(resolve('storage/runtime/docs-screen-captures/training'))
  const report = await Bun.file(resolve(root, 'manifest.json')).json()
  if (report.configHash !== current.configHash) throw new Error('The selected captures must match the current capture configuration and source inputs')
  await assertReviewSource(process.env.LSU_SCREENSHOT_TRAINING_ORIGIN || 'https://training.lsu.stacksjs.com')
  const captures: Published[] = []
  await mkdir(directory, { recursive: true })
  for (const item of selection) {
    const row = report.results.find((row: any) => row.id === item.id && row.profile === item.role && row.viewport.name === item.viewport)
    const expected = `${item.id}/${item.role}-${item.viewport}.png`
    if (row?.status !== 'captured' || row.file !== expected) throw new Error(`Capture must pass before publication: ${expected}`)
    const input = resolve(root, expected)
    if ((await lstat(input)).isSymbolicLink() || !(await realpath(input)).startsWith(root + sep)) throw new Error('Capture must stay within its owned directory')
    const bytes = await readFile(input)
    if (hash(bytes) !== row.sha256 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.readUInt32BE(16) !== row.viewport.width || bytes.readUInt32BE(20) !== row.viewport.height) throw new Error(`Invalid captured PNG: ${expected}`)
    const file = `${item.id}-${item.viewport}.png`
    await writeFile(resolve(directory, file), bytes)
    captures.push({ ...item, file, sha256: row.sha256, width: row.viewport.width, height: row.viewport.height })
  }
  const manifest: Manifest = { format: 1, publishedAt: new Date().toISOString(), source: { version: source.version, revision: source.revision }, captures }
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n')
  await writeFile(pageFile, page(manifest))
  console.log(`Published ${captures.length} explicitly reviewed captures.`)
}
