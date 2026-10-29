import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, copyFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join, dirname, delimiter } from 'node:path'
import { createHash } from 'node:crypto'
import source from '../native/hq-source.json'
import product from '../native/product.json'

export const root = resolve(import.meta.dir, '..')
export const sourceRoot = join(root, 'storage/native/hq', source.revision)
export const output = resolve(root, 'storage/framework/mobile')
export const manifestPath = join(root, 'storage/native/product.json')
const git = (args: string[], cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

export function assertSourceLock(lock: { repository: string, revision: string, bun: string }): void {
  if (lock.repository !== 'https://github.com/stacksjs/hq.training.git' || !/^[a-f0-9]{40}$/.test(lock.revision))
    throw new Error('Pin HQ to a complete commit SHA in native/hq-source.json')
  if (Bun.version !== lock.bun) throw new Error(`Native builds require Bun ${lock.bun}; current runtime is ${Bun.version}`)
}

export async function prepareNativeSource(): Promise<void> {
  assertSourceLock(source)
  mkdirSync(sourceRoot, { recursive: true })
  if (!existsSync(join(sourceRoot, '.git'))) {
    git(['init', '--quiet'], sourceRoot)
    git(['remote', 'add', 'origin', source.repository], sourceRoot)
    git(['fetch', '--depth=1', 'origin', source.revision], sourceRoot)
    git(['checkout', '--detach', source.revision], sourceRoot)
  }
  if (git(['rev-parse', 'HEAD'], sourceRoot) !== source.revision) throw new Error('HQ checkout differs from the source lock')
  const overlays = new Set(['resources/functions/native-product.json', 'resources/functions/brand-assets.json'])
  const changes = git(['diff', '--name-only', 'HEAD'], sourceRoot).split('\n').filter(Boolean)
  if (changes.some(path => !overlays.has(path))) throw new Error('HQ source has local changes outside the branding inputs; use a fresh source cache')
  const untracked = git(['ls-files', '--others', '--exclude-standard'], sourceRoot).split('\n').filter(Boolean)
  if (untracked.some(path => path !== 'public/assets/native-product/lsu-logo.svg')) throw new Error('HQ source has untracked application inputs; use a fresh source cache')
  const install = Bun.spawn([process.execPath, 'install', '--frozen-lockfile'], { cwd: sourceRoot, env: { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH || ''}` }, stdout: 'inherit', stderr: 'inherit' })
  if (await install.exited !== 0) throw new Error('HQ frozen dependency install failed')
  const assets = join(sourceRoot, 'public/assets/native-product')
  mkdirSync(assets, { recursive: true })
  copyFileSync(join(root, 'public/assets/lsu/images/lsu-logo.svg'), join(assets, 'lsu-logo.svg'))
  writeFileSync(join(sourceRoot, 'resources/functions/native-product.json'), `${JSON.stringify({ product: product.identity }, null, 2)}\n`)
  writeFileSync(join(sourceRoot, 'resources/functions/brand-assets.json'), `${JSON.stringify({ wordmarkLight: product.identity.logo, wordmarkDark: product.identity.logo, favicon: product.identity.logo }, null, 2)}\n`)
  const fonts = Object.fromEntries(['Anton-Regular', 'Barlow-Regular'].map(name => [name, { src: join(sourceRoot, `public/assets/brands/${name}.ttf`), license: join(sourceRoot, `public/assets/brands/${name.split('-')[0]}-OFL.txt`) }]))
  mkdirSync(join(root, 'storage/native'), { recursive: true })
  writeFileSync(manifestPath, `${JSON.stringify({ ...product, output, assets: { icon: resolve(root, 'native', product.assets.icon), splash: resolve(root, 'native', product.assets.splash), fonts } }, null, 2)}\n`)
}

export function nativeBuildEnvironment(): Record<string, string | undefined> {
  // Never load HQ's server env or reuse HQ's app-specific Firebase client.
  const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production', PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH || ''}`, HQ_NATIVE_PRODUCT: manifestPath, STX_COMPONENTS_DIR: join(sourceRoot, 'node_modules/@stacksjs/components/src/ui') }
  for (const name of ['HQ_WHITE_LABEL', 'MOBILE_URL', 'IOS_OUTPUT', 'ANDROID_OUTPUT', 'CRAFT_IOS_SRC', 'CRAFT_ANDROID_SRC', 'STX_COMPONENTS_SRC']) delete env[name]
  return env
}

export function writeNativeReceipt(platform: 'ios' | 'android'): void {
  const lock = readFileSync(join(sourceRoot, 'bun.lock'))
  const receipt = {
    schemaVersion: 1, platform, app: product.bundleId, version: product.version, build: product.build,
    hqRepository: source.repository, hqRevision: source.revision,
    hqLockSha256: createHash('sha256').update(lock).digest('hex'),
    productSha256: createHash('sha256').update(readFileSync(join(root, 'native/product.json'))).digest('hex'),
    lsuRevision: git(['rev-parse', 'HEAD']),
    builtAt: new Date().toISOString(),
  }
  writeFileSync(join(output, platform, 'lsu-source.json'), `${JSON.stringify(receipt, null, 2)}\n`)
}
