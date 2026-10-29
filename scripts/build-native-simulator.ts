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
execFileSync('xcodebuild', ['-project', join(output, 'ios/LastSoulUltra.xcodeproj'), '-scheme', 'LastSoulUltra', '-configuration', 'Release', '-sdk', 'iphonesimulator', '-destination', 'generic/platform=iOS Simulator', '-derivedDataPath', derived, '-jobs', '2', 'CODE_SIGNING_ALLOWED=NO', 'build'], { cwd: root, env: environment, stdio: 'inherit' })
const app = join(derived, 'Build/Products/Release-iphonesimulator/LastSoulUltra.app')
const zip = join(directory, 'LastSoulUltra-simulator.app.zip')
execFileSync('ditto', ['-c', '-k', '--keepParent', app, zip])
writeFileSync(join(directory, 'receipt.json'), JSON.stringify({ bundle: product.bundleId, version: product.version, build: product.build, hqSource: source.revision, artifactSha256: new Bun.CryptoHasher('sha256').update(await Bun.file(zip).arrayBuffer()).digest('hex') }, null, 2))
console.log(`Simulator artifact ready: ${zip}`)
