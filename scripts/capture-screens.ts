/** Capture an explicit synthetic UI inventory through the released Stacks API. */
import { captureScreenshots } from '@stacksjs/docs/screenshots'

const [surface, ...args] = process.argv.slice(2)
if (!['training', 'website'].includes(surface || '')) throw new Error('Choose training or website')
const value = (name: string) => {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  if (!args[index + 1] || args[index + 1]!.startsWith('--')) throw new Error(`${name} needs a value`)
  return args[index + 1]!
}
const result = await captureScreenshots({
  config: `config/screenshots.${surface}.ts`,
  list: args.includes('--list'), check: args.includes('--check'),
  only: value('--only')?.split(','), viewports: value('--viewport')?.split(','), outDir: value('--out'),
  onProgress: row => console.log(`${row.status}: ${row.id}/${row.profile}/${row.viewport.name}${row.error ? ` (${row.error})` : ''}`),
})
console.log(JSON.stringify({ inventory: result.inventory.length, results: result.results.reduce<Record<string, number>>((counts, row) => { counts[row.status] = (counts[row.status] || 0) + 1; return counts }, {}) }))
if (result.results.some(row => row.status === 'failed')) process.exitCode = 1
