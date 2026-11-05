import { expect, test } from 'bun:test'
import { createIosUploadReceipt, readIosUploadReceipt } from '../scripts/ios-release-provenance'

const build = { schemaVersion: 1, platform: 'ios', app: 'com.lastsoulultra.app', version: '1.0.0', build: 11, hqPlatform: '@hq/platform@1.0.3887', hqRevision: 'a'.repeat(40), hqLockSha256: 'b'.repeat(64), productSha256: 'c'.repeat(64), lsuRevision: 'd'.repeat(40), builtAt: '2026-11-05T00:00:00.000Z' }
const expected = { app: build.app, version: build.version, build: build.build, hqRevision: build.hqRevision, productSha256: build.productSha256 }

test('the serialized upload preserves the built kit after the checkout advances', () => {
  const saved = JSON.stringify(createIosUploadReceipt(build, 'e'.repeat(64), expected))
  const nextCheckout = { ...expected, hqRevision: 'f'.repeat(40) }
  const upload = readIosUploadReceipt(JSON.parse(saved))
  expect(upload.provenance?.hqRevision).toBe(build.hqRevision)
  expect(upload.provenance?.hqRevision).not.toBe(nextCheckout.hqRevision)
  expect(upload.provenance?.hqPlatform).toBe('@hq/platform@1.0.3887')
  expect(upload.provenance?.lsuRevision).toBe(build.lsuRevision)
  expect(upload.ipaSha256).toBe('e'.repeat(64))
})

test('an old upload remains verifiable with explicit unknown provenance', () => {
  const legacy = readIosUploadReceipt({ app: build.app, version: build.version, build: 11, ipaSha256: 'e'.repeat(64), uploadedAt: build.builtAt })
  expect(legacy.provenance).toBeNull()
  expect(legacy.schemaVersion).toBeNull()
})

test('release rejects stale or malformed build evidence before upload', () => {
  expect(() => createIosUploadReceipt(build, 'e'.repeat(64), { ...expected, build: 12 })).toThrow('release inputs')
  expect(() => createIosUploadReceipt(build, 'e'.repeat(64), { ...expected, hqRevision: 'f'.repeat(40) })).toThrow('release inputs')
  expect(() => createIosUploadReceipt({ ...build, lsuRevision: 'main' }, 'e'.repeat(64), expected)).toThrow('LSU source')
  expect(() => createIosUploadReceipt(build, 'not-a-hash', expected)).toThrow('IPA hash')
  const saved = createIosUploadReceipt(build, 'e'.repeat(64), expected)
  expect(() => readIosUploadReceipt({ ...saved, build: 12 })).toThrow('different binaries')
  expect(() => readIosUploadReceipt({ ...saved, provenance: null })).toThrow('missing build provenance')
})
