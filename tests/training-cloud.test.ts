import { expect, it } from 'bun:test'
import { trainingSites } from '../config/training-cloud'
import { tsCloud } from '../config/cloud'
import deployment from '../enterprise/deployment.json'

it('keeps the enterprise installation off a shared host and pins provider placement', () => {
  expect(tsCloud.cloud?.attachTo).toBeUndefined()
  expect(tsCloud.cloud?.provider).toBe('hetzner')
  expect(tsCloud.hetzner?.location).toBe(deployment.residency.location)
  expect(tsCloud.cloud?.residency?.countries).toEqual([deployment.residency.country])
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
