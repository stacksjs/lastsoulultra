import { expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bumpedVersion, committedNotes, lastDelivered, nextBuild, pinFromKit, releaseOf, releaseTag, withCraft, withPinnedKit, withRelease } from '../scripts/native-release'
import { ACCEPTANCE_STEP, AVAILABILITY_STEP, mayUpload, RUN_TITLES, type RunStep, uploadsInFlight } from '../scripts/testflight-runs'

it('keeps the marketing version for a build and moves it through bumpx otherwise', () => {
  expect(bumpedVersion('1.0.0', 'build')).toBe('1.0.0')
  expect(bumpedVersion('1.0.0', 'patch')).toBe('1.0.1')
  expect(bumpedVersion('1.4.2', 'minor')).toBe('1.5.0')
  expect(bumpedVersion('1.4.2', 'major')).toBe('2.0.0')
  expect(bumpedVersion('1.0.0', '1.2.0')).toBe('1.2.0')
  expect(() => bumpedVersion('1.0.0', 'prerelease')).toThrow('--bump takes')
  expect(() => bumpedVersion('1.0', 'build')).toThrow('x.y.z')
})

it('never reuses a build number, whichever version it was uploaded under', () => {
  expect(nextBuild(18, [])).toBe(19)
  expect(nextBuild(18, ['v1.0.0-build.3', 'v0.70.53', ''])).toBe(19)
  // A tag ahead of product.json: a release whose commit was reverted still spent its number.
  expect(nextBuild(18, ['v1.0.0-build.21', 'v1.1.0-build.20'])).toBe(22)
  expect(() => nextBuild(1.5, [])).toThrow('whole build number')
  expect(releaseTag('1.0.0', 19)).toBe('v1.0.0-build.19')
})

it('changes only the version and build lines of product.json', () => {
  const source = readFileSync(new URL('../native/product.json', import.meta.url), 'utf8')
  const product = JSON.parse(source)
  const next = withRelease(source, '1.1.0', product.build + 1)
  expect(JSON.parse(next)).toEqual({ ...product, version: '1.1.0', build: product.build + 1 })
  const changed = next.split('\n').filter((line, index) => line !== source.split('\n')[index])
  expect(changed).toEqual(['  "version": "1.1.0",', `  "build": ${product.build + 1},`])
  // A nested "version" (policyVersions, schemaVersion) is not the app's.
  expect(next).toContain('"schemaVersion": 1')
  expect(() => withRelease('{}', '1.0.0', 1)).toThrow('top-level')
})

it('reads the notes a release commit carries, per TestFlight locale', () => {
  const root = mkdtempSync(join(tmpdir(), 'lsu-notes-'))
  try {
    expect(committedNotes(root)).toEqual({})
    mkdirSync(join(root, 'native/TestFlight'), { recursive: true })
    writeFileSync(join(root, 'native/TestFlight/WhatToTest.en-US.txt'), 'New calendar header\n')
    writeFileSync(join(root, 'native/TestFlight/WhatToTest.de-DE.txt'), 'Neue Kopfzeile\n')
    writeFileSync(join(root, 'native/TestFlight/WhatToTest.fr-FR.txt'), '  \n')
    writeFileSync(join(root, 'native/TestFlight/README.md'), 'not notes')
    expect(committedNotes(root)).toEqual({ 'de-DE': 'Neue Kopfzeile', 'en-US': 'New calendar header' })
  }
  finally { rmSync(root, { recursive: true, force: true }) }
})

it('recognises its own release commits and nothing else', () => {
  expect(releaseOf('chore(release): v1.0.0-build.19')).toEqual({ version: '1.0.0', build: 19 })
  expect(releaseOf('feat(native): release TestFlight build 18 on HQ platform kit 1.0.4122')).toBeNull()
  expect(releaseOf('chore(release): v0.70.53')).toBeNull()
})

it('pins a kit from what the kit says about itself', () => {
  const kit = { package: '@hq/platform', version: '1.0.4122', revision: 'a'.repeat(40), bun: '1.4.4' }
  expect(pinFromKit({ ...kit, protocol: {} } as any, '1.0.4122')).toEqual(kit)
  expect(() => pinFromKit(kit, '1.0.4123')).toThrow('the registry installed 1.0.4122')
  expect(() => pinFromKit({ ...kit, revision: 'abc' }, '1.0.4122')).toThrow('names no HQ commit')
  expect(() => pinFromKit({ ...kit, package: '@other/kit' }, '1.0.4122')).toThrow('not @hq/platform')
  const pantry = readFileSync(new URL('../pantry.json', import.meta.url), 'utf8')
  const pinned = JSON.parse(withPinnedKit(pantry, '1.0.9999', '1.5.0'))
  expect(pinned.dependencies).toMatchObject({ '@hq/platform': '1.0.9999', 'bun.sh': '1.5.0' })
  expect(pinned.scopes).toEqual(JSON.parse(pantry).scopes)
})

it('moves only the Craft overrides to the version the kit locks', () => {
  const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  const next = JSON.parse(withCraft(pkg, '0.0.999'))
  expect(next.overrides).toMatchObject({ 'craft-native': '0.0.999', '@craft-native/ios': '0.0.999', '@craft-native/android': '0.0.999' })
  expect({ ...next.overrides, 'craft-native': '', '@craft-native/ios': '', '@craft-native/android': '' })
    .toEqual({ ...JSON.parse(pkg).overrides, 'craft-native': '', '@craft-native/ios': '', '@craft-native/android': '' })
  expect(() => withCraft(pkg, '^0.0.490')).toThrow('exact Craft version')
})

it('offers the release as HQ does: one command, a build by default', () => {
  const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts
  expect(scripts['release:build']).toBe('bun scripts/release-native.ts --bump build')
  // `release:patch` is a new build, as in HQ: a semver patch of the website's
  // package once tagged this repository v0.70.53.
  expect(scripts['release:patch']).toBe(scripts['release:build'])
  expect(Object.values(scripts).join('\n')).not.toContain('buddy release')
})

it('keeps package.json at the release product.json is at, for bumpx to find the previous tag', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const product = JSON.parse(readFileSync(new URL('../native/product.json', import.meta.url), 'utf8'))
  expect(pkg.version).toBe(`${product.version}-build.${product.build}`)
  // The fix for a doubled changelog and a tag carrying another release's notes.
  const [, minor, patch] = pkg.overrides['@stacksjs/bumpx'].split('.').map(Number)
  expect(minor * 1000 + patch).toBeGreaterThanOrEqual(2033)
})

it('gives the tag\'s GitHub release its section of the changelog', () => {
  const workflow = Bun.YAML.parse(readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')) as any
  const step = workflow.jobs.release.steps.find((candidate: any) => candidate.uses?.startsWith('stacksjs/action-releaser@'))
  expect(step.with).toEqual({ changelog: 'CHANGELOG.md' })
  expect(workflow.jobs.release.steps[0].with['fetch-depth']).toBe(0)
  // Every release in the changelog opens with the line the releaser looks for.
  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
  const product = JSON.parse(readFileSync(new URL('../native/product.json', import.meta.url), 'utf8'))
  expect(changelog.split('\n').some(line => line.startsWith('[Compare changes]') && line.includes(`...v${product.version}-build.${product.build})`))).toBe(true)
  expect(changelog.match(/^# /gm)).toHaveLength(1)
})

// The TestFlight workflow's runs on 2026-11-10, newest first, as GitHub listed
// them and with the steps it reported: builds 20 and 21 were released and
// built and never uploaded, 19 arrived through a re-check of a slow upload.
const UPLOAD_STEP = 'Verify, sign and upload the prepared application'
const steps = (acceptance: string | null, upload: string | null, availability: string | null): RunStep[] => [
  { name: 'Build the complete native app from the HQ platform kit', conclusion: 'success' },
  { name: ACCEPTANCE_STEP, conclusion: acceptance },
  { name: UPLOAD_STEP, conclusion: upload },
  { name: AVAILABILITY_STEP, conclusion: availability },
]
const history = [
  { id: 'site', build: 22, event: 'workflow_run', status: 'completed', conclusion: 'skipped', steps: [] },
  { id: 'release 22', build: 22, event: 'workflow_run', status: 'completed', conclusion: 'success', steps: steps('success', 'success', 'success') },
  { id: 'hold', build: 21, event: 'workflow_run', status: 'completed', conclusion: 'skipped', steps: [] },
  // Accepted, then refused at upload: the backend had moved to another kit.
  { id: 'release 21', build: 21, event: 'workflow_run', status: 'completed', conclusion: 'failure', steps: steps('success', 'failure', 'skipped') },
  { id: 'waiting', build: 20, event: 'workflow_run', status: 'completed', conclusion: 'cancelled', steps: [] },
  { id: 'by hand 20', build: 20, event: 'workflow_dispatch', status: 'completed', conclusion: 'failure', steps: steps('success', 'failure', 'skipped') },
  // The kit had removed a row the acceptance script tapped.
  { id: 'release 20', build: 20, event: 'workflow_run', status: 'completed', conclusion: 'failure', steps: steps('failure', 'skipped', 'skipped') },
  { id: 're-check 19', build: 19, event: 'workflow_dispatch', status: 'completed', conclusion: 'success', steps: [{ name: 'Fetch the earlier run\'s upload receipt', conclusion: 'success' }, { name: AVAILABILITY_STEP, conclusion: 'success' }] },
  // Uploaded, and Apple was slower than the run waited.
  { id: 'release 19', build: 19, event: 'workflow_run', status: 'completed', conclusion: 'failure', steps: steps('success', 'success', 'failure') },
  { id: 'by hand 18', build: 18, event: 'workflow_dispatch', status: 'completed', conclusion: 'success', steps: steps('success', 'success', 'success') },
]
type Past = typeof history[number]
const stepsOf = (run: Past) => run.steps

it('takes the last build testers were given, not the last one released', () => {
  expect(lastDelivered(history, stepsOf)?.id).toBe('release 22')
  // As build 22 was being released: 20 and 21 had reached nobody, so its notes
  // belonged on top of 19, which a re-check had delivered.
  expect(lastDelivered(history.slice(2), stepsOf)?.id).toBe('re-check 19')
  // Before that re-check, 19 was with Apple and its notes were not set.
  expect(lastDelivered(history.slice(8), stepsOf)?.id).toBe('by hand 18')
  expect(lastDelivered([], stepsOf)).toBeNull()
})

it('passes over a successful run that uploaded nothing', () => {
  const acceptanceOnly = { id: 'acceptance', build: 22, event: 'workflow_dispatch', status: 'completed', conclusion: 'success', steps: steps('success', 'skipped', 'skipped') }
  const running = { id: 'running', build: 23, event: 'workflow_run', status: 'in_progress', conclusion: '', steps: [] }
  expect(lastDelivered([running, acceptanceOnly, ...history.slice(2)], stepsOf)?.id).toBe('re-check 19')
})

it('asks GitHub about successful runs only, and about few of them', () => {
  const asked: string[] = []
  const counting = (run: Past) => {
    asked.push(run.id)
    return run.steps
  }
  expect(lastDelivered(history.slice(2), counting)?.id).toBe('re-check 19')
  expect(asked).toEqual(['re-check 19'])
  // Nothing found within the allowance is "cannot tell", never a guess.
  const acceptanceOnly = { ...history[1]!, steps: steps('success', 'skipped', 'skipped') }
  asked.length = 0
  expect(lastDelivered([acceptanceOnly, acceptanceOnly, acceptanceOnly, ...history], counting, 2)).toBeNull()
  expect(asked).toHaveLength(2)
})

it('knows which runs can still upload a build', () => {
  expect(mayUpload({ displayTitle: RUN_TITLES.release })).toBe(true)
  expect(mayUpload({ displayTitle: RUN_TITLES.upload })).toBe(true)
  expect(mayUpload({ displayTitle: RUN_TITLES.acceptance })).toBe(false)
  expect(mayUpload({ displayTitle: `${RUN_TITLES.recheck}42860894504` })).toBe(false)
  const runs = [
    { status: 'in_progress', displayTitle: RUN_TITLES.acceptance },
    { status: 'queued', displayTitle: RUN_TITLES.release },
    { status: 'completed', displayTitle: RUN_TITLES.upload },
  ]
  expect(uploadsInFlight(runs)).toEqual([runs[1]!])
})
