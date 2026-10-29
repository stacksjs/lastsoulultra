import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, basename } from 'node:path'
import product from '../native/product.json'
import source from '../native/hq-source.json'
import { root, output, nativeBuildEnvironment } from './native-source'

const identityPath = process.env.LSU_ANDROID_SIGNING_CONFIG
if (!identityPath) throw new Error('Set LSU_ANDROID_SIGNING_CONFIG to the private signing identity JSON')
const identity = JSON.parse(readFileSync(identityPath, 'utf8')) as { keystore: string, alias: string, password: string }
if (!identity.keystore || !identity.alias || !identity.password || !existsSync(identity.keystore)) throw new Error('Incomplete Android signing identity')
const receipt = JSON.parse(readFileSync(join(output, 'android/lsu-source.json'), 'utf8'))
const productHash = new Bun.CryptoHasher('sha256').update(readFileSync(join(root, 'native/product.json'))).digest('hex')
if (receipt.platform !== 'android' || receipt.app !== product.bundleId || receipt.version !== product.version || receipt.build !== product.build || receipt.hqRevision !== source.revision || receipt.productSha256 !== productHash)
  throw new Error('Rebuild Android from the current LSU release inputs before signing')
const directory = join(output, 'android/app/build/outputs/apk/release')
const metadata = JSON.parse(readFileSync(join(directory, 'output-metadata.json'), 'utf8'))
const artifact = metadata.elements?.[0]
if (metadata.applicationId !== product.bundleId || metadata.elements?.length !== 1 || artifact.versionCode !== product.build || artifact.versionName !== product.version || basename(artifact.outputFile) !== artifact.outputFile)
  throw new Error('The APK identity does not match the LSU release')
const sdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || join(homedir(), process.platform === 'darwin' ? 'Library/Android/sdk' : 'Android/Sdk')
const versions = readdirSync(join(sdk, 'build-tools')).filter(version => /^\d+\.\d+\.\d+$/.test(version)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
if (!versions.length) throw new Error('Install Android SDK build tools before signing')
const tools = join(sdk, 'build-tools', versions.at(-1)!)
const inspection = Bun.spawnSync([join(tools, 'aapt'), 'dump', 'badging', join(directory, artifact.outputFile)], { env: nativeBuildEnvironment(), stdout: 'pipe', stderr: 'pipe' })
const manifest = inspection.stdout.toString().match(/^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/m)
if (inspection.exitCode !== 0 || manifest?.[1] !== product.bundleId || manifest?.[2] !== String(product.build) || manifest?.[3] !== product.version)
  throw new Error('The embedded APK manifest does not match the LSU release')
const release = join(root, 'storage/native/release', `${product.version}-${product.build}`, 'android')
mkdirSync(release, { recursive: true })
const signed = join(release, `LastSoulUltra-${product.version}-${product.build}.apk`)
const run = async (command: string[], signing = false) => {
  const child = Bun.spawn(command, { env: { ...nativeBuildEnvironment(), ...(signing ? { LSU_APK_SIGNING_PASSWORD: identity.password } : {}) }, stdout: 'inherit', stderr: 'inherit' })
  if (await child.exited !== 0) throw new Error('Android signing verification failed')
}
await run([join(tools, 'zipalign'), '-c', '-P', '16', '4', join(directory, artifact.outputFile)])
await run([join(tools, 'apksigner'), 'sign', '--ks', identity.keystore, '--ks-key-alias', identity.alias, '--ks-pass', 'env:LSU_APK_SIGNING_PASSWORD', '--key-pass', 'env:LSU_APK_SIGNING_PASSWORD', '--out', signed, join(directory, artifact.outputFile)], true)
await run([join(tools, 'apksigner'), 'verify', '--verbose', '--print-certs', signed])
await Bun.write(join(release, 'signing.json'), JSON.stringify({ app: product.bundleId, version: product.version, build: product.build, source: source.revision, apkSha256: new Bun.CryptoHasher('sha256').update(readFileSync(signed)).digest('hex'), signedAt: new Date().toISOString() }, null, 2))
console.log(`Signed and verified ${signed}`)
