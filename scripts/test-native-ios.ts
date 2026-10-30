import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import product from '../native/product.json'
import source from '../native/hq-source.json'
import { nativeBuildEnvironment, root, sourceRoot } from './native-source'
import { demoTier } from './lsu-demo-plan'

interface Account { key: string, name: string, email: string, password: string }
const accounts = JSON.parse(process.env.LSU_NATIVE_TEST_ACCOUNTS || '[]') as Account[]
const runner = accounts.find(account => account.key === 'runner')
const visitor = accounts.find(account => account.key === 'visitor')
if (!runner || !visitor || [runner, visitor].some(account => !account.email.endsWith('@lsu-demo.test') || !account.password))
  throw new Error('Native acceptance requires only the dedicated synthetic LSU runner and visitor')
async function firstRunState(account: Account): Promise<{ policies: boolean, welcome: boolean }> {
  const api = `${product.identity.apiOrigin}/api`
  const login = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: account.email, password: account.password }), signal: AbortSignal.timeout(30_000) })
  const answer = await login.json() as any
  if (!login.ok || !answer.token) throw new Error(`The dedicated ${account.key} fixture cannot sign in to LSU`)
  const headers = { Authorization: `Bearer ${answer.token}` }
  try {
    const response = await fetch(`${api}/auth/me`, { headers, signal: AbortSignal.timeout(30_000) })
    const profile = await response.json() as any
    if (!response.ok || profile.name !== account.name || typeof profile.policies?.due !== 'boolean' || typeof profile.onboarding?.due !== 'boolean')
      throw new Error(`The dedicated ${account.key} fixture has unexpected account state`)
    return { policies: profile.policies.due, welcome: profile.onboarding.due }
  }
  finally { await fetch(`${api}/auth/logout`, { method: 'POST', headers, signal: AbortSignal.timeout(30_000) }) }
}
const firstRuns = new Map(await Promise.all([runner, visitor].map(async account => [account.key, await firstRunState(account)] as const)))
const require = createRequire(join(sourceRoot, 'package.json'))
const kit = await import(pathToFileURL(require.resolve('@stacksjs/mobile/testing')).href)
const artifact = resolve(process.argv[2] || join(root, `storage/native/simulator/${product.version}-${product.build}/LastSoulUltra-simulator.app.zip`))
const evidence = join(root, 'storage/native/acceptance', `${product.version}-${product.build}`)
const receipt = await Bun.file(join(dirname(artifact), 'receipt.json')).json()
const artifactSha256 = new Bun.CryptoHasher('sha256').update(await Bun.file(artifact).arrayBuffer()).digest('hex')
const productSha256 = new Bun.CryptoHasher('sha256').update(await Bun.file(join(root, 'native/product.json')).arrayBuffer()).digest('hex')
if (receipt.hqSource !== source.revision || receipt.productSha256 !== productSha256 || receipt.simulatorSigning !== 'ad-hoc' || receipt.bundle !== product.bundleId || receipt.version !== product.version || receipt.build !== product.build || receipt.artifactSha256 !== artifactSha256)
  throw new Error('Downloaded application does not match its release source and checksum receipt')
mkdirSync(evidence, { recursive: true, mode: 0o700 })
chmodSync(evidence, 0o700)
const previous = join(evidence, 'previous', String(Date.now()))
for (const name of readdirSync(evidence)) {
  if (/^lsu-[a-z-]+\.(png|txt)$/.test(name) || ['result.json', 'native-diagnostics.log'].includes(name)) {
    mkdirSync(previous, { recursive: true, mode: 0o700 })
    renameSync(join(evidence, name), join(previous, name))
  }
}
if (process.env.GITHUB_ACTIONS === 'true') for (const account of [runner, visitor]) console.log(`::add-mask::${account.password}`)
const info = JSON.parse(execFileSync('xcrun', ['simctl', 'list', '--json'], { encoding: 'utf8' }))
const runtime = info.runtimes.find((item: any) => item.isAvailable && item.identifier.includes('iOS'))
const device = info.devicetypes.find((item: any) => item.name.includes('iPhone 17 Pro') && !item.name.includes('Max'))
if (!runtime || !device) throw new Error('Install an available iPhone simulator runtime')
let simulator = ''
let child: ReturnType<typeof Bun.spawn> | undefined
const environment = nativeBuildEnvironment()
function redact(text: string): string {
  return text.split('\n').map(line => /\bType\s+'.*\binto\b/.test(line) ? '[XCUITest text entry redacted]' : line.replaceAll(runner!.password, '[redacted]').replaceAll(visitor!.password, '[redacted]')).join('\n')
}
async function relay(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder()
  let pending = ''
  for await (const chunk of stream) {
    pending += decoder.decode(chunk, { stream: true })
    const newline = pending.lastIndexOf('\n')
    if (newline >= 0) { process.stdout.write(redact(pending.slice(0, newline + 1))); pending = pending.slice(newline + 1) }
  }
  if (pending) process.stdout.write(redact(pending))
}
async function run(args: string[], cwd = root, timeout = 20 * 60_000) {
  child = Bun.spawn(args, { cwd, env: environment, stdout: 'pipe', stderr: 'pipe' })
  const output = Promise.all([relay(child.stdout as ReadableStream<Uint8Array>), relay(child.stderr as ReadableStream<Uint8Array>)])
  const timer = setTimeout(() => child?.kill(), timeout)
  try { const status = await child.exited; await output; if (status !== 0) throw new Error(`Native acceptance failed: ${args[0]}`) }
  finally { clearTimeout(timer); child = undefined }
}
const steps: any[] = []
function declineOptionalPrompts(): any[] {
  // Password saving and the app's notification offer can both say Not Now.
  // The password sheet can arrive after the screen beneath it. tapif chooses
  // a hittable indexed match, avoiding an ambiguous text-only button query.
  return [...Array.from({ length: 3 }, () => [{ command: 'wait', seconds: 1 }, { command: 'tapif', text: 'Not Now' }]).flat(), { command: 'ifid', id: 'nav-not-now', step: { command: 'tapid', text: 'nav-not-now' } }]
}
function signIn(account: Account) {
  const firstRun = firstRuns.get(account.key)!
  // Launch and sign-out already present Login. Opening another deep link here
  // would create a second entry screen in a different tab's retained stack.
  steps.push({ command: 'expectid', text: 'login-email', seconds: 30 }, { command: 'typeid', id: 'login-email', text: account.email }, { command: 'typeid', id: 'login-password', text: account.password }, { command: 'return' }, { command: 'wait', seconds: 2 }, { command: 'shot', name: 'lsu-after-sign-in' }, { command: 'tree', name: 'lsu-after-sign-in' })
  if (firstRun.policies) {
    steps.push({ command: 'expectid', text: 'agree-submit', seconds: 40 }, ...declineOptionalPrompts())
    for (const id of ['agree-health', 'agree-data']) steps.push({ command: 'scrollto', text: id }, { command: 'tapid', text: id })
    steps.push({ command: 'scrollto', text: 'agree-submit' }, { command: 'tapid', text: 'agree-submit' })
  }
  if (firstRun.welcome) steps.push({ command: 'expectid', text: 'welcome-skip', seconds: 40 }, ...declineOptionalPrompts(), { command: 'tapid', text: 'welcome-skip' })
  // iOS offers to save the password, and the app offers notifications, on
  // their own schedules after signing in; either can land on the other.
  steps.push(...Array.from({ length: 4 }, declineOptionalPrompts).flat(), { command: 'expectid', text: 'today-screen', seconds: 40 }, { command: 'tapif', text: 'Not Now' })
}
steps.push({ command: 'launch' }, { command: 'openurl', url: `${product.identity.scheme}:///m/login` }, { command: 'expectid', text: 'login-logo', seconds: 30 }, { command: 'shot', name: 'lsu-sign-in' }, { command: 'tree', name: 'lsu-sign-in' })
signIn(runner)
steps.push({ command: 'shot', name: 'lsu-today' }, { command: 'tab', text: 'Workouts' }, { command: 'expectid', text: 'library-record-run', seconds: 30 }, { command: 'shot', name: 'lsu-workouts' }, { command: 'tab', text: 'Progress' }, { command: 'expectid', text: 'progress-screen', seconds: 30 }, { command: 'shot', name: 'lsu-progress' }, { command: 'tab', text: 'Health' }, { command: 'expectid', text: 'health-progress', seconds: 30 }, { command: 'shot', name: 'lsu-health' }, { command: 'tab', text: 'Me' }, { command: 'expect', text: runner.name, seconds: 30 }, { command: 'shot', name: 'lsu-me' }, { command: 'scrollto', text: 'me-coaching-accounts' }, { command: 'tapid', text: 'me-coaching-accounts' }, { command: 'expectid', text: 'coaching-accounts', seconds: 30 }, { command: 'absentid', text: 'coaching-accounts-error' }, { command: 'shot', name: 'lsu-coaching-accounts' }, { command: 'openurl', url: `${product.identity.scheme}:///m/calendar` }, { command: 'expectid', text: 'calendar-scope', seconds: 30 }, { command: 'shot', name: 'lsu-calendar' }, { command: 'tab', text: 'Me' }, { command: 'scrollto', text: 'me-sign-out' }, { command: 'tapid', text: 'me-sign-out' })
signIn(visitor)
steps.push({ command: 'tab', text: 'Me' }, { command: 'expect', text: visitor.name, seconds: 30 }, { command: 'absent', text: runner.name }, { command: 'shot', name: 'lsu-visitor-account' }, { command: 'scrollto', text: 'me-sign-out' }, { command: 'tapid', text: 'me-sign-out' }, { command: 'expectid', text: 'login-submit', seconds: 30 }, { command: 'shot', name: 'lsu-signed-out' })
const ownedCoachingShot = steps.findIndex(step => step.command === 'shot' && step.name === 'lsu-coaching-accounts')
steps.splice(ownedCoachingShot, 0, { command: 'expect', text: demoTier.name, seconds: 30 }, { command: 'absentid', text: 'coaching-accounts-empty' })
// A selected tab retains its navigation stack. Return from details before
// opening another screen or looking for controls on the Me root.
const calendarOpen = steps.findIndex(step => step.command === 'openurl' && step.url.endsWith('/m/calendar'))
steps.splice(calendarOpen, 0, { command: 'back' })
const calendarShot = steps.findIndex(step => step.command === 'shot' && step.name === 'lsu-calendar')
steps.splice(calendarShot + 1, 0, { command: 'back' })
// The rest of HQ's places, each by its app link: the same screens an HQ
// member reaches, drawn in LSU's identity. Each returns before the next.
const tour = [['settings', 'settings-name'], ['connections', 'connections-garmin-direct'], ['store', 'store-search'], ['plans', 'plans-website'], ['sharing', 'sharing-scroll'], ['notifications', 'notifications-list'], ['messages', 'messages-search']]
steps.splice(calendarShot + 2, 0, ...tour.flatMap(([path, id]) => [{ command: 'openurl', url: `${product.identity.scheme}:///m/${path}` }, ...declineOptionalPrompts(), { command: 'expectid', text: id, seconds: 30 }, { command: 'shot', name: `lsu-${path}` }, { command: 'back' }]))
const meShot = steps.findIndex(step => step.command === 'shot' && step.name === 'lsu-me')
steps.splice(meShot + 1, 0, { command: 'scrollto', text: 'me-membership-card' }, { command: 'tapid', text: 'me-membership-card' }, { command: 'expectid', text: 'membership-card-id', seconds: 30 }, { command: 'expect', text: 'LSU-' }, { command: 'expect', text: runner.name }, { command: 'shot', name: 'lsu-membership-card' }, { command: 'back' })
const coachingOpen = steps.findIndex(step => step.command === 'tapid' && step.text === 'me-coaching-accounts')
steps.splice(coachingOpen + 1, 0, { command: 'shot', name: 'lsu-coaching-opened' }, { command: 'tree', name: 'lsu-coaching-opened' })
const coachingReady = steps.findIndex(step => step.command === 'expectid' && step.text === 'coaching-accounts')
steps.splice(coachingReady, 0, ...declineOptionalPrompts())
const todayShot = steps.findIndex(step => step.command === 'shot' && step.name === 'lsu-today')
steps.splice(todayShot + 1, 0, { command: 'swipe', direction: 'up' }, { command: 'shot', name: 'lsu-today-scrolled' }, { command: 'tree', name: 'lsu-today-scrolled' })
for (let index = steps.length - 1; index >= 0; index--) {
  if (steps[index].command === 'tapid' && steps[index].text === 'me-sign-out')
    steps.splice(index + 1, 0, { command: 'tapexact', text: 'Sign out' }, { command: 'expectid', text: 'login-submit', seconds: 30 })
}
for (let index = steps.length - 1; index >= 0; index--) {
  if (steps[index].command === 'expectid' && steps[index].text === 'today-screen')
    steps.splice(index, 0, { command: 'shot', name: 'lsu-post-auth' }, { command: 'tree', name: 'lsu-post-auth' })
}
for (let index = steps.length - 1; index >= 0; index--) {
  // The notification offer can slide in over the previous screen after it
  // settled, so every tab switch first waits out and declines late prompts.
  if (steps[index].command === 'tab') steps.splice(index, 0, ...declineOptionalPrompts())
  if (steps[index].command === 'shot') steps.splice(index, 0, { command: 'expectapp', text: product.bundleId, seconds: 10 })
}
const script = kit.serializeSimulatorSteps(steps)
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
  const url = new URL(request.url)
  if (url.pathname === '/script') return new Response(script)
  if (url.pathname === '/note') { console.log(redact(await request.text())); return new Response('ok') }
  if (url.pathname === '/save') {
    const name = url.searchParams.get('name') || ''
    if (!/^lsu-[a-z-]+\.(png|txt)$/.test(name)) return new Response('Invalid evidence name', { status: 400 })
    if (name.endsWith('.txt')) await Bun.write(join(evidence, name), redact(await request.text()))
    else await Bun.write(join(evidence, name), await request.arrayBuffer())
    return new Response('ok')
  }
  return new Response('Not found', { status: 404 })
} })
try {
  const appDirectory = join(evidence, 'downloaded-app'); mkdirSync(appDirectory, { recursive: true })
  execFileSync('ditto', ['-x', '-k', artifact, appDirectory])
  const app = join(appDirectory, 'LastSoulUltra.app')
  const appInfo = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', join(app, 'Info.plist')], { encoding: 'utf8' }))
  if (appInfo.CFBundleIdentifier !== product.bundleId || appInfo.CFBundleVersion !== String(product.build) || appInfo.CFBundleShortVersionString !== product.version) throw new Error('Downloaded simulator application has the wrong identity')
  simulator = execFileSync('xcrun', ['simctl', 'create', `LSU Release ${product.build} Acceptance`, device.identifier, runtime.identifier], { encoding: 'utf8' }).trim()
  await run(['xcrun', 'simctl', 'boot', simulator], root, 120_000)
  await run(['xcrun', 'simctl', 'bootstatus', simulator, '-b'], root, 600_000)
  await run(['xcrun', 'simctl', 'install', simulator, app])
  if (process.env.LSU_NATIVE_DIAGNOSTICS === '1') await run(['xcrun', 'simctl', 'spawn', simulator, 'defaults', 'write', product.bundleId, 'CraftFramePacing', '-bool', 'YES'])
  const projectName = 'LSUAcceptance'
  const driver = kit.prepareIosSimulatorDriver({ appName: product.identity.name, bundleId: product.bundleId, tabs: ['Today', 'Workouts', 'Progress', 'Health', 'Me'].map(title => ({ title, url: '' })), simulator: { output: join(evidence, 'driver'), projectName, bundleIdPrefix: 'com.lastsoulultra.acceptance', controlUrl: `http://127.0.0.1:${server.port}` } }, root)
  const tools = await import(pathToFileURL(require.resolve('@stacksjs/actions/build/ios-toolchain')).href)
  tools.generateXcodeProject(await tools.resolveXcodegen(sourceRoot), driver.output)
  const args = ['xcodebuild', '-project', `${projectName}.xcodeproj`, '-scheme', projectName, '-configuration', 'Debug', '-destination', `platform=iOS Simulator,id=${simulator}`, '-derivedDataPath', join(evidence, 'DriverDerivedData'), '-parallel-testing-enabled', 'NO', '-jobs', '2']
  await run([...args, 'build-for-testing'], driver.output)
  await run([...args, '-resultBundlePath', join(evidence, `Acceptance-${Date.now()}.xcresult`), '-collect-test-diagnostics', 'never', 'test-without-building'], driver.output)
  writeFileSync(join(evidence, 'result.json'), JSON.stringify({ passed: true, version: product.version, build: product.build, hqSource: source.revision, bundle: product.bundleId, artifactSha256, scenarios: ['sign-in', 'five-tabs', 'branded-membership-card', 'calendar', 'hq-places', 'owned-coaching', 'account-switch', 'sign-out'] }, null, 2))
}
catch (error) {
  if (simulator) {
    try { execFileSync('xcrun', ['simctl', 'io', simulator, 'screenshot', join(evidence, 'lsu-failure.png')], { stdio: 'ignore', timeout: 15_000 }) }
    catch { /* Preserve the original test failure if its simulator has exited. */ }
  }
  throw error
}
finally {
  server.stop(true)
  if (simulator) {
    if (process.env.LSU_NATIVE_DIAGNOSTICS === '1') {
      try {
        const log = execFileSync('xcrun', ['simctl', 'spawn', simulator, 'log', 'show', '--last', '5m', '--info', '--debug', '--style', 'compact', '--predicate', 'process == "LastSoulUltra"'], { encoding: 'utf8', timeout: 30000 })
        writeFileSync(join(evidence, 'native-diagnostics.log'), redact(log), { mode: 0o600 })
      }
      catch { console.log('Native diagnostics were unavailable') }
    }
    Bun.spawnSync(['xcrun', 'simctl', 'shutdown', simulator], { stdout: 'ignore', stderr: 'ignore' })
    Bun.spawnSync(['xcrun', 'simctl', 'delete', simulator], { stdout: 'ignore', stderr: 'ignore' })
  }
}
