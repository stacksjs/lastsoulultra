/** Confirm Apple's processing result using the release runner's existing upload credential. */
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import product from '../native/product.json'
import { readIosUploadReceipt } from './ios-release-provenance'
import { committedNotes } from './native-release'
import { root, sourceRoot } from './native-source'

/** `<release>/upload.json` anywhere under an unpacked artifact. */
function findReceipt(folder: string, release: string): string | null {
  if (!existsSync(folder)) return null
  for (const entry of readdirSync(folder, { recursive: true }) as string[]) {
    if (entry.replaceAll('\\', '/').endsWith(`${release}/upload.json`)) return join(folder, entry)
  }
  return null
}

const require = createRequire(join(sourceRoot, 'package.json'))
const { AppStoreConnect, appStoreConnectCredentials } = await import(pathToFileURL(require.resolve('@stacksjs/buddy/app-store-connect')).href)
const credentials = appStoreConnectCredentials()
if (!credentials) throw new Error('TestFlight verification requires the existing App Store Connect upload credential')
const directory = join(root, 'storage/native/release', `${product.version}-${product.build}`)
// A later run re-checking an earlier upload (`--receipts <folder>`) reads that
// run's saved receipt, wherever its artifact unpacked it.
const receipts = process.argv.indexOf('--receipts')
const receiptPath = receipts === -1 ? join(directory, 'upload.json') : findReceipt(resolve(root, process.argv[receipts + 1] || ''), `${product.version}-${product.build}`)
if (!receiptPath) throw new Error(`That run saved no upload receipt for ${product.version} (${product.build}); it did not upload this release`)
mkdirSync(directory, { recursive: true })
const upload = readIosUploadReceipt(await Bun.file(receiptPath).json())
if (upload.app !== product.bundleId || upload.version !== product.version || upload.build !== product.build)
  throw new Error('The upload receipt does not match this release')
const notes = committedNotes(root)
const api = await AppStoreConnect.connect(credentials)
const app = await api.appId(product.bundleId)
const groupNames = (product as { testFlightGroups?: string[] }).testFlightGroups ?? []
const groups = await api.internalTestFlightGroups(app, groupNames)
// Apple usually lists a build within minutes; 20 was not always enough.
const deadline = Date.now() + 40 * 60_000
let previous = ''
let appliedBuild = ''
while (Date.now() < deadline) {
  const build = await api.build(app, product.version, product.build)
  if (build?.expired || ['FAILED', 'INVALID'].includes(build?.processingState)) throw new Error('Apple rejected or expired this TestFlight build')
  let internalBuildState = ''
  if (build?.processingState === 'VALID') {
    if (appliedBuild !== build.id) {
      await api.assignBuildToInternalGroups(app, build, groupNames)
      appliedBuild = build.id
    }
    const status = await api.testFlightStatus(build.id)
    internalBuildState = status.internalBuildState
    if (['PROCESSING_EXCEPTION', 'EXPIRED', 'MISSING_EXPORT_COMPLIANCE'].includes(internalBuildState))
      throw new Error(`TestFlight needs attention: ${internalBuildState}`)
    if (internalBuildState === 'IN_BETA_TESTING' && groups.every((group: { id: string }) => status.groupIds.includes(group.id))) {
      // What this build's release commit told testers (scripts/release-native.ts).
      // A build released without notes keeps whatever TestFlight shows.
      if (Object.keys(notes).length) await api.setWhatToTest(build.id, notes)
      await Bun.write(join(directory, 'testflight.json'), `${JSON.stringify({ app: product.bundleId, version: product.version, build: product.build, hqSource: upload.provenance?.hqRevision ?? null, hqPlatform: upload.provenance?.hqPlatform ?? null, lsuSource: upload.provenance?.lsuRevision ?? null, ipaSha256: upload.ipaSha256, provenance: upload.provenance, buildId: build.id, processingState: build.processingState, internalBuildState, groupIds: status.groupIds, uploadedDate: build.uploadedDate, verifiedAt: new Date().toISOString() }, null, 2)}\n`)
      process.stdout.write(`TestFlight ${product.version} (${product.build}) is processed and ready for internal testing (${internalBuildState}).\n`)
      process.exit(0)
    }
  }
  const state = `${build?.processingState || 'AWAITING_BUILD'} ${internalBuildState}`.trim()
  if (state !== previous) process.stdout.write(`Waiting for Apple: ${state}\n`)
  previous = state
  await Bun.sleep(15_000)
}
throw new Error('Apple has not made this build ready for TestFlight yet. The upload is with Apple, so do not upload again: re-check it with `gh workflow run testflight.yml --ref main -f verify_run=<this run id>`')
