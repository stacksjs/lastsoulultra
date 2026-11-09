import { expect, it } from 'bun:test'
import product from '../native/product.json'
import source from '../native/hq-source.json'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { getMetadata } from 'ts-images'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pantry from '../pantry.json'
import presets from '../enterprise/presets.json'
import { assertInstalledKit, assertSourceLock, generateNativeSplash, installationPresets, manifestPath, nativeBuildEnvironment, root, splashOptions, splashPreset } from '../scripts/native-source'

it('requires an exact HQ platform release, its commit and the pinned Bun runtime', () => {
  expect(() => assertSourceLock(source)).not.toThrow()
  expect(() => assertSourceLock({ ...source, revision: 'main' })).toThrow('exact @hq/platform version')
  expect(() => assertSourceLock({ ...source, version: '^1.0.0' })).toThrow('exact @hq/platform version')
  expect(() => assertSourceLock({ ...source, package: '@other/platform' })).toThrow('exact @hq/platform version')
  expect(() => assertSourceLock({ ...source, bun: '0.0.0' })).toThrow('Native builds require Bun')
})

it('installs the pinned kit from the Pantry registry only, never a same-named public package', () => {
  expect((pantry.dependencies as Record<string, string>)[source.package]).toBe(source.version)
  expect((pantry as { scopes?: Record<string, string> }).scopes?.['@hq']).toBe('pantry')
})

it('builds only from the installed kit the pin names', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lsu-kit-'))
  try {
    expect(() => assertInstalledKit(directory)).toThrow('Install the HQ platform kit first')
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'platform.json'), JSON.stringify({ ...source, revision: 'f'.repeat(40) }))
    expect(() => assertInstalledKit(directory)).toThrow('not the one native/hq-source.json pins')
    writeFileSync(join(directory, 'platform.json'), JSON.stringify(source))
    expect(() => assertInstalledKit(directory)).not.toThrow()
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
})

it('builds with LSU identity and removes local native overrides from the release environment', () => {
  const previous = process.env.HQ_WHITE_LABEL
  const previousSecrets = { key: process.env.CLOUDFLARE_API_TOKEN, database: process.env.LSU_TRAINING_DB_PASSWORD }
  process.env.HQ_WHITE_LABEL = '/unrelated/gym.json'
  process.env.CLOUDFLARE_API_TOKEN = 'deployment-only-sentinel'
  process.env.LSU_TRAINING_DB_PASSWORD = 'database-only-sentinel'
  try {
    const env = nativeBuildEnvironment()
    expect(env.HQ_NATIVE_PRODUCT).toBe(manifestPath)
    expect(env.HQ_WHITE_LABEL).toBeUndefined()
    expect(env.NODE_ENV).toBe('production')
    expect(product.bundleId).toBe('com.lastsoulultra.app')
    expect(product.identity.scheme).toBe('lastsoulultra')
    // LSU serves coaches and athletes only: the kit drops gym wording for it.
    expect((product.identity as { audience?: string }).audience).toBe('coaching')
    expect(product.site).toBe('https://training.lsu.stacksjs.com')
    expect(env.STX_PUBLIC_API_URL).toBe('https://training.lsu.stacksjs.com/api')
    expect(env.LSU_TRAINING_DB_PASSWORD).toBeUndefined()
    expect(env.CLOUDFLARE_API_TOKEN).toBeUndefined()
  }
  finally {
    if (previous === undefined) delete process.env.HQ_WHITE_LABEL
    else process.env.HQ_WHITE_LABEL = previous
    if (previousSecrets.key === undefined) delete process.env.CLOUDFLARE_API_TOKEN
    else process.env.CLOUDFLARE_API_TOKEN = previousSecrets.key
    if (previousSecrets.database === undefined) delete process.env.LSU_TRAINING_DB_PASSWORD
    else process.env.LSU_TRAINING_DB_PASSWORD = previousSecrets.database
  }
})

it('packages LSU’s brand and approved coaching tiers as the installation’s own presets', () => {
  expect(installationPresets()).toBe(presets)
  expect(presets.organization).toBe(product.identity.slug)
  expect(presets.name).toBe(product.identity.name)
  // Approved 2026-10-28: EUR 19.99 running, EUR 29.99 running plus strength, no personal coaching or trial.
  expect(presets.products.map(item => [item.key, item.price_cents, item.currency, item.billing_interval, item.includes_coaching, item.allowed_training_sports])).toEqual([
    ['lsu-running', 1999, 'EUR', 'month', false, ['Run']],
    ['lsu-running-strength', 2999, 'EUR', 'month', false, ['Run', 'Strength']],
  ])
  expect(presets.experience.navigation.map(item => item.label)).toEqual(['Store', 'Workouts', 'Health', 'Messages', 'Me'])
  expect(presets.experience.show_powered_by).toBe(false)
  expect(presets.experience.theme).toMatchObject({ accent: product.identity.theme.accent, background: product.identity.theme.background, font: 'barlow', heading_font: 'anton' })
  expect(() => installationPresets({ ...presets, organization: 'another-brand' })).toThrow('must belong to the packaged product')
  expect(() => installationPresets({ ...presets, products: [presets.products[0]!, presets.products[0]!] })).toThrow('unique, priced coaching tiers')
  expect(() => installationPresets({ ...presets, products: [{ ...presets.products[0]!, price_cents: 0 }] })).toThrow('unique, priced coaching tiers')
})

it('draws the launch splash with ts-images’ preset from the wordmark, on the black the app opens on', async () => {
  expect(splashPreset()).toEqual({ logo: join(root, 'public/assets/lsu/images/lsu-logo.svg'), accent: '#dd0f15' })
  expect(splashOptions()).toEqual({ logo: join(root, 'public/assets/lsu/images/lsu-logo.svg'), light: { background: '#000000' }, dark: false, accent: '#dd0f15', shape: 'none' })
  expect(() => splashPreset('../public/assets/lsu/images/lsu-splash.svg')).toThrow('must be a splash preset')
  expect(() => splashPreset({ logo: 'x.svg', accent: 'red' })).toThrow('must be a splash preset')
  const directory = mkdtempSync(join(tmpdir(), 'lsu-splash-'))
  try {
    const splash = await generateNativeSplash(directory)
    expect(splash.ios).toBe(join(directory, 'ios/LaunchLogo.imageset/LaunchLogo.png'))
    expect(splash.android).toBe(join(directory, 'android/res'))
    const one = await getMetadata(readFileSync(splash.ios))
    const three = await getMetadata(readFileSync(join(directory, 'ios/LaunchLogo.imageset/LaunchLogo@3x.png')))
    expect([three.width, three.height]).toEqual([one.width * 3, one.height * 3])
    // A wordmark, not a full-screen picture: no phone crops it.
    expect(one.width).toBeLessThan(375)
    expect(existsSync(join(directory, 'ios/LaunchLogo.imageset/LaunchLogo-dark.png'))).toBe(false)
    for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
      expect(existsSync(join(directory, `android/res/drawable-${density}/splash_icon.png`))).toBe(true)
      expect(existsSync(join(directory, `android/res/drawable-${density}/splash_logo.png`))).toBe(true)
    }
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
})

it('shows LSU\'s own screens in the tour, and refuses a kit tour page LSU has not photographed', async () => {
  const { installOnboardingScreens } = await import('../scripts/native-source')
  const directory = mkdtempSync(join(tmpdir(), 'lsu-tour-'))
  const ours = join(directory, 'ours')
  const kit = join(directory, 'kit')
  const viewport = { width: 390, height: 790 }
  const screen = (id: string) => ({ light: `/assets/images/onboarding/${id}-light.webp?v=1`, dark: `/assets/images/onboarding/${id}-dark.webp?v=1` })
  try {
    mkdirSync(ours, { recursive: true })
    mkdirSync(join(kit, 'resources/functions'), { recursive: true })
    for (const file of ['coach-roster-light.webp', 'coach-roster-dark.webp']) writeFileSync(join(ours, file), `lsu ${file}`)
    writeFileSync(join(kit, 'resources/functions/onboarding-screens.json'), JSON.stringify({ product: null, viewport, screens: { 'coach.roster': screen('coach-roster') } }))
    writeFileSync(join(ours, 'onboarding-screens.json'), JSON.stringify({ product: product.identity.slug, viewport, screens: { 'coach.roster': screen('coach-roster') } }))
    installOnboardingScreens(ours, kit)
    expect(readFileSync(join(kit, 'public/assets/images/onboarding/coach-roster-dark.webp'), 'utf8')).toBe('lsu coach-roster-dark.webp')
    expect(JSON.parse(readFileSync(join(kit, 'resources/functions/onboarding-screens.json'), 'utf8')).product).toBe(product.identity.slug)

    // A kit whose tour gained a page fails until LSU photographs it.
    writeFileSync(join(kit, 'resources/functions/onboarding-screens.json'), JSON.stringify({ product: null, viewport, screens: { 'coach.roster': screen('coach-roster'), 'coach.atp': screen('coach-atp') } }))
    expect(() => installOnboardingScreens(ours, kit)).toThrow('missing tour screens: coach.atp')
    // LSU serves athletes and coaches: the gym, member and staff tours are not its to photograph.
    writeFileSync(join(kit, 'resources/functions/onboarding-screens.json'), JSON.stringify({ product: null, viewport, screens: { 'coach.roster': screen('coach-roster'), 'gym.today': screen('gym-today'), 'member.classes': screen('member-classes') } }))
    expect(() => installOnboardingScreens(ours, kit)).not.toThrow()
    expect(Object.keys(JSON.parse(readFileSync(join(kit, 'resources/functions/onboarding-screens.json'), 'utf8')).screens)).toEqual(['coach.roster'])
    // HQ's own pictures, or another size, are not LSU's.
    writeFileSync(join(kit, 'resources/functions/onboarding-screens.json'), JSON.stringify({ product: null, viewport: { width: 390, height: 844 }, screens: { 'coach.roster': screen('coach-roster') } }))
    expect(() => installOnboardingScreens(ours, kit)).toThrow('the kit\'s tour draws 390x844')
    writeFileSync(join(ours, 'onboarding-screens.json'), JSON.stringify({ product: null, viewport, screens: { 'coach.roster': screen('coach-roster') } }))
    expect(() => installOnboardingScreens(ours, kit)).toThrow('photographed from HQ')
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
})

it('ships a photographed screen for every picture its tour manifest names', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'native/onboarding/onboarding-screens.json'), 'utf8'))
  expect(manifest.product).toBe(product.identity.slug)
  for (const shot of Object.values(manifest.screens) as Array<{ light: string, dark: string }>) {
    for (const url of [shot.light, shot.dark]) expect(existsSync(join(root, 'native/onboarding', url.split('?')[0]!.split('/').pop()!))).toBe(true)
  }
})
