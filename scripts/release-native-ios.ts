import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { join, dirname, delimiter } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import product from '../native/product.json'
import deployment from '../enterprise/deployment.json'
import source from '../native/hq-source.json'
import { root, output, sourceRoot } from './native-source'

const keyId = process.env.APP_STORE_CONNECT_KEY_ID
const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID
const keyPath = process.env.APP_STORE_CONNECT_PRIVATE_KEY_PATH
if (!keyId || !issuerId || !keyPath) throw new Error('Set APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID and APP_STORE_CONNECT_PRIVATE_KEY_PATH')
const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim()
if (dirty) throw new Error('Commit and push the release inputs before uploading to TestFlight')
const backendResponse = await fetch(`${product.site}/api/deployment`, { redirect: 'error', signal: AbortSignal.timeout(15000) })
if (!backendResponse.ok) throw new Error('The LSU enterprise backend is not ready for a native release')
const backend = await backendResponse.json() as { id?: string, origin?: string, source?: string, residency?: { country?: string, location?: string } }
if (backend.id !== deployment.id || backend.origin !== product.site || backend.source !== source.revision || backend.residency?.country !== deployment.residency.country || backend.residency?.location !== deployment.residency.location)
  throw new Error('Refusing to release an app connected to another installation or residency contract')
const run = async (args: string[], cwd = root) => {
  const child = Bun.spawn(args, { cwd, env: { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH || ''}` }, stdout: 'inherit', stderr: 'inherit' })
  if (await child.exited !== 0) throw new Error(`Native release failed: ${args[0]}`)
}
if (process.argv.includes('--prepared')) {
  const receipt = JSON.parse(readFileSync(join(output, 'ios/lsu-source.json'), 'utf8'))
  const sha256 = (path: string) => new Bun.CryptoHasher('sha256').update(readFileSync(path)).digest('hex')
  if (receipt.platform !== 'ios' || receipt.app !== product.bundleId || receipt.version !== product.version || receipt.build !== product.build
    || receipt.hqRevision !== source.revision || receipt.productSha256 !== sha256(join(root, 'native/product.json'))
    || receipt.hqLockSha256 !== sha256(join(sourceRoot, 'bun.lock')) || !/^[a-f0-9]{40}$/.test(receipt.lsuRevision || ''))
    throw new Error('Prepared iOS source does not match the current release inputs')
  execFileSync('git', ['merge-base', '--is-ancestor', receipt.lsuRevision, 'HEAD'], { cwd: root })
  const changed = execFileSync('git', ['diff', '--name-only', receipt.lsuRevision, 'HEAD', '--', 'native', 'scripts/native-source.ts', 'scripts/build-native.ts', 'scripts/restore-ios-shell.ts', 'public/assets/lsu/images/lsu-logo.svg'], { cwd: root, encoding: 'utf8' }).trim()
  if (changed) throw new Error('Regenerate iOS after changing native build inputs')
}
else await run([process.execPath, 'run', 'native:ios'])
await run([process.execPath, 'run', 'native:verify-ios'])
const ios = join(output, 'ios')
const scheme = 'LastSoulUltra'
const appProfile = process.env.IOS_APP_PROFILE || 'Last Soul Ultra App Store'
const activityProfile = process.env.IOS_ACTIVITY_PROFILE || 'Last Soul Ultra Live Activity App Store'
const yamlPath = join(ios, 'project.yml')
let yaml = readFileSync(yamlPath, 'utf8')
yaml = yaml.replace(/^ {6}(?:CODE_SIGN_STYLE|CODE_SIGN_IDENTITY|PROVISIONING_PROFILE_SPECIFIER):[^\n]*\n/gm, '')
for (const [bundle, profile] of [[product.bundleId, appProfile], [`${product.bundleId}.liveactivity`, activityProfile]]) {
  const line = `      PRODUCT_BUNDLE_IDENTIFIER: ${bundle}\n`
  if (!yaml.includes(line)) throw new Error(`Generated project is missing ${bundle}`)
  yaml = yaml.replace(line, `${line}      CODE_SIGN_STYLE: Manual\n      CODE_SIGN_IDENTITY: "Apple Distribution"\n      PROVISIONING_PROFILE_SPECIFIER: ${JSON.stringify(profile)}\n`)
}
writeFileSync(yamlPath, yaml)
const require = createRequire(join(sourceRoot, 'package.json'))
const tools = await import(pathToFileURL(require.resolve('@stacksjs/actions/build/ios-toolchain')).href)
tools.generateXcodeProject(await tools.resolveXcodegen(sourceRoot), ios)
const releaseDir = join(root, 'storage/native/release', `${product.version}-${product.build}`)
mkdirSync(releaseDir, { recursive: true })
const archive = join(releaseDir, `${scheme}.xcarchive`)
await run(['xcodebuild', '-project', join(ios, `${scheme}.xcodeproj`), '-scheme', scheme, '-configuration', 'Release', '-destination', 'generic/platform=iOS', '-archivePath', archive, 'archive'], ios)
const infoPath = join(archive, 'Products/Applications', `${scheme}.app/Info.plist`)
const info = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', infoPath], { encoding: 'utf8' }))
if (info.CFBundleIdentifier !== product.bundleId || info.CFBundleVersion !== String(product.build) || info.CFBundleShortVersionString !== product.version)
  throw new Error('Archived identity does not match the LSU release')
const xml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const options = join(releaseDir, 'ExportOptions.plist')
writeFileSync(options, `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>method</key><string>app-store-connect</string><key>destination</key><string>export</string><key>signingStyle</key><string>manual</string><key>teamID</key><string>${product.teamId}</string><key>manageAppVersionAndBuildNumber</key><false/><key>provisioningProfiles</key><dict><key>${product.bundleId}</key><string>${xml(appProfile)}</string><key>${product.bundleId}.liveactivity</key><string>${xml(activityProfile)}</string></dict></dict></plist>`)
const exported = join(releaseDir, 'export')
await run(['xcodebuild', '-exportArchive', '-archivePath', archive, '-exportOptionsPlist', options, '-exportPath', exported], ios)
const ipas = readdirSync(exported).filter(name => name.endsWith('.ipa'))
if (ipas.length !== 1) throw new Error('Expected one exported LSU IPA')
const ipa = join(exported, ipas[0]!)
const auditDir = join(releaseDir, 'audit')
mkdirSync(auditDir, { recursive: true })
await run(['unzip', '-q', '-o', ipa, '-d', auditDir])
const app = join(auditDir, 'Payload', `${scheme}.app`)
await run(['codesign', '--verify', '--deep', '--strict', app])
const content = execFileSync('codesign', ['-d', '--entitlements', ':-', app], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
if (!content.includes(`${product.teamId}.${product.bundleId}`) || !content.includes('beta-reports-active')) throw new Error('IPA has no LSU App Store distribution identity')
// altool reads the existing key from its documented key search directory.
const privateKeyDir = join(releaseDir, 'private_keys')
mkdirSync(privateKeyDir, { recursive: true, mode: 0o700 })
writeFileSync(join(privateKeyDir, `AuthKey_${keyId}.p8`), readFileSync(keyPath), { mode: 0o600 })
try {
  await run(['xcrun', 'altool', '--upload-app', '--type', 'ios', '--file', ipa, '--apiKey', keyId, '--apiIssuer', issuerId], releaseDir)
}
finally { unlinkSync(join(privateKeyDir, `AuthKey_${keyId}.p8`)) }
writeFileSync(join(releaseDir, 'upload.json'), JSON.stringify({ app: product.bundleId, version: product.version, build: product.build, ipaSha256: new Bun.CryptoHasher('sha256').update(readFileSync(ipa)).digest('hex'), uploadedAt: new Date().toISOString() }, null, 2))
process.stdout.write(`Uploaded Last Soul Ultra ${product.version} (${product.build}); verify processing in App Store Connect before announcing TestFlight availability.\n`)
