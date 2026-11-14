import { expect, it } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import deployment from '../enterprise/deployment.json'
import presets from '../enterprise/presets.json'
import nativeProduct from '../native/product.json'
import { trainingSites } from '../config/training-cloud'
import { workoutKey } from '../scripts/import-catalog-keys'

const directory = join(import.meta.dir, '../enterprise/catalog')
const read = (file: string) => JSON.parse(readFileSync(join(directory, file), 'utf8'))
const catalog = read('catalog.json')
const workouts = read('workouts.json') as Record<string, { format: string, title: string, sport: string, type: string }>

it('names LSU’s own organization and a coach who is one of its admins', () => {
  expect(catalog.organization).toBe(presets.organization)
  expect(deployment.admins).toContain(catalog.coach)
  expect(catalog.method.name).toBe('Last Soul Ultra Methode')
  expect(catalog.method.instructions.length).toBeLessThanOrEqual(20000)
  // A subscriber has no personal coach, and the app shows the answer as plain text.
  expect(catalog.method.instructions).toContain('LSU Coach-Team')
  expect(catalog.method.instructions).toContain('ohne Markdown')
})

it('ships five programmes at three levels, each as RUN and SOUL, over twelve weeks', () => {
  const keys = catalog.plans.map((plan: { key: string }) => plan.key)
  const expected = ['10k', 'backyard', 'halbmarathon', 'marathon', 'trail'].flatMap(program => ['einsteiger', 'fortgeschritten', 'profi'].flatMap(level => ['run', 'soul'].map(tier => `${program}-${level}-${tier}`)))
  expect(keys.toSorted()).toEqual(expected.toSorted())
  expect(readdirSync(join(directory, 'plans')).toSorted()).toEqual(expected.map(key => `${key}.json`).toSorted())
  for (const entry of catalog.plans) {
    const plan = read(entry.file)
    expect(plan.weeks).toBe(12)
    for (const session of plan.sessions) {
      const workout = workouts[session.workout]
      if (!workout) throw new Error(`${entry.key}: week ${session.week}, day ${session.day} names a workout that is not in workouts.json`)
      // RUN is running and rest days only; SOUL adds strength, mobility and meditation.
      if (entry.key.endsWith('-run') && !['Run', 'Rest'].includes(workout.sport)) throw new Error(`${entry.key} has a ${workout.sport} session`)
    }
    expect(new Set(plan.sessions.map((session: { week: number }) => session.week)).size).toBe(12)
  }
})

it('keeps every workout once, under the key its content gives it', () => {
  for (const [key, workout] of Object.entries(workouts)) {
    expect(workout.format).toBe('hq.workout.v1')
    expect(workoutKey(workout)).toBe(key)
  }
  const used = new Set(catalog.plans.flatMap((entry: { file: string }) => read(entry.file).sessions.map((session: { workout: string }) => session.workout)))
  expect(Object.keys(workouts).filter(key => !used.has(key))).toEqual([])
})

it('sells the four test packages monthly, week by week on feedback, at LSU’s prices', () => {
  expect(catalog.products.map((product: { slug: string }) => product.slug)).toEqual(['lsu-backyard-fortgeschritten-run', 'lsu-backyard-fortgeschritten-soul', 'lsu-10k-einsteiger-run', 'lsu-10k-einsteiger-soul'])
  for (const product of catalog.products) {
    expect(existsSync(join(directory, 'plans', `${product.plan}.json`))).toBe(true)
    expect(product.slug).toBe(`lsu-${product.plan}`)
    expect(product).toMatchObject({ currency: 'EUR', billing_interval: 'month', training_blocks: { length_days: 7, review: 'coach', wait_for: 'feedback', source: 'plan' } })
    expect(product.tax_code).toMatch(/^txcd_\d{8}$/)
    // The card's picture is one of LSU's own photographs, which the installation serves.
    expect(product.cover_image).toMatch(/^\/assets\/native-product\/imagery\/[a-zA-Z]+\.webp$/)
    expect(Object.values(nativeProduct.identity.imagery).map(place => place.src)).toContain(product.cover_image)
    expect(product.name.length).toBeLessThanOrEqual(60)
    const soul = product.slug.endsWith('-soul')
    expect(product.price_cents).toBe(soul ? 3999 : 1999)
    expect(product.allowed_training_sports).toEqual(soul ? ['Run', 'Strength'] : ['Run'])
  }
})

it('seeds the catalog on every deploy, once its coach has an account', () => {
  const api = trainingSites()['training-api']
  expect(api.env?.HQ_INSTALLATION_CATALOG).toBe('deployment/lsu/catalog/catalog.json')
  const preStart = api.preStart as string[]
  const seed = preStart.indexOf('./buddy seed --skip-models --only-seeders InstallationCatalogSeeder')
  expect(seed).toBeGreaterThan(preStart.indexOf('./buddy installation:admins'))
  expect(seed).toBeLessThan(preStart.indexOf('bun deployment/lsu/grant-trainer-plans.ts'))
})

it('hands the training host its Stripe keys and nothing of the website’s', () => {
  const keys = ['LSU_STRIPE_SECRET_KEY', 'LSU_STRIPE_PUBLISHABLE_KEY', 'LSU_STRIPE_WEBHOOK_SECRET', 'LSU_STRIPE_CONNECT_WEBHOOK_SECRET'] as const
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  try {
    for (const key of keys) process.env[key] = `${key.toLowerCase()}-sentinel`
    const env = trainingSites()['training-api'].env!
    expect([env.STRIPE_SECRET_KEY, env.STRIPE_PUBLISHABLE_KEY, env.STRIPE_WEBHOOK_SECRET, env.STRIPE_CONNECT_WEBHOOK_SECRET]).toEqual(keys.map(key => `${key.toLowerCase()}-sentinel`))
    expect(Object.keys(env).filter(key => key.startsWith('LSU_STRIPE'))).toEqual([])
  }
  finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})

it('gives a follow-along session a length: its title’s, or its one video’s', () => {
  const lengths = read('video-lengths.json') as Record<string, number>
  const followAlong = Object.values(workouts as Record<string, any>).filter((workout) => {
    const exercises = (workout.strength?.blocks || []).flatMap((block: any) => block.exercises || [])
    return exercises.length === 1 && exercises[0].video_url
  })
  expect(followAlong.length).toBeGreaterThan(5)
  for (const workout of followAlong) {
    const stated = /\d\s?min/i.test(workout.title)
    // "NSDR 20 min" says it (HQ reads the title); the rest carry their video's length.
    if (!stated) {
      const url = workout.strength.blocks[0].exercises[0].video_url
      const minutes = Math.max(1, Math.round(lengths[url]! / 60))
      expect(workout.planned_duration).toBe(`0:${String(minutes).padStart(2, '0')}:00`)
    }
  }
  expect(Object.values(lengths).every(seconds => seconds > 60)).toBe(true)
})

it('says on the site what the tiers do: one week at a time', () => {
  expect(presets.products.every(product => product.training_blocks.length_days === 7)).toBe(true)
  const pages = ['resources/views/app.stx', 'resources/views/index.stx', 'resources/views/coaching.stx', 'resources/views/app/coaches.stx', 'resources/data/production-pages.ts', 'resources/data/app-stores.ts']
  for (const page of pages) expect(readFileSync(join(import.meta.dir, '..', page), 'utf8')).not.toMatch(/two weeks at a time|two-week (training )?blocks|next two weeks|every two weeks/i)
})
