import { appendFileSync, chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash, createPrivateKey, randomBytes } from 'node:crypto'
import { basename, dirname, join, resolve } from 'node:path'
import { appStoreConnectToken } from '@stacksjs/buddy/app-store-connect'
import product from '../native/product.json'
import { assertProfileAssociatedDomains, assertSigningProfile } from './ios-release-toolchain'
import { lsuAppStoreProfiles } from './ios-provisioning'

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_OS !== 'macOS')
  throw new Error('CI signing material is managed only on the ephemeral GitHub macOS runner')
const temporary = process.env.RUNNER_TEMP
const runId = process.env.GITHUB_RUN_ID
const attempt = process.env.GITHUB_RUN_ATTEMPT
if (!temporary || !/^\d+$/.test(runId || '') || !/^\d+$/.test(attempt || '')) throw new Error('Invalid CI signing directory inputs')
const directory = join(resolve(temporary), `lsu-ios-signing-${runId}-${attempt}`)
const statePath = join(directory, 'state.json')
const keychain = join(directory, 'signing.keychain-db')
const profileDirectories = [
  join(process.env.HOME!, 'Library/MobileDevice/Provisioning Profiles'),
  join(process.env.HOME!, 'Library/Developer/Xcode/UserData/Provisioning Profiles'),
]

function command(executable: string, args: string[]): string {
  const child = Bun.spawnSync([executable, ...args], { stdout: 'pipe', stderr: 'pipe' })
  if (child.exitCode !== 0) throw new Error(`${basename(executable)} failed while preparing LSU signing material (exit ${child.exitCode})`)
  return child.stdout.toString().trim()
}
function secret(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing release credential: ${name}`)
  return value
}
function privateFile(path: string, content: string | Uint8Array): void {
  writeFileSync(path, content, { mode: 0o600 })
  chmodSync(path, 0o600)
}

if (process.argv[2] === 'cleanup') {
  if (existsSync(statePath)) {
    const state = JSON.parse(readFileSync(statePath, 'utf8')) as { profiles: string[] }
    for (const path of state.profiles) {
      if (!profileDirectories.includes(dirname(resolve(path))) || !/^[a-f0-9-]{36}\.mobileprovision$/i.test(basename(path)))
        throw new Error('Refusing to remove an unrelated provisioning profile')
      rmSync(path, { force: true })
    }
    Bun.spawnSync(['/usr/bin/security', 'delete-keychain', keychain], { stdout: 'ignore', stderr: 'ignore' })
  }
  rmSync(directory, { recursive: true, force: true })
  console.log('Removed temporary LSU signing files and keychain')
}
else if (process.argv[2] === 'stage') {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  chmodSync(directory, 0o700)
  const state = { profiles: [] as string[] }
  const saveState = () => privateFile(statePath, JSON.stringify(state))
  saveState()
  const password = randomBytes(32).toString('base64url')
  console.log(`::add-mask::${password}`)
  command('/usr/bin/security', ['create-keychain', '-p', password, keychain])
  command('/usr/bin/security', ['set-keychain-settings', '-lut', '21600', keychain])
  command('/usr/bin/security', ['unlock-keychain', '-p', password, keychain])
  const certificate = join(directory, 'distribution.p12')
  privateFile(certificate, Buffer.from(secret('LSU_IOS_DISTRIBUTION_P12_BASE64'), 'base64'))
  command('/usr/bin/security', ['import', certificate, '-f', 'pkcs12', '-P', secret('LSU_IOS_DISTRIBUTION_PASSWORD'), '-T', '/usr/bin/codesign', '-T', '/usr/bin/security', '-t', 'cert', '-k', keychain])
  command('/usr/bin/security', ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', password, keychain])
  command('/usr/bin/security', ['list-keychains', '-d', 'user', '-s', keychain])
  const identities = command('/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning', keychain])
  if (!identities.includes(product.teamId))
    throw new Error('The expected LSU distribution identity is unavailable')
  const identity = identities.split('\n').find(line => line.includes(`(${product.teamId})`)) || ''
  const sha1 = /^\s*\d+\)\s+([A-F0-9]{40})\s+"(?:Apple Distribution|iPhone Distribution):[^\n]+"/.exec(identity)?.[1]
  if (!sha1) throw new Error('CI must import an existing Apple distribution private key')
  const apiKey = Buffer.from(secret('LSU_ASC_PRIVATE_KEY_BASE64'), 'base64').toString('utf8')
  if (createPrivateKey(apiKey).asymmetricKeyType !== 'ec') throw new Error('Invalid App Store Connect signing key')
  const keyId = secret('LSU_ASC_KEY_ID')
  const issuer = secret('LSU_ASC_ISSUER_ID')
  if (!/^[A-Z0-9]{8,20}$/.test(keyId) || !/^[a-f0-9-]{36}$/i.test(issuer)) throw new Error('Invalid App Store Connect key identity')
  const token = await appStoreConnectToken({ keyId, issuerId: issuer, privateKey: apiKey })
  const profiles = await lsuAppStoreProfiles(async (path, body) => {
    const response = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: 'error', signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { errors?: Array<{ code?: string, detail?: string }> }
      const detail = error.errors?.map(item => `${item.code || 'Apple error'}: ${item.detail || ''}`).join('; ').slice(0, 500) || ''
      throw new Error(`Apple provisioning ${body ? 'POST' : 'GET'} ${path} answered ${response.status}: ${detail}${response.status === 403 ? '; the existing CI key needs Certificates, Identifiers & Profiles access' : ''}`)
    }
    return response.json()
  }, { bundle: product.bundleId, certificateSha1: sha1 })
  const specifiers: Record<string, string> = {}
  for (const [bundle, refreshed] of Object.entries(profiles)) {
    const path = join(directory, `${bundle}.mobileprovision`)
    const plist = `${path}.plist`
    privateFile(path, Buffer.from(refreshed.content, 'base64'))
    privateFile(plist, command('/usr/bin/security', ['cms', '-D', '-i', path]))
    const field = (key: string) => command('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist])
    const profile = { uuid: field('UUID'), team: field('TeamIdentifier:0'), application: field('Entitlements:application-identifier') }
    assertSigningProfile(profile, bundle, product.teamId)
    const publicCertificate = command('/usr/bin/plutil', ['-extract', 'DeveloperCertificates.0', 'raw', '-o', '-', plist])
    if (profile.uuid !== refreshed.uuid || field('Entitlements:beta-reports-active') !== 'true'
      || createHash('sha1').update(Buffer.from(publicCertificate, 'base64')).digest('hex').toUpperCase() !== sha1)
      throw new Error('Refreshed App Store profile does not match the imported distribution identity')
    if (bundle === product.bundleId) {
      const permissions = JSON.parse(command('/usr/bin/plutil', ['-extract', 'Entitlements', 'json', '-o', '-', plist]))
      assertProfileAssociatedDomains(permissions['com.apple.developer.associated-domains'], product.site)
    }
    specifiers[bundle] = profile.uuid
    for (const parent of profileDirectories) {
      mkdirSync(parent, { recursive: true })
      const target = join(parent, `${profile.uuid}.mobileprovision`)
      state.profiles.push(target)
      saveState()
      copyFileSync(path, target)
      chmodSync(target, 0o600)
    }
  }
  const apiKeyPath = join(directory, 'api-key.p8')
  privateFile(apiKeyPath, apiKey)
  const environment = { APP_STORE_CONNECT_KEY_ID: keyId, APP_STORE_CONNECT_ISSUER_ID: issuer, APP_STORE_CONNECT_PRIVATE_KEY_PATH: apiKeyPath, LSU_IOS_DISTRIBUTION_SHA1: sha1, LSU_IOS_PROFILE_SPECIFIERS: JSON.stringify(specifiers) }
  for (const [name, value] of Object.entries(environment)) {
    if (/[\r\n]/.test(value)) throw new Error('Invalid release environment value')
    appendFileSync(secret('GITHUB_ENV'), `${name}=${value}\n`)
  }
  console.log('Prepared the LSU distribution identity, app profiles and upload credential')
}
else throw new Error('Use ios-ci-signing.ts stage or cleanup')
