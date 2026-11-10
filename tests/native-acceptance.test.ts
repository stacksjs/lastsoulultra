import { expect, it } from 'bun:test'
import { ACCEPTANCE_INPUTS, acceptanceInputs, pushBefore } from '../scripts/native-acceptance'

it('runs acceptance for the kit pin, the acceptance script and the workflow that runs them', () => {
  expect(ACCEPTANCE_INPUTS).toEqual(['native/hq-source.json', 'scripts/test-native-ios.ts', '.github/workflows/testflight.yml'])
  expect(acceptanceInputs(['pantry.json', 'native/hq-source.json', 'package.json'])).toEqual(['native/hq-source.json'])
  expect(acceptanceInputs(['scripts/test-native-ios.ts\r', ' native/hq-source.json'])).toEqual(['native/hq-source.json', 'scripts/test-native-ios.ts'])
})

it('leaves every other push alone', () => {
  expect(acceptanceInputs([])).toEqual([])
  expect(acceptanceInputs([''])).toEqual([])
  // A release commit moves the build number and the notes, never the kit.
  expect(acceptanceInputs(['native/product.json', 'native/TestFlight/WhatToTest.en-US.txt', 'CHANGELOG.md', 'package.json'])).toEqual([])
  expect(acceptanceInputs(['resources/views/index.stx', 'scripts/test-native-ios.ts.bak', 'docs/native/hq-source.json'])).toEqual([])
})

it('finds where main was before the push a deploy was for', () => {
  const a = 'a'.repeat(40)
  const b = 'b'.repeat(40)
  const c = 'c'.repeat(40)
  const pushes = [{ before: b, after: c }, { before: a, after: b }]
  expect(pushBefore(pushes, c)).toBe(b)
  expect(pushBefore(pushes, b)).toBe(a)
  // Not the end of a push GitHub listed, or the push that created the branch.
  expect(pushBefore(pushes, a)).toBeNull()
  expect(pushBefore([{ before: '0'.repeat(40), after: a }], a)).toBeNull()
  expect(pushBefore([{ after: a }], a)).toBeNull()
  expect(pushBefore([], a)).toBeNull()
})
