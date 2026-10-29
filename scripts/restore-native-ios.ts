import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { output, prepareNativeSource, sourceRoot } from './native-source'

await prepareNativeSource()
const require = createRequire(join(sourceRoot, 'package.json'))
const module = await import(pathToFileURL(require.resolve('@stacksjs/mobile/testing')).href)
await module.restoreIosShell(join(output, 'ios'))
