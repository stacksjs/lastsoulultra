import { expect, it } from 'bun:test'
import product from '../native/product.json'
import source from '../native/hq-source.json'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pantry from '../pantry.json'
import { assertInstalledKit, assertSourceLock, nativeBuildEnvironment, manifestPath } from '../scripts/native-source'

it('requires an exact HQ platform release, its commit and the pinned Bun runtime', () => {
  expect(() => assertSourceLock(source)).not.toThrow()
  expect(() => assertSourceLock({ ...source, revision: 'main' })).toThrow('exact @hq/platform version')
  expect(() => assertSourceLock({ ...source, version: '^1.0.0' })).toThrow('exact @hq/platform version')
  expect(() => assertSourceLock({ ...source, package: '@other/platform' })).toThrow('exact @hq/platform version')
  expect(() => assertSourceLock({ ...source, bun: '0.0.0' })).toThrow('Native builds require Bun')
})

it('installs the pinned kit from the Pantry registry only, never a same-named public package', () => {
  expect((pantry.dependencies as Record<string, string>)[source.package]).toBe(source.version)
  expect((pantry as { scopes?: Record<string, string> }).scopes?.['@hq']).toBe('pantry')
})

it('builds only from the installed kit the pin names', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lsu-kit-'))
  try {
    expect(() => assertInstalledKit(directory)).toThrow('Install the HQ platform kit first')
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'platform.json'), JSON.stringify({ ...source, revision: 'f'.repeat(40) }))
    expect(() => assertInstalledKit(directory)).toThrow('not the one native/hq-source.json pins')
    writeFileSync(join(directory, 'platform.json'), JSON.stringify(source))
    expect(() => assertInstalledKit(directory)).not.toThrow()
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
})

it('builds with LSU identity and removes local native overrides from the release environment', () => {
  const previous = process.env.HQ_WHITE_LABEL
  const previousSecrets = { key: process.env.CLOUDFLARE_API_TOKEN, database: process.env.LSU_TRAINING_DB_PASSWORD }
  process.env.HQ_WHITE_LABEL = '/unrelated/gym.json'
  process.env.CLOUDFLARE_API_TOKEN = 'deployment-only-sentinel'
  process.env.LSU_TRAINING_DB_PASSWORD = 'database-only-sentinel'
  try {
    const env = nativeBuildEnvironment()
    expect(env.HQ_NATIVE_PRODUCT).toBe(manifestPath)
    expect(env.HQ_WHITE_LABEL).toBeUndefined()
    expect(env.NODE_ENV).toBe('production')
    expect(product.bundleId).toBe('com.lastsoulultra.app')
    expect(product.identity.scheme).toBe('lastsoulultra')
    expect(product.site).toBe('https://training.lsu.stacksjs.com')
    expect(env.STX_PUBLIC_API_URL).toBe('https://training.lsu.stacksjs.com/api')
    expect(env.LSU_TRAINING_DB_PASSWORD).toBeUndefined()
    expect(env.CLOUDFLARE_API_TOKEN).toBeUndefined()
  }
  finally {
    if (previous === undefined) delete process.env.HQ_WHITE_LABEL
    else process.env.HQ_WHITE_LABEL = previous
    if (previousSecrets.key === undefined) delete process.env.CLOUDFLARE_API_TOKEN
    else process.env.CLOUDFLARE_API_TOKEN = previousSecrets.key
    if (previousSecrets.database === undefined) delete process.env.LSU_TRAINING_DB_PASSWORD
    else process.env.LSU_TRAINING_DB_PASSWORD = previousSecrets.database
  }
})
