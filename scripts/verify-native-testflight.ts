/** Confirm Apple's processing result using the release runner's existing upload credential. */
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import product from '../native/product.json'
import source from '../native/hq-source.json'
import { root, sourceRoot } from './native-source'

const require = createRequire(join(sourceRoot, 'package.json'))
const { AppStoreConnect, appStoreConnectCredentials, appStoreConnectToken } = await import(pathToFileURL(require.resolve('@stacksjs/buddy/app-store-connect')).href)
const credentials = appStoreConnectCredentials()
if (!credentials) throw new Error('TestFlight verification requires the existing App Store Connect upload credential')
const directory = join(root, 'storage/native/release', `${product.version}-${product.build}`)
const upload = await Bun.file(join(directory, 'upload.json')).json()
if (upload.app !== product.bundleId || upload.version !== product.version || upload.build !== product.build)
  throw new Error('The upload receipt does not match this release')
const api = await AppStoreConnect.connect(credentials)
const app = await api.appId(product.bundleId)
const deadline = Date.now() + 20 * 60_000
let previous = ''
while (Date.now() < deadline) {
  const build = await api.build(app, product.version, product.build)
  if (build?.expired || ['FAILED', 'INVALID'].includes(build?.processingState)) throw new Error('Apple rejected or expired this TestFlight build')
  let internalBuildState = ''
  let externalBuildState = ''
  if (build?.processingState === 'VALID') {
    // Apple's documented buildBetaDetail resource reports testing availability,
    // separately from a successful binary upload or processing result.
    const response = await fetch(`https://api.appstoreconnect.apple.com/v1/builds/${encodeURIComponent(build.id)}/buildBetaDetail`, {
      headers: { Authorization: `Bearer ${await appStoreConnectToken(credentials)}` }, signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`Apple beta availability request failed (${response.status})`)
    const detail = await response.json() as { data?: { attributes?: { internalBuildState?: string, externalBuildState?: string } } }
    internalBuildState = detail.data?.attributes?.internalBuildState || ''
    externalBuildState = detail.data?.attributes?.externalBuildState || ''
    if (['PROCESSING_EXCEPTION', 'EXPIRED', 'MISSING_EXPORT_COMPLIANCE'].includes(internalBuildState))
      throw new Error(`TestFlight needs attention: ${internalBuildState}`)
    if (['READY_FOR_BETA_TESTING', 'IN_BETA_TESTING'].includes(internalBuildState)) {
      await api.setWhatToTest(build.id, {
        'en-US': 'Try creating an account: enter only your email, then Continue. Existing HQ accounts connect through HQ sign-in, where you choose which data to share. You can also create a separate account. Try Describe it in New workout.',
        'de-DE': 'Teste die Registrierung: Gib zuerst nur deine E-Mail-Adresse ein und tippe auf Weiter. Bestehende HQ-Konten verbindest du über die HQ-Anmeldung. Dort wählst du die geteilten Daten. Du kannst auch ein separates Konto erstellen. Teste außerdem die Workout-Beschreibung bei einem neuen Workout.',
      })
      await Bun.write(join(directory, 'testflight.json'), `${JSON.stringify({ app: product.bundleId, version: product.version, build: product.build, hqSource: source.revision, buildId: build.id, processingState: build.processingState, internalBuildState, externalBuildState, uploadedDate: build.uploadedDate, verifiedAt: new Date().toISOString() }, null, 2)}\n`)
      process.stdout.write(`TestFlight ${product.version} (${product.build}) is processed and ready for internal testing (${internalBuildState}).\n`)
      process.exit(0)
    }
  }
  const state = `${build?.processingState || 'AWAITING_BUILD'} ${internalBuildState}`.trim()
  if (state !== previous) process.stdout.write(`Waiting for Apple: ${state}\n`)
  previous = state
  await Bun.sleep(15_000)
}
throw new Error('Apple has not made this build ready for TestFlight yet; rerun verification without uploading another binary')
