import { cpSync, mkdirSync, readdirSync, rmSync, readFileSync, copyFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join, dirname, delimiter } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { generateSplashScreens, type SplashOptions } from 'ts-images'
import source from '../native/hq-source.json'
import product from '../native/product.json'
import presets from '../enterprise/presets.json'

export const root = resolve(import.meta.dir, '..')
export const sourceRoot = join(root, 'storage/native/hq', source.revision)
export const output = resolve(root, 'storage/framework/mobile')
export const manifestPath = join(root, 'storage/native/product.json')
/** The launch splash ts-images' preset draws for this build, rebuilt each time. */
export const splashOutput = join(root, 'storage/native/splash')
/** The HQ platform kit, as `pantry install` places it: HQ's release, not access to HQ's repository. */
export const kitRoot = join(root, 'pantry', source.package)

export function assertSourceLock(lock: { package: string, version: string, revision: string, bun: string }): void {
  if (lock.package !== '@hq/platform' || !/^\d+\.\d+\.\d+$/.test(lock.version) || !/^[a-f0-9]{40}$/.test(lock.revision))
    throw new Error('Pin an exact @hq/platform version and the commit it was cut from in native/hq-source.json')
  if (Bun.version !== lock.bun) throw new Error(`Native builds require Bun ${lock.bun}; current runtime is ${Bun.version}`)
}

/** The installed kit is the version and commit the pin names, or nothing is built from it. */
export function assertInstalledKit(directory = kitRoot): void {
  const path = join(directory, 'platform.json')
  if (!existsSync(path)) throw new Error(`Install the HQ platform kit first: pantry ci, with PANTRY_REGISTRY_TOKEN granted ${source.package}`)
  const kit = JSON.parse(readFileSync(path, 'utf8')) as { package?: string, version?: string, revision?: string, bun?: string }
  if (kit.package !== source.package || kit.version !== source.version || kit.revision !== source.revision || kit.bun !== source.bun)
    throw new Error(`The installed HQ platform kit (${kit.package}@${kit.version}, ${kit.revision?.slice(0, 9)}) is not the one native/hq-source.json pins; run pantry ci`)
}

export async function prepareNativeSource(): Promise<void> {
  assertSourceLock(source)
  assertInstalledKit()
  // A fresh copy of the release every time, keeping only installed packages:
  // what a build or a deploy runs is exactly HQ's kit plus LSU's own inputs,
  // written below and by prepare-training.
  mkdirSync(sourceRoot, { recursive: true })
  for (const entry of readdirSync(sourceRoot)) {
    if (entry !== 'node_modules') rmSync(join(sourceRoot, entry), { recursive: true, force: true })
  }
  cpSync(join(kitRoot, 'source'), sourceRoot, { recursive: true })
  const installEnv = { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH || ''}` }
  const install = Bun.spawn([process.execPath, 'install', '--frozen-lockfile'], { cwd: sourceRoot, env: installEnv, stdout: 'inherit', stderr: 'inherit' })
  if (await install.exited !== 0) throw new Error('HQ frozen dependency install failed')
  const assets = join(sourceRoot, 'public/assets/native-product')
  mkdirSync(assets, { recursive: true })
  copyFileSync(join(root, 'public/assets/lsu/images/lsu-logo.svg'), join(assets, 'lsu-logo.svg'))
  copyFileSync(resolve(root, 'native', product.assets.icon), join(sourceRoot, 'public/apple-touch-icon.png'))
  const logo = `data:image/png;base64,${readFileSync(resolve(root, 'native', product.assets.wordmark)).toString('base64')}`
  writeFileSync(join(sourceRoot, 'resources/functions/native-product.json'), `${JSON.stringify({ product: { ...product.identity, logo } }, null, 2)}\n`)
  writeFileSync(join(sourceRoot, 'resources/functions/brand-assets.json'), `${JSON.stringify({ wordmarkLight: logo, wordmarkDark: logo, favicon: product.identity.logo }, null, 2)}\n`)
  // LSU's brand and coaching tiers as the installation's presets: HQ offers them to
  // this organization only, and ships none of its own (docs/developers/native-product-builds.md).
  writeFileSync(join(sourceRoot, 'resources/functions/installation-presets.json'), `${JSON.stringify({ presets: installationPresets() }, null, 2)}\n`)
  const fonts = Object.fromEntries(['Anton-Regular', 'Barlow-Regular'].map(name => [name, { src: join(sourceRoot, `public/assets/brands/${name}.ttf`), license: join(sourceRoot, `public/assets/brands/${name.split('-')[0]}-OFL.txt`) }]))
  mkdirSync(join(root, 'storage/native'), { recursive: true })
  const splash = await generateNativeSplash()
  // HQ reads `splash` as the launch image; `LaunchLogo.png` has its @2x/@3x
  // files beside it, which Craft 0.0.443+ installs by scale. `splashPreset`
  // is the same preset for an HQ that hands it to Stacks' own generator.
  writeFileSync(manifestPath, `${JSON.stringify({ ...product, output, assets: { icon: resolve(root, 'native', product.assets.icon), splash: splash.ios, splashPreset: splashPreset(), fonts } }, null, 2)}\n`)
}

type SplashPreset = { logo: string, accent?: string, size?: number }

/** `assets.splash` with its paths resolved: the logo to draw, the glow (default the brand accent) and its size in points. */
export function splashPreset(value: unknown = product.assets.splash, theme = product.identity.theme): SplashPreset {
  const preset = value as Partial<SplashPreset> | null
  if (!preset || typeof preset !== 'object' || typeof preset.logo !== 'string' || !preset.logo
    || (preset.accent !== undefined && !/^#[a-f0-9]{6}$/i.test(preset.accent))
    || (preset.size !== undefined && !(typeof preset.size === 'number' && preset.size > 0)))
    throw new Error('native/product.json assets.splash must be a splash preset: { logo, accent?: "#RRGGBB", size?: points }')
  return { logo: resolve(root, 'native', preset.logo), accent: preset.accent ?? theme.accent, ...(preset.size ? { size: preset.size } : {}) }
}

/**
 * LSU's launch screen, drawn by ts-images' splash preset: the wordmark at its
 * optical size in points with the accent's soft glow, on the black the app
 * opens on (one appearance; the app is dark only). Nothing full-screen, so no
 * phone crops it.
 */
export function splashOptions(preset: SplashPreset = splashPreset(), background = product.identity.theme.background): SplashOptions {
  return { logo: preset.logo, light: { background }, dark: false, accent: preset.accent, shape: 'none', ...(preset.size ? { size: preset.size } : {}) }
}

export async function generateNativeSplash(outputDir = splashOutput): Promise<{ ios: string, android: string }> {
  rmSync(outputDir, { recursive: true, force: true })
  const result = await generateSplashScreens(splashOptions(), outputDir)
  if (!result.ios || !result.android) throw new Error('The splash preset wrote no iOS or Android launch images')
  return { ios: result.ios.image, android: result.android.resources }
}

/** The packaged presets, checked against the product they belong to before they are written. */
export function installationPresets(value: typeof presets = presets, slug: string = product.identity.slug): typeof presets {
  if (value.organization !== slug || !value.name || !Array.isArray(value.products)
    || value.products.some(item => !/^[a-z0-9-]+$/.test(item.key) || !Number.isSafeInteger(item.price_cents) || item.price_cents <= 0 || !/^[A-Z]{3}$/.test(item.currency) || item.type !== 'coaching')
    || new Set(value.products.map(item => item.key)).size !== value.products.length)
    throw new Error('enterprise/presets.json must belong to the packaged product and list unique, priced coaching tiers')
  return value
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
    hqPlatform: `${source.package}@${source.version}`, hqRevision: source.revision,
    hqLockSha256: createHash('sha256').update(lock).digest('hex'),
    productSha256: createHash('sha256').update(readFileSync(join(root, 'native/product.json'))).digest('hex'),
    lsuRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    builtAt: new Date().toISOString(),
  }
  writeFileSync(join(output, platform, 'lsu-source.json'), `${JSON.stringify(receipt, null, 2)}\n`)
}
