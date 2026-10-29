import { expect, it } from 'bun:test'
import product from '../native/product.json'
import source from '../native/hq-source.json'
import { assertSourceLock, nativeBuildEnvironment, manifestPath } from '../scripts/native-source'

it('requires immutable HQ source and the pinned Bun runtime', () => {
  expect(() => assertSourceLock(source)).not.toThrow()
  expect(() => assertSourceLock({ ...source, revision: 'main' })).toThrow('complete commit SHA')
  expect(() => assertSourceLock({ ...source, repository: 'https://example.com/hq.git' })).toThrow('complete commit SHA')
  expect(() => assertSourceLock({ ...source, bun: '0.0.0' })).toThrow('Native builds require Bun')
})

it('builds with LSU identity and removes local native overrides from the release environment', () => {
  const previous = process.env.HQ_WHITE_LABEL
  process.env.HQ_WHITE_LABEL = '/unrelated/gym.json'
  try {
    const env = nativeBuildEnvironment()
    expect(env.HQ_NATIVE_PRODUCT).toBe(manifestPath)
    expect(env.HQ_WHITE_LABEL).toBeUndefined()
    expect(env.NODE_ENV).toBe('production')
    expect(product.bundleId).toBe('com.lastsoulultra.app')
    expect(product.identity.scheme).toBe('lastsoulultra')
    expect(product.site).toBe('https://hq.training')
  }
  finally {
    if (previous === undefined) delete process.env.HQ_WHITE_LABEL
    else process.env.HQ_WHITE_LABEL = previous
  }
})
