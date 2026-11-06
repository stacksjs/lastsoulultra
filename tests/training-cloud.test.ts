import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'bun:test'
import { trainingSites } from '../config/training-cloud'
import { kitAppRoot, kitQueues, undrainedQueues } from '../scripts/check-queues'
import { tsCloud } from '../config/cloud'
import deployment from '../enterprise/deployment.json'

it('keeps the enterprise installation off a shared host and pins provider placement', () => {
  expect(tsCloud.cloud?.attachTo).toBeUndefined()
  expect(tsCloud.cloud?.provider).toBe('hetzner')
  expect(tsCloud.hetzner?.location).toBe(deployment.residency.location)
  expect(tsCloud.cloud?.residency?.countries).toEqual([deployment.residency.country])
  expect(tsCloud.infrastructure?.appDatabase?.requireLocalPasswordAuth).toBe(true)
  expect(tsCloud.sites?.main?.env?.DB_DATABASE_PATH).toBe('/var/www/lastsoulultra-shared/website/database/preview.sqlite')
  expect(tsCloud.sites?.api?.env?.DB_DATABASE_PATH).toBe(tsCloud.sites?.main?.env?.DB_DATABASE_PATH)
  expect(tsCloud.sites?.main?.start).toStartWith('./pantry/.bin/bun ')
  expect(tsCloud.sites?.api?.start).toStartWith('./pantry/.bin/bun ')
  expect(tsCloud.sites?.main?.preStart).toContain('pantry install bun.sh@1.4.4 --no-save')
  expect(tsCloud.sites?.api?.preStart).toContain('pantry install bun.sh@1.4.4 --no-save')
  expect(trainingSites()['training-api'].backgroundBun).toBe('.hq-runtime/pantry/bun.com/v1.4.4/bin/bun')
  expect(trainingSites()['training-api'].daemons?.find(daemon => daemon.name === 'local-speech')?.command).toContain('COACHING_SPEECH_RUNTIME_DIR=/var/www/lastsoulultra-shared/training/speech')
  // Every queue the kit dispatches to has a worker. CI does not install the kit, so there this checks the
  // queues kit 1.0.3874 used; the deploy checks the installed kit itself (scripts/check-queues.ts).
  const queues = existsSync(kitAppRoot) ? kitQueues() : ['connection-events', 'connection-sync', 'default', 'exercise-media', 'garmin-direct', 'notifications', 'platform-history', 'platform-relay', 'webhooks']
  expect(undrainedQueues(queues)).toEqual([])
  for (const name of ['training', 'training-api', 'main', 'api']) {
    expect(tsCloud.sites?.[name]?.inheritEnv).toBe(false)
    expect(tsCloud.sites?.[name]?.isolation).toBe(true)
    expect(tsCloud.sites?.[name]?.env?.CLOUDFLARE_API_TOKEN).toBeUndefined()
    expect(tsCloud.sites?.[name]?.env?.HCLOUD_TOKEN).toBeUndefined()
  }
})

it('resolves isolated runtime secrets again after Buddy switches to production', () => {
  const keys = ['LSU_TRAINING_APP_KEY', 'LSU_TRAINING_DB_PASSWORD', 'LSU_DEMO_ACCOUNTS_JSON'] as const
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  try {
    process.env.LSU_TRAINING_APP_KEY = 'development-sentinel'
    trainingSites()
    process.env.LSU_TRAINING_APP_KEY = 'production-sentinel'
    process.env.LSU_TRAINING_DB_PASSWORD = 'own-database-sentinel'
    process.env.LSU_DEMO_ACCOUNTS_JSON = 'private-review-sentinel'
    const sites = trainingSites()
    for (const name of ['training', 'training-api']) {
      expect(sites[name].inheritEnv).toBe(false)
      expect(sites[name].isolation).toBe(true)
      expect(sites[name].env?.APP_KEY).toBe('production-sentinel')
      expect(sites[name].env?.DB_PASSWORD).toBe('own-database-sentinel')
      expect(sites[name].env?.DB_DATABASE).toBe('lsu_training')
      expect(sites[name].env?.PATH).toContain('/lastsoulultra-shared/training/media/pantry/.bin')
      expect(sites[name].env?.CLOUDFLARE_API_TOKEN).toBeUndefined()
    }
    expect(sites.training.env?.LSU_DEMO_ACCOUNTS_JSON).toBeUndefined()
    expect(sites['training-api'].env?.LSU_DEMO_ACCOUNTS_JSON).toBe('private-review-sentinel')
  }
  finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})

it('reads every queue a kit names, and leaves HQ its own', () => {
  const app = mkdtempSync(join(tmpdir(), 'lsu-kit-'))
  mkdirSync(join(app, 'Jobs'))
  writeFileSync(join(app, 'Jobs', 'SendThing.ts'), `export default new Job({ name: 'SendThing', queue: 'brand-new' })\n`)
  writeFileSync(join(app, 'relay.ts'), `Jobs.make('X').onQueue('platform-relay')\nconst JOB = { queue:'notifications' }\n`)
  expect(kitQueues(app)).toEqual(['brand-new', 'notifications', 'platform-relay'])
  // A queue the kit adds and no daemon works is reported; HQ's relay queue is not.
  expect(undrainedQueues(kitQueues(app))).toEqual(['brand-new'])
})

it('requires the HQ proxy protocol before starting the API and drains platform work separately', () => {
  const sites = trainingSites()
  expect(sites.training.env?.HQ_PLATFORM_DATA_MODE).toBe('proxy')
  expect(sites['training-api'].env?.HQ_PLATFORM_DATA_MODE).toBe('proxy')
  expect(sites['training-api'].preStart).toContain('bun scripts/enterprise-preflight.ts --platform')
  const daemons = sites['training-api'].daemons || []
  const platform = daemons.find(daemon => daemon.name === 'hq-platform')!
  expect(platform.command).toContain('--queue=platform-history')
  expect(daemons.find(daemon => daemon.name === 'connection-sync')!.command).not.toContain('platform-history')
})
