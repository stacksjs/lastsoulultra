/** Capture an explicit synthetic UI inventory through the released Stacks API. */
import { captureScreenshots } from '@stacksjs/docs/screenshots'
import { parse, resolveEnvPrivateKey } from '@stacksjs/env'
import { assertReviewSource, prepareReviewScreens } from './screenshot-support'

const [surface, ...args] = process.argv.slice(2)
if (!['training', 'website'].includes(surface || '')) throw new Error('Choose training or website')
if (args.includes('--production-env')) {
  const loaded = parse(await Bun.file('.env.production').text(), { privateKey: resolveEnvPrivateKey({ file: '.env.production', cwd: process.cwd() }) })
  if (loaded.errors.length || loaded.skippedEncrypted.length) throw new Error('The production review environment could not be decrypted completely')
  for (const key of ['SITE_AUTH_USER', 'SITE_AUTH_PASSWORD', 'LSU_DEMO_ACCOUNTS_JSON']) {
    if (!loaded.parsed[key]) throw new Error(`The production review environment has no ${key}`)
    process.env[key] = loaded.parsed[key]
  }
}

const value = (name: string) => {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  if (!args[index + 1] || args[index + 1]!.startsWith('--')) throw new Error(`${name} needs a value`)
  return args[index + 1]!
}
const options = {
  config: `config/screenshots.${surface}.ts`,
  only: value('--only')?.split(','), viewports: value('--viewport')?.split(','), outDir: value('--out'),
  onProgress: (row: import('@stacksjs/docs/screenshots').ScreenshotResult) => console.log(`${row.status}: ${row.id}/${row.profile}/${row.viewport.name}${row.error ? ` (${row.error})` : ''}`),
}
let result = await captureScreenshots({ ...options, list: !args.includes('--check'), check: args.includes('--check') })
if (!args.includes('--list') && !args.includes('--check')) {
  // The live review adapter is read-only. Bound browser resources per screen
  // while the core API merges each batch into the same complete manifest.
  const cleanup = surface === 'training' ? await prepareReviewScreens(process.env.LSU_SCREENSHOT_TRAINING_ORIGIN || 'https://training.lsu.stacksjs.com') : () => {}
  try {
    const selected = result.inventory.filter(page => !options.only?.length || options.only.includes(page.id))
    const excluded = selected.filter(page => page.skip).map(page => page.id)
    if (excluded.length) result = await captureScreenshots({ ...options, only: excluded })
    for (const page of selected.filter(page => !page.skip)) {
      result = await captureScreenshots({ ...options, only: [page.id] })
      const failed = result.results.filter(row => row.id === page.id && row.status === 'failed')
      if (failed.length) {
        console.log(`Retrying ${page.id} once after its failed capture`)
        result = await captureScreenshots({ ...options, only: [page.id], viewports: [...new Set(failed.map(row => row.viewport.name))] })
      }
    }
    if (surface === 'training') await assertReviewSource(process.env.LSU_SCREENSHOT_TRAINING_ORIGIN || 'https://training.lsu.stacksjs.com')
  } finally { cleanup() }
}
console.log(JSON.stringify({ inventory: result.inventory.length, results: result.results.reduce<Record<string, number>>((counts, row) => { counts[row.status] = (counts[row.status] || 0) + 1; return counts }, {}) }))
if (result.results.some(row => row.status === 'failed')) process.exitCode = 1
