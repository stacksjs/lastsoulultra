/**
 * LSU's phone app is HQ's, drawn in LSU's identity. This mounts every screen
 * LSU ships and the same screen from HQ's own build of the pinned source, in
 * stx's native test host, and compares what each draws: the screens and
 * routes that exist, the words on them, their testIDs and the kind of every
 * view. A screen, a button, a route or a line of copy HQ has and LSU lost
 * (or the reverse) fails here, rather than waiting for someone to notice.
 *
 * A white-label build may change colours, typefaces, images and the product's
 * name, origin and scheme. Those are left out of the comparison; HQ's
 * translation runtime swaps the product's name in as it reads a message
 * (resources/lang/runtime.ts), so a branded screen says "Last Soul Ultra"
 * where HQ's says "HQ", and the two count as the same word.
 *
 * Run after `bun run native:ios`. HQ's side is built here, from a clean copy
 * of the same platform kit without LSU's branding inputs, unless a directory
 * of HQ's native screens is passed.
 *
 *   bun run native:parity [HQ native-screens dir]
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import product from '../native/product.json'
import { kitRoot } from './native-source'

const root = process.cwd()
const pin = JSON.parse(readFileSync('native/hq-source.json', 'utf8'))
const source = join(root, 'storage/native/hq', pin.revision)
const lsuDir = join(root, 'storage/framework/mobile/ios/native-screens')
if (!existsSync(join(lsuDir, '__runtime.js'))) throw new Error('Build LSU first: bun run native:ios')

/** HQ's own app from the same kit: a clean copy beside the branded one, without LSU's inputs, sharing its installed packages. */
function buildHq(): string {
  const plain = join(root, 'storage/native/hq-plain', pin.revision)
  const output = join(plain, 'storage/native/parity-ios')
  if (existsSync(join(output, 'native-screens/__runtime.js'))) return join(output, 'native-screens')
  if (!existsSync(plain)) {
    cpSync(join(kitRoot, 'source'), plain, { recursive: true })
    symlinkSync(join(source, 'node_modules'), join(plain, 'node_modules'))
  }
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(?:PATH|HOME|USER|SHELL|TMPDIR|LANG|LC_.*|DEVELOPER_DIR|SDKROOT)$/.test(key)))
  execFileSync('./buddy', ['build:ios'], { cwd: plain, stdio: 'inherit', env: { ...env, NODE_ENV: 'production', IOS_OUTPUT: output, STX_COMPONENTS_DIR: join(plain, 'node_modules/@stacksjs/components/src/ui') } })
  return join(output, 'native-screens')
}
const hqDir = process.argv[2] || buildHq()
if (!existsSync(join(hqDir, '__runtime.js'))) throw new Error(`No HQ native screens in ${hqDir}`)
const { mountNativeScreen } = await import(import.meta.resolve('@stacksjs/stx/native/testing', pathToFileURL(join(root, 'storage/native/hq', pin.revision, 'package.json')).href))

const read = (path: string): string => {
  const bytes = readFileSync(path)
  return (bytes[0] === 0x1F && bytes[1] === 0x8B ? gunzipSync(bytes) : bytes).toString()
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const name = product.identity.name
const normalise = (value: string): string => value
  .replace(new RegExp(escape(new URL(product.site).origin), 'g'), 'ORIGIN')
  .replace(/https:\/\/hq\.training/g, 'ORIGIN')
  .replace(new RegExp(escape(name), 'g'), 'NAME')
  .replace(/HQ\.training|\bHQ\b(?![-_])/g, 'NAME')
  .replace(/data:[\w/+.-]+;base64,[\w+/=]+/g, 'DATA')

interface Build { dir: string, site: string, messages: Record<string, string> }
const build = (dir: string, site: string): Build => {
  const messages: Record<string, string> = {}
  for (const lang of readdirSync(join(dir, '__messages'))) {
    if (lang.includes('.')) continue
    for (const file of readdirSync(join(dir, '__messages', lang))) {
      if (file.endsWith('.json')) messages[`${lang}/${file.slice(0, -5)}`] = read(join(dir, '__messages', lang, file))
    }
  }
  return { dir, site, messages }
}
const hq = build(hqDir, 'https://hq.training')
const lsu = build(lsuDir, product.site)

/** The same signed-out device for both: no account, every API read unanswered. */
async function draw(target: Build, screen: string, language: string): Promise<string[]> {
  const code = `globalThis.__stxNativeReadMessages=function(language,area){return (${JSON.stringify(target.messages)})[language+'/'+area]||null};\n${read(join(target.dir, '__runtime.js'))}\n${read(join(target.dir, `${screen}.js`))}`
  const phone = mountNativeScreen(code, screen, { platform: 'ios', colorScheme: 'dark', locale: language, appURL: `${target.site}/m`, apiBase: `${target.site}/api`, sessionTokenKey: 'auth.token', api: () => undefined })
  try {
    await phone.settle(200)
    const lines: string[] = []
    const walk = (node: any, depth: number): void => {
      if (!node || node.props?.style?.display === 'none') return
      const id = node.props?.testID ? `#${node.props.testID}` : ''
      // The wordmark's label is the mark itself: HQ's reads "HQ.", a brand's its name.
      const label = node.props?.accessibilityLabel ? ` [${normalise(String(node.props.accessibilityLabel)).replace(/^NAME\.$/, 'NAME')}]` : ''
      const texts = (node.children || []).filter((child: unknown) => typeof child === 'string').map((text: string) => normalise(text.trim())).filter(Boolean)
      lines.push(`${'  '.repeat(depth)}${node.type}${id}${label}${texts.length ? ` "${texts.join(' ')}"` : ''}`)
      for (const child of node.children || []) if (typeof child !== 'string') walk(child, depth + 1)
    }
    const all = [...phone.nodes.values()] as any[]
    const children = new Set(all.flatMap(node => (node.children || []).filter((child: unknown) => typeof child !== 'string')))
    for (const node of all.filter(node => !children.has(node))) walk(node, 0)
    return lines
  }
  finally { phone.unmount() }
}

const screens = (dir: string) => readdirSync(dir).filter(file => /^views-.*\.js$/.test(file)).map(file => file.slice(0, -3)).sort()
const hqScreens = screens(hq.dir)
const lsuScreens = screens(lsu.dir)
const missing = hqScreens.filter(screen => !lsuScreens.includes(screen))
const extra = lsuScreens.filter(screen => !hqScreens.includes(screen))
const messageDifferences: string[] = []
for (const key of new Set([...Object.keys(hq.messages), ...Object.keys(lsu.messages)])) {
  if (normalise(hq.messages[key] || '') !== normalise(lsu.messages[key] || '')) messageDifferences.push(key)
}
const differing: Array<{ screen: string, language: string, hq: string[], lsu: string[] }> = []
const failed: Array<{ screen: string, error: string }> = []
for (const screen of hqScreens.filter(screen => lsuScreens.includes(screen))) {
  for (const language of ['en', 'de']) {
    try {
      const a = await draw(hq, screen, language)
      const b = await draw(lsu, screen, language)
      if (a.join('\n') !== b.join('\n')) {
        const onlyHq = a.filter(line => !b.includes(line))
        const onlyLsu = b.filter(line => !a.includes(line))
        differing.push({ screen, language, hq: onlyHq, lsu: onlyLsu })
      }
    }
    catch (error) { failed.push({ screen: `${screen} (${language})`, error: String((error as Error)?.message || error).slice(0, 200) }) }
  }
}

const report = { source: pin.revision, screens: hqScreens.length, missing, extra, messageDifferences, differing, failed }
writeFileSync('storage/native/hq-parity-report.json', JSON.stringify(report, null, 2))
process.stdout.write(`${hqScreens.length} HQ screens, ${lsuScreens.length} LSU screens (HQ ${pin.revision.slice(0, 8)}): ${missing.length} missing, ${extra.length} extra, ${messageDifferences.length} message catalogs differ, ${differing.length} screen drawings differ, ${failed.length} failed to draw\n`)
for (const screen of missing) process.stdout.write(`missing in LSU: ${screen}\n`)
for (const screen of extra) process.stdout.write(`only in LSU: ${screen}\n`)
for (const key of messageDifferences) process.stdout.write(`messages differ: ${key}\n`)
for (const item of differing) process.stdout.write(`\n${item.screen} (${item.language})\n${item.hq.slice(0, 12).map(line => `  HQ : ${line.trim()}`).join('\n')}\n${item.lsu.slice(0, 12).map(line => `  LSU: ${line.trim()}`).join('\n')}\n`)
for (const item of failed) process.stdout.write(`failed: ${item.screen}: ${item.error}\n`)
if (missing.length || extra.length || messageDifferences.length || differing.length || failed.length) process.exit(1)
