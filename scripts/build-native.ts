import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { nativeBuildEnvironment, output, prepareNativeSource, sourceRoot, writeNativeReceipt } from './native-source'

const platform = process.argv[2]
if (!['ios', 'android', 'prepare'].includes(platform || '')) throw new Error('Use native:ios, native:android or native:prepare')
await prepareNativeSource()
if (platform !== 'prepare') {
  const child = Bun.spawn(['./buddy', `build:${platform}`], { cwd: sourceRoot, env: nativeBuildEnvironment(), stdout: 'inherit', stderr: 'inherit' })
  if (await child.exited !== 0) throw new Error(`LSU ${platform} build failed`)
  writeNativeReceipt(platform as 'ios' | 'android')
  if (platform === 'ios') {
    const hookPath = join(output, 'ios/ci_scripts/ci_post_clone.sh')
    const hook = readFileSync(hookPath, 'utf8')
    // The generated hook installs LSU's dependencies; restore Craft from HQ's
    // frozen dependency graph, which owns this app's actual native shell.
    writeFileSync(hookPath, hook.replace(/bun --[^\n]*restoreIosShell[^\n]*|bun -e [^\n]*restoreIosShell[^\n]*/g, 'bun run native:restore-ios'))
  }
  process.stdout.write(`Built LSU ${platform} from the pinned HQ source: ${sourceRoot}\n`)
}
