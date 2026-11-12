import { expect, it } from 'bun:test'
import product from '../native/product.json'
import source from '../native/hq-source.json'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { getMetadata } from 'ts-images'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pantry from '../pantry.json'
import presets from '../enterprise/presets.json'
import { assertInstalledKit, assertSourceLock, generateNativeSplash, installationPresets, installImagery, manifestPath, NATIVE_FONTS, nativeBuildEnvironment, root, splashOptions, splashPreset } from '../scripts/native-source'

/** WCAG contrast ratio between two `#rrggbb` colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [red, green, blue] = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return red! * 0.2126 + green! * 0.7152 + blue! * 0.0722
  }
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light! + 0.05) / (dark! + 0.05)
}

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
  // Both tiers assign training automatically, two weeks at a time, and a coach approves every block.
  expect(presets.products.map(item => item.training_blocks)).toEqual([{ length_days: 14, review: 'coach' }, { length_days: 14, review: 'coach' }])
  // The AI coach reads and explains; it has no way to create a workout.
  expect(presets.assistant).toEqual({ mode: 'insights' })
  expect(() => installationPresets({ ...presets, assistant: { mode: 'coach' } })).toThrow('keep the AI coach to insights')
  // LSU's sign-in offers no "Continue with HQ": the switch has to be an explicit false, since HQ defaults to offering it.
  expect(presets.sign_in).toEqual({ hq: false })
  expect(() => installationPresets({ ...presets, sign_in: { hq: true } })).toThrow('must turn off HQ sign-in')
  const { sign_in: _unset, ...withoutSignIn } = presets
  expect(() => installationPresets(withoutSignIn as typeof presets)).toThrow('must turn off HQ sign-in')
  expect(presets.experience.navigation.map(item => item.label)).toEqual(['Store', 'Workouts', 'Health', 'Messages', 'Me'])
  expect(presets.experience.show_powered_by).toBe(false)
  expect(presets.experience.theme).toMatchObject({ accent: product.identity.theme.accent, background: product.identity.theme.background, font: 'inter', heading_font: 'anton', radius: product.identity.theme.radius })
  expect(() => installationPresets({ ...presets, organization: 'another-brand' })).toThrow('must belong to the packaged product')
  expect(() => installationPresets({ ...presets, products: [presets.products[0]!, presets.products[0]!] })).toThrow('unique, priced coaching tiers')
  expect(() => installationPresets({ ...presets, products: [{ ...presets.products[0]!, price_cents: 0 }] })).toThrow('unique, priced coaching tiers')
  expect(() => installationPresets({ ...presets, products: [{ ...presets.products[0]!, training_blocks: { length_days: 14, review: 'none' as 'coach' } }] })).toThrow('reviewed by a coach')
  expect(() => installationPresets({ ...presets, products: [{ ...presets.products[0]!, training_blocks: { length_days: 10, review: 'coach' } }] })).toThrow('reviewed by a coach')
})

it('draws the app in the shapes and faces of the coaching design, in the black and deep red LSU had', () => {
  const theme = product.identity.theme
  // "LSU Coaching App - Entwurf v2" (2026-11-10) gives the faces and corners. The colours are LSU's
  // earlier black and deep red: the draft's lighter reds drew the red washes grey-pink (2026-11-12).
  expect(theme).toEqual({
    background: '#000000', surface: '#0d0d0f', text: '#ffffff', muted: '#b6b6bd',
    accent: '#dd0f15', accent_text: '#ffffff', border: '#333338',
    radius: 14, card_radius: 14, card_border: true,
    font: 'inter', heading_font: 'anton', heading_uppercase: true,
  })
  // No second, lighter red for words: HQ derives a readable one from the accent itself.
  expect(theme).not.toHaveProperty('accent_ink')
  // Every ink reads on what it is drawn on (WCAG 4.5:1).
  for (const [ink, surface] of [[theme.text, theme.background], [theme.text, theme.surface], [theme.muted, theme.background], [theme.muted, theme.surface], [theme.accent_text, theme.accent]] as const)
    expect(contrast(ink, surface), `${ink} on ${surface}`).toBeGreaterThanOrEqual(4.5)
  // The phone packages the faces the theme names, Inter's bold with its regular.
  expect([...NATIVE_FONTS]).toEqual(['Anton-Regular', 'Inter-Regular', 'Inter-Bold'])
})

it('ships the design\'s photographs from LSU\'s own image set, one per screen that is given one', () => {
  const places = Object.keys(product.identity.imagery)
  expect(places).toEqual(['start', 'signIn', 'today', 'plans', 'library', 'feedback', 'simulation'])
  for (const [place, image] of Object.entries(product.identity.imagery)) {
    expect(image.src).toBe(`/assets/native-product/imagery/${place}.webp`)
    expect(image.focus).toBeGreaterThanOrEqual(0)
    expect(image.focus).toBeLessThanOrEqual(100)
    // Described in both languages, with no dash a reader would stumble on.
    for (const alt of [image.alt.de, image.alt.en]) expect(alt).toMatch(/^[^\u2013\u2014]{10,160}$/)
  }
  const directory = mkdtempSync(join(tmpdir(), 'lsu-imagery-'))
  try {
    expect(installImagery(directory)).toEqual(places)
    for (const place of places) expect(statSync(join(directory, 'imagery', `${place}.webp`)).size).toBeGreaterThan(20_000)
    const imagery = product.identity.imagery
    const files = product.assets.imagery
    expect(() => installImagery(directory, imagery, { ...files, today: undefined as unknown as string })).toThrow('names a photograph for today with no file')
    expect(() => installImagery(directory, { start: imagery.start }, files)).toThrow('ships a photograph for signIn')
    expect(() => installImagery(directory, { ...imagery, start: { src: 'https://elsewhere.example/a.webp' } }, files)).toThrow('identity.imagery.start.src must be /assets/native-product/imagery/start.webp')
    expect(() => installImagery(directory, imagery, { ...files, start: '../public/assets/lsu/images/missing.webp' })).toThrow('is not a WebP file in this repository')
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
})

it('arranges the app as the coaching design does: its own tabs, the heart beside More, the rest inside it', () => {
  // "LSU Coaching App - Entwurf v2": Heute, Woche, Übungen and Backyard along the bottom. The
  // profile keeps its tab (notifications live there), Health is the heart left of More, and
  // Progress and Workouts open from More, so nothing the app had is without a way in.
  expect(product.identity.navigation).toEqual({ tabs: ['today', 'week', 'exercises', 'backyard', 'me'], bar: ['health'], menu: ['progress', 'workouts'] })
  const places = [...product.identity.navigation.tabs, ...product.identity.navigation.bar, ...product.identity.navigation.menu]
  for (const place of ['today', 'workouts', 'progress', 'health', 'me']) expect(places).toContain(place)
  expect(new Set(places).size).toBe(places.length)
  // The acceptance journey walks the same arrangement on a phone.
  const journey = readFileSync(join(root, 'scripts/test-native-ios.ts'), 'utf8')
  expect(journey).toContain("tabs: ['Today', 'Week', 'Exercises', 'Backyard', 'Me'].map(title => ({ title, url: '' }))")
  for (const step of ["{ command: 'tab', text: 'Week' }", "{ command: 'tab', text: 'Exercises' }", "{ command: 'tab', text: 'Backyard' }", "{ command: 'tapid', text: 'nav-health' }", "{ command: 'tapid', text: 'nav-more' }, { command: 'tapexact', text: 'Progress' }"]) expect(journey).toContain(step)
})

it('opens the app on LSU\'s start screen, in German and in English', () => {
  const { de, en } = product.identity.start
  expect([de.headline, de.accent]).toEqual(['Dein Plan bis zur', 'letzten Runde.'])
  expect([en.headline, en.accent]).toEqual(['Your plan to the', 'last loop.'])
  expect(de.text).toBe('Laufen, Kraft, Mobility und Kopf. Woche für Woche, angepasst an dein Feedback per Sprachnachricht.')
  expect(de.tags).toEqual(['Backyard', 'Trail', 'Marathon', 'Halbmarathon', '10 km'])
  expect(en.tags).toEqual(['Backyard', 'Trail', 'Marathon', 'Half marathon', '10 km'])
  for (const copy of [de, en]) {
    expect(copy.eyebrow).toBe('Coaching')
    expect(copy.cards.map(card => card.title)).toEqual(['the rappid team', 'lastsoulultra.com'])
    expect(copy.cards[1]!.url).toBe('https://www.lastsoulultra.com')
    // No promise the tiers do not keep: the presets add no trial, so no "free month" here.
    expect(JSON.stringify(copy)).not.toMatch(/kostenlos|gratis|free month|[\u2013\u2014]/i)
  }
})

it('draws the launch splash with ts-images’ preset from the wordmark, on the near-black the app opens on', async () => {
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
