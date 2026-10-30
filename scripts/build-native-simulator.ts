import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import product from '../native/product.json'
import source from '../native/hq-source.json'
import { nativeBuildEnvironment, output, root } from './native-source'

const directory = join(root, 'storage/native/simulator', `${product.version}-${product.build}`)
mkdirSync(directory, { recursive: true })
const derived = join(directory, 'DerivedData')
const environment = { ...nativeBuildEnvironment(), PATH: `${dirname(process.execPath)}:${process.env.PATH || ''}` }
const productSha256 = new Bun.CryptoHasher('sha256').update(await Bun.file(join(root, 'native/product.json')).arrayBuffer()).digest('hex')
const prepared = await Bun.file(join(output, 'ios/lsu-source.json')).json()
if (prepared.hqRevision !== source.revision || prepared.productSha256 !== productSha256) throw new Error('Regenerate the native project from the current source and product before building acceptance')
execFileSync('xcodebuild', ['-project', join(output, 'ios/LastSoulUltra.xcodeproj'), '-scheme', 'LastSoulUltra', '-configuration', 'Release', '-sdk', 'iphonesimulator', '-destination', 'generic/platform=iOS Simulator', '-derivedDataPath', derived, '-jobs', '2', 'CODE_SIGNING_ALLOWED=YES', 'CODE_SIGNING_REQUIRED=YES', 'CODE_SIGN_IDENTITY=-', 'build'], { cwd: root, env: environment, stdio: 'inherit' })
const app = join(derived, 'Build/Products/Release-iphonesimulator/LastSoulUltra.app')
execFileSync('codesign', ['--verify', '--deep', '--strict', app])
const zip = join(directory, 'LastSoulUltra-simulator.app.zip')
execFileSync('ditto', ['-c', '-k', '--keepParent', app, zip])
writeFileSync(join(directory, 'receipt.json'), JSON.stringify({ bundle: product.bundleId, version: product.version, build: product.build, hqSource: source.revision, productSha256, simulatorSigning: 'ad-hoc', artifactSha256: new Bun.CryptoHasher('sha256').update(await Bun.file(zip).arrayBuffer()).digest('hex') }, null, 2))
console.log(`Simulator artifact ready: ${zip}`)
