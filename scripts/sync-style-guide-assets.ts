/* eslint-disable no-console */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
const check = process.argv.includes('--check')
const base = await readFile('resources/assets/styles/site/base.css', 'utf8')
const faces = base.match(/@font-face\{[^}]+\}/g) || []
const tokens = base.match(/:root\{([^}]+)\}/)?.[1]
if (!faces.length || !tokens) throw new Error('The LSU font declarations or design tokens could not be found.')
const expected = new Map<string, Uint8Array | string>()
const target = 'docs/public/style-guide'
const fonts = new Set<string>()
for (const face of faces) {
  for (const match of face.matchAll(/url\((\/assets\/lsu\/fonts\/[^)]+)\)/g)) {
    const source = `public${match[1]}`
    const name = basename(source)
    fonts.add(name)
    expected.set(join(target, 'fonts', name), await readFile(source))
  }
}
expected.set(join(target, 'fonts.css'), `${faces.join('\n').replaceAll('/assets/lsu/fonts/', '/docs/style-guide/fonts/')}\n`)
expected.set(join(target, 'tokens.css'), `.lsu-guide{${tokens}}\n`)
expected.set(join(target, 'lsu-logo.svg'), await readFile('public/assets/lsu/images/lsu-logo.svg'))
if (!check) await mkdir(join(target, 'fonts'), { recursive: true })
for (const [path, content] of expected) {
  if (check) {
    const expectedBytes = typeof content === 'string' ? Buffer.from(content) : content
    if (!Buffer.from(await readFile(path)).equals(expectedBytes)) throw new Error(`Style Guide asset is stale: ${path}`)
  }
  else await writeFile(path, content)
}
console.log(`Verified LSU Style Guide tokens, logo and ${fonts.size} font files from the active site stylesheet.`)
