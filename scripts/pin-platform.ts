/**
 * Move LSU to another HQ platform kit:
 *
 *   bun run native:pin 1.0.4122
 *
 * Only the version is given. The kit says the rest about itself (the HQ commit
 * it was cut from, the Bun it needs, the Craft it locks), so the pin, the lock
 * and LSU's Craft override are written from the installed kit rather than typed
 * from a message, where a wrong commit hash passes until a build refuses it.
 *
 * It needs this machine's registry grant for @hq/platform (PANTRY_REGISTRY_TOKEN
 * or a signed-in pantry); without one, the Platform pin workflow does the same
 * on GitHub. Nothing is committed: review the diff, say in the commit what
 * people will notice, push, and release once Deploy has the backend on the kit.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { type KitManifest, pinFromKit, withCraft, withPinnedKit } from './native-release'

const root = resolve(import.meta.dir, '..')
const version = process.argv[2] || ''
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Name the kit to pin: bun run native:pin 1.0.4122')
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const run = (command: string, values: string[]) => execFileSync(command, values, { cwd: root, stdio: 'inherit' })

const before = { pantry: read('pantry.json'), source: read('native/hq-source.json'), pkg: read('package.json') }
const current = JSON.parse(before.source) as { version: string, bun: string }
if (current.version === version) {
  process.stdout.write(`Already pinned to kit ${version}.\n`)
  process.exit(0)
}

try {
  // Resolve the tarball first, on the current Bun entry: the kit is what says which Bun it needs.
  writeFileSync(join(root, 'pantry.json'), withPinnedKit(before.pantry, version, current.bun))
  run('pantry', ['install', '--ignore-scripts'])
  const manifest = join(root, 'pantry/@hq/platform/platform.json')
  if (!existsSync(manifest)) throw new Error(`pantry did not install @hq/platform ${version}; this machine may have no grant for it`)
  const pin = pinFromKit(JSON.parse(readFileSync(manifest, 'utf8')) as KitManifest, version)
  if (pin.bun !== current.bun) {
    writeFileSync(join(root, 'pantry.json'), withPinnedKit(before.pantry, version, pin.bun))
    run('pantry', ['install', '--ignore-scripts'])
  }
  writeFileSync(join(root, 'native/hq-source.json'), `${JSON.stringify(pin, null, 2)}\n`)

  // The app is built with the kit's Craft, so LSU's override names the same one.
  const kitPackage = JSON.parse(readFileSync(join(root, 'pantry/@hq/platform/source/package.json'), 'utf8')) as { dependencies?: Record<string, string>, overrides?: Record<string, string> }
  const craft = kitPackage.overrides?.['craft-native'] || kitPackage.dependencies?.['craft-native'] || ''
  const pkg = withCraft(before.pkg, craft.replace(/^[\^~]/, ''))
  if (pkg !== before.pkg) {
    writeFileSync(join(root, 'package.json'), pkg)
    run(process.execPath, ['install'])
  }
  // The component guide is generated from the kit's components, and CI refuses a
  // stale one (kit 1.0.4165's pin failed lint on it, so it was never deployed
  // by its own push). The pin stands if this fails; the guide can be redone.
  try { run(process.execPath, ['run', 'docs:style-guide']) }
  catch { process.stderr.write('The component guide was not regenerated. Run `bun run docs:style-guide` and commit what it writes with the pin, or CI fails.\n') }
  try { run(process.execPath, ['run', 'docs:erd:source']) }
  catch { process.stderr.write('The training ERD provenance was not regenerated. Run `bun run docs:erd:source` and commit it with the pin.\n') }
  process.stdout.write(`\nPinned HQ platform kit ${pin.version} (${pin.revision.slice(0, 9)}), Bun ${pin.bun}, Craft ${craft}.\nNext: bun run native:ios && bun run native:verify-ios, commit the pin with the regenerated docs saying what people will notice, push, then bun run release:build once Deploy and the acceptance run it starts have finished.\n`)
}
catch (error) {
  // A half-moved pin is what `pantry ci` rejects on the next deploy; leave none behind.
  writeFileSync(join(root, 'pantry.json'), before.pantry)
  writeFileSync(join(root, 'native/hq-source.json'), before.source)
  writeFileSync(join(root, 'package.json'), before.pkg)
  process.stderr.write('The pin was not moved; pantry.json, native/hq-source.json and package.json are as they were. pantry.lock may need `git checkout -- pantry.lock`.\n')
  throw error
}
