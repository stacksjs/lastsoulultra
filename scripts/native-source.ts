import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, readFileSync, copyFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join, dirname, delimiter } from 'node:path'
import { createHash } from 'node:crypto'
import source from '../native/hq-source.json'
import product from '../native/product.json'

export const root = resolve(import.meta.dir, '..')
export const sourceRoot = join(root, 'storage/native/hq', source.revision)
export const output = resolve(root, 'storage/framework/mobile')
export const manifestPath = join(root, 'storage/native/product.json')
const git = (args: string[], cwd = root, env = process.env) => execFileSync('git', args, { cwd, env, timeout: 180000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

/** CI receives a repository-scoped read-only deploy key, never a user's broad GitHub token. */
async function fetchSource(): Promise<void> {
  const key = process.env.HQ_SOURCE_SSH_KEY
  if (!key) { git(['fetch', '--depth=1', 'origin', source.revision], sourceRoot); return }
  const directory = mkdtempSync(join(tmpdir(), 'lsu-source-key-'))
  try {
    const response = await fetch('https://api.github.com/meta', { signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error('Could not verify GitHub source host identity')
    const meta = await response.json() as { ssh_keys?: string[] }
    const hostKey = meta.ssh_keys?.find(value => /^ssh-ed25519 [A-Za-z0-9+/=]+$/.test(value))
    if (!hostKey) throw new Error('GitHub did not supply its expected SSH host key')
    const identity = join(directory, 'identity')
    const hosts = join(directory, 'known_hosts')
    writeFileSync(identity, `${key.replace(/\r\n/g, '\n').trim()}\n`, { mode: 0o600 })
    writeFileSync(hosts, `github.com ${hostKey}\n`, { mode: 0o600 })
    const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`
    const ssh = `ssh -i ${quote(identity)} -p 443 -o HostName=ssh.github.com -o HostKeyAlias=github.com -o ConnectTimeout=15 -o ConnectionAttempts=1 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o HostKeyAlgorithms=ssh-ed25519 -o UserKnownHostsFile=${quote(hosts)}`
    git(['-c', `url.ssh://git@github.com/stacksjs/hq.training.git.insteadOf=${source.repository}`, 'fetch', '--depth=1', 'origin', source.revision], sourceRoot, { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: ssh })
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}

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
  }
  if (git(['remote', 'get-url', 'origin'], sourceRoot) !== source.repository) throw new Error('HQ source cache has an unexpected remote')
  let checkedOut = false
  try { checkedOut = !!git(['rev-parse', '--verify', 'HEAD'], sourceRoot) }
  catch {}
  if (!checkedOut) {
    await fetchSource()
    git(['checkout', '--detach', source.revision], sourceRoot)
  }
  if (git(['rev-parse', 'HEAD'], sourceRoot) !== source.revision) throw new Error('HQ checkout differs from the source lock')
  const overlays = new Set(['resources/functions/native-product.json', 'resources/functions/brand-assets.json', 'resources/functions/enterprise-deployment.json', 'public/apple-touch-icon.png'])
  const changes = git(['diff', '--name-only', 'HEAD'], sourceRoot).split('\n').filter(Boolean)
  if (changes.some(path => !overlays.has(path))) throw new Error('HQ source has local changes outside the branding inputs; use a fresh source cache')
  const untracked = git(['ls-files', '--others', '--exclude-standard'], sourceRoot).split('\n').filter(Boolean)
  const inputs = new Set(['public/assets/native-product/lsu-logo.svg', 'deployment/lsu/seed-demo-accounts.ts', 'deployment/lsu/lsu-demo-plan.ts', 'deployment/lsu/seed-review.ts', 'deployment/lsu/assets/icon.png', 'deployment/lsu/assets/logo.svg', 'deployment/lsu/product.json', 'resources/views/legal/lsu/privacy.stx', 'resources/views/legal/lsu/terms.stx'])
  if (untracked.some(path => !inputs.has(path))) throw new Error('HQ source has untracked application inputs; use a fresh source cache')
  const installEnv = { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH || ''}` }
  delete installEnv.HQ_SOURCE_SSH_KEY
  const install = Bun.spawn([process.execPath, 'install', '--frozen-lockfile'], { cwd: sourceRoot, env: installEnv, stdout: 'inherit', stderr: 'inherit' })
  if (await install.exited !== 0) throw new Error('HQ frozen dependency install failed')
  const assets = join(sourceRoot, 'public/assets/native-product')
  mkdirSync(assets, { recursive: true })
  copyFileSync(join(root, 'public/assets/lsu/images/lsu-logo.svg'), join(assets, 'lsu-logo.svg'))
  copyFileSync(resolve(root, 'native', product.assets.icon), join(sourceRoot, 'public/apple-touch-icon.png'))
  const logo = `data:image/png;base64,${readFileSync(resolve(root, 'native', product.assets.wordmark)).toString('base64')}`
  writeFileSync(join(sourceRoot, 'resources/functions/native-product.json'), `${JSON.stringify({ product: { ...product.identity, logo } }, null, 2)}\n`)
  writeFileSync(join(sourceRoot, 'resources/functions/brand-assets.json'), `${JSON.stringify({ wordmarkLight: logo, wordmarkDark: logo, favicon: product.identity.logo }, null, 2)}\n`)
  const fonts = Object.fromEntries(['Anton-Regular', 'Barlow-Regular'].map(name => [name, { src: join(sourceRoot, `public/assets/brands/${name}.ttf`), license: join(sourceRoot, `public/assets/brands/${name.split('-')[0]}-OFL.txt`) }]))
  mkdirSync(join(root, 'storage/native'), { recursive: true })
  writeFileSync(manifestPath, `${JSON.stringify({ ...product, output, assets: { icon: resolve(root, 'native', product.assets.icon), splash: resolve(root, 'native', product.assets.splash), fonts } }, null, 2)}\n`)
}

export function nativeBuildEnvironment(): Record<string, string | undefined> {
  // Never load HQ's server env or reuse HQ's app-specific Firebase client.
  const system = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(?:PATH|HOME|USER|SHELL|TMPDIR|LANG|LC_.*|DEVELOPER_DIR|SDKROOT|JAVA_HOME|ANDROID_HOME|ANDROID_SDK_ROOT|GRADLE_USER_HOME|BUN_INSTALL_CACHE_DIR)$/.test(name)))
  const env: Record<string, string | undefined> = { ...system, NODE_ENV: 'production', APP_URL: product.site, APP_DOMAIN: new URL(product.site).hostname, FRONTEND_APP_URL: product.site, STX_PUBLIC_API_URL: `${product.site}/api`, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH || ''}`, HQ_NATIVE_PRODUCT: manifestPath, STX_COMPONENTS_DIR: join(sourceRoot, 'node_modules/@stacksjs/components/src/ui') }
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
