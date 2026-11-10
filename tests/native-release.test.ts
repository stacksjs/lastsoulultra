import { expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bumpedVersion, committedNotes, nextBuild, pinFromKit, releaseOf, releaseTag, withCraft, withPinnedKit, withRelease } from '../scripts/native-release'

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
