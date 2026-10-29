/* eslint-disable no-console */
/**
 * Provision LSU review accounts in the coaching application's database.
 * Run from that application's root with a private LSU_DEMO_ACCOUNTS_FILE.
 * No provider requests, real charges, email or password resets are performed.
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

interface DemoAccount { key: string, name: string, email: string, password: string, membership?: string, coach?: boolean, athlete?: boolean, subscriber?: boolean }
const accountsFile = process.env.LSU_DEMO_ACCOUNTS_FILE
if (!accountsFile || process.env.LSU_SEED_CONFIRM !== 'last-soul-ultra')
  throw new Error('Supply LSU_DEMO_ACCOUNTS_FILE and LSU_SEED_CONFIRM=last-soul-ultra explicitly.')
const root = process.cwd()
const manifest = await Bun.file(resolve(root, 'package.json')).json()
if (manifest.name !== 'hq-training') throw new Error('Run this seeder from the coaching application root.')
const accounts: DemoAccount[] = await Bun.file(accountsFile).json()
if (accounts.some(account => !/^[a-z0-9]+@lsu-demo\.test$/.test(account.email) || account.password.length < 20))
  throw new Error('Only LSU demo addresses and generated strong passwords are accepted.')
const appModule = (name: string) => import(pathToFileURL(resolve(root, 'app/Support', `${name}.ts`)).href)
const { db } = await import(Bun.resolveSync('@stacksjs/database/runtime', root))
const { transaction } = await import(Bun.resolveSync('@stacksjs/orm', root))
const { todayIn, addDays, startOfIsoWeek } = await import(Bun.resolveSync('@stacksjs/datetime', root))
const { saveExperience, saveMethod } = await appModule('brandExperience')
const { lastSoulExperience } = await appModule('experiencePresets')
const { grantComp } = await appModule('platformBilling')
const { grantSubscriptionEnrollment } = await appModule('storefront')
const database = await db.unsafe('SELECT current_database() AS name').execute()
if (database[0]?.name !== process.env.LSU_SEED_DATABASE)
  throw new Error('LSU_SEED_DATABASE must match the connected database explicitly.')
const origin = 'https://lsu.stacksjs.com'
const now = new Date().toISOString()
const zone = 'Europe/Berlin'
const today = todayIn(zone)
const ids: Record<string, number> = {}
let organizationId = 0

await transaction(async () => {
  await db.unsafe("SELECT pg_advisory_xact_lock(hashtext('lsu-private-demo-seed'))").execute()
  let org = await db.selectFrom('organizations').selectAll().where('slug', '=', 'last-soul-ultra').executeTakeFirst()
  if (org && JSON.parse(String(org.settings || '{}')).demo_seed !== 'lsu-private-review-v1')
    throw new Error('Refusing to modify an existing LSU organization that this seeder does not own.')
  for (const account of accounts) {
    let user = await db.selectFrom('users').select(['id', 'name']).where('email', '=', account.email).executeTakeFirst()
    if (user && (!org || user.name !== account.name)) throw new Error(`Refusing to adopt existing account ${account.email}`)
    if (!user) user = await db.insertInto('users').values({ name: account.name, email: account.email, password: await Bun.password.hash(account.password, { algorithm: 'bcrypt', cost: 12 }), role: account.coach ? 'coach' : 'athlete', email_verified_at: now, profile_public: false, created_at: now }).returning(['id']).executeTakeFirstOrThrow()
    ids[account.key] = Number(user.id)
  }
  if (!org) org = await db.insertInto('organizations').values({ user_id: ids.owner, name: 'Last Soul Ultra', slug: 'last-soul-ultra', status: 'active', kind: 'club', currency: 'EUR', timezone: zone, profile_public: false, public_join: false, lead_form: false, settings: JSON.stringify({ demo_seed: 'lsu-private-review-v1' }), created_at: now }).returningAll().executeTakeFirstOrThrow()
  organizationId = Number(org.id)
  for (const account of accounts) {
    const userId = ids[account.key]
    if (account.membership) {
      const existing = await db.selectFrom('org_members').select(['id', 'role']).where('organization_id', '=', organizationId).where('user_id', '=', userId).executeTakeFirst()
      if (existing && existing.role !== account.membership) throw new Error(`Role changed for ${account.email}; preserve it and review manually.`)
      if (!existing) await db.insertInto('org_members').values({ organization_id: organizationId, user_id: userId, role: account.membership, status: 'active', created_at: now }).execute()
    }
    if (account.coach && !await db.selectFrom('coaches').select('id').where('user_id', '=', userId).executeTakeFirst())
      await db.insertInto('coaches').values({ user_id: userId, organization_id: organizationId, specialty: 'Ultra running', bio: 'Fictional LSU review coach. Sample training content only.', accepting_athletes: false, created_at: now }).execute()
    if (account.athlete && !await db.selectFrom('athletes').select('id').where('user_id', '=', userId).executeTakeFirst())
      await db.insertInto('athletes').values({ user_id: userId, organization_id: account.membership ? organizationId : null, timezone: zone, sport: 'Run', group_name: 'LSU demonstration', lthr: 165, max_hr: 190, resting_hr: 52, created_at: now }).execute()
  }
  await grantComp(ids.owner, 'gym_ai')
  await grantComp(ids.coach, 'coach_ai')
  await grantComp(ids.trainer, 'coach')
  const coach = await db.selectFrom('coaches').select('id').where('user_id', '=', ids.coach).executeTakeFirstOrThrow()
  let method = await db.selectFrom('coaching_methods').selectAll().where('organization_id', '=', organizationId).where('name', '=', 'LSU demo endurance method').executeTakeFirst()
  if (!method) method = await saveMethod(organizationId, { coach_id: Number(coach.id), name: 'LSU demo endurance method', summary: 'Fictional eight-week endurance sample for reviewing workouts and feedback. Not an approved LSU coaching method.', instructions: 'Demonstration method only. Build consistency with easy running, a controlled hill session, a long easy run and recovery. Respect the runner\'s availability and discomfort. Ask for clarification when needed. Only adapt future unfinished sessions after reviewed feedback; never invent completed history.', contact_url: `${origin}/contact`, status: 'published' })
  let plan = await db.selectFrom('training_plans').select('id').where('coach_id', '=', Number(coach.id)).where('name', '=', 'LSU demo: eight weeks of endurance').executeTakeFirst()
  if (!plan) {
    const template = { summary: 'Sample training for the private LSU review.', phases: [{ name: 'Consistency', start_week: 1, end_week: 4, focus: 'Easy volume and routine' }, { name: 'Endurance', start_week: 5, end_week: 8, focus: 'Long-run consistency and recovery' }], weeks: Array.from({ length: 8 }, (_, week) => ({ week: week + 1, focus: week < 4 ? 'Consistency' : 'Endurance', planned_hours: 4, workouts: [
      { day: 1, title: 'Easy aerobic run', duration_minutes: 40, distance_km: 6, tss: 30 },
      { day: 3, title: 'Controlled hill session', duration_minutes: 50, distance_km: 7, tss: 45 },
      { day: 5, title: 'Recovery run', duration_minutes: 30, distance_km: 4, tss: 18 },
      { day: 6, title: 'Long easy trail run', duration_minutes: 90, distance_km: 12, tss: 65 },
    ].map(workout => ({ ...workout, sport: 'Run', description: 'Fictional demo session. Keep the effort comfortable; review the session instructions before training.', steps: [{ name: 'Warm up', duration_minutes: 5, zone: 'Z1', intensity: 'Easy', notes: '' }, { name: workout.title, duration_minutes: workout.duration_minutes - 10, zone: 'Z2', intensity: 'Easy', notes: 'Sample session for reviewing the application.' }, { name: 'Cool down', duration_minutes: 5, zone: 'Z1', intensity: 'Easy', notes: '' }] })) })) }
    plan = await db.insertInto('training_plans').values({ coach_id: Number(coach.id), name: 'LSU demo: eight weeks of endurance', description: template.summary, sport: 'Run', weeks: 8, plan: JSON.stringify(template), created_at: now }).returning(['id']).executeTakeFirstOrThrow()
  }
  let product = await db.selectFrom('products').selectAll().where('slug', '=', 'lsu-private-demo-running').executeTakeFirst()
  if (!product) product = await db.insertInto('products').values({ organization_id: organizationId, coach_id: Number(coach.id), name: 'Endurance running, demo', slug: 'lsu-private-demo-running', type: 'coaching', description: 'Private review sample. Fictional EUR 19.99 monthly tier; existing demo access is complimentary. No payment account is connected.', price_cents: 1999, currency: 'EUR', billing_interval: 'month', includes_coaching: false, training_plan_id: Number(plan.id), status: 'active', created_at: now }).returningAll().executeTakeFirstOrThrow()
  const experience = await db.selectFrom('brand_experiences').select(['id']).where('organization_id', '=', organizationId).executeTakeFirst()
  if (!experience) await saveExperience(organizationId, { ...lastSoulExperience(), home_url: `${origin}/coaching`, logo_url: 'https://www.lastsoulultra.com/assets/lsu-logo.svg', support_url: `${origin}/contact`, privacy_url: `${origin}/privacy`, terms_url: `${origin}/terms`, embed_origins: [origin], show_powered_by: false, offers: [{ product_id: Number(product.id), method_id: Number(method.id), label: 'Endurance running, demo' }] }, 'published')
  const brand = await db.selectFrom('brand_experiences').select('id').where('organization_id', '=', organizationId).executeTakeFirstOrThrow()
  for (const account of accounts.filter(account => account.subscriber)) {
    const athlete = await db.selectFrom('athletes').select('id').where('user_id', '=', ids[account.key]).executeTakeFirstOrThrow()
    let subscription = await db.selectFrom('coaching_subscriptions').select('id').where('user_id', '=', ids[account.key]).where('product_id', '=', Number(product.id)).executeTakeFirst()
    if (!subscription) {
      subscription = await db.insertInto('coaching_subscriptions').values({ user_id: ids[account.key], product_id: Number(product.id), coach_id: Number(coach.id), brand_experience_id: Number(brand.id), coaching_method_id: Number(method.id), status: 'active', price_cents: 1999, currency: 'EUR', billing_interval: 'month', plan_start_date: today, created_at: now, updated_at: now }).returning('id').executeTakeFirstOrThrow()
      // The enrollment primitive delivers the real plan without the purchase
      // workflow's welcome notifications. Demo access has no provider charge.
      await grantSubscriptionEnrollment({ userId: ids[account.key], productId: Number(product.id), athleteId: Number(athlete.id), planStart: today, coachingSubscriptionId: Number(subscription.id) })
      await db.updateTable('coaching_subscriptions').set({ access_started_at: now, athlete_id: Number(athlete.id), linked_coach: false }).where('id', '=', Number(subscription.id)).execute()
      const enrollment = await db.selectFrom('product_enrollments').select('id').where('coaching_subscription_id', '=', Number(subscription.id)).executeTakeFirstOrThrow()
      const workouts = await db.selectFrom('workouts').select(['id', 'planned_duration', 'planned_distance_km', 'planned_tss']).where('athlete_id', '=', Number(athlete.id)).where('external_source', '=', 'hq-plan').where('external_id', 'like', `enroll-${Number(enrollment.id)}:%`).orderBy('date').orderBy('id').execute()
      for (const [index, workout] of workouts.entries()) {
        const date = addDays(startOfIsoWeek(today), -21 + Math.floor(index / 4) * 7 + [0, 2, 4, 5][index % 4])
        const completed = date < today
        await db.updateTable('workouts').set({ date, completed, ...(completed ? { completed_duration: workout.planned_duration, completed_distance_km: workout.planned_distance_km, completed_tss: workout.planned_tss, avg_hr: 138 + index % 9, rpe: 3 + index % 3, feeling: 3 + index % 2 } : {}) }).where('id', '=', Number(workout.id)).execute()
      }
    }
    for (let day = 0; day < 21; day++) {
      const date = addDays(today, -day)
      if (await db.selectFrom('health_metrics').select('id').where('athlete_id', '=', Number(athlete.id)).where('date', '=', date).where('source', '=', 'lsu-demo').executeTakeFirst()) continue
      await db.insertInto('health_metrics').values({ athlete_id: Number(athlete.id), date, source: 'lsu-demo', sleep_hours: 7.2 + day % 4 * 0.2, sleep_score: 79 + day % 10, hrv: 50 + day % 11, resting_hr: 50 + day % 5, readiness: 77 + day % 14, steps: 8500 + day * 160, created_at: now }).execute()
    }
  }
  // A club-scoped sample conversation to an admin, without assigning a personal coach.
  const first = Math.min(ids.runner, ids.admin), second = Math.max(ids.runner, ids.admin)
  const scope = `hq:gym:${organizationId}`
  const thread = await db.selectFrom('chat_conversations').select('id').where('scope', '=', scope).where('first_id', '=', first).where('second_id', '=', second).executeTakeFirst()
  if (!thread) {
    const id = crypto.randomUUID()
    await db.insertInto('chat_conversations').values({ id, first_id: first, second_id: second, scope, participant_type: 'users', created_at: now }).execute()
    await db.insertInto('chat_messages').values({ conversation_id: id, sender_id: ids.admin, body: 'Welcome to the LSU review. This is a fictional sample conversation. Your demo calendar has completed sessions and upcoming training to explore.', client_key: crypto.randomUUID(), created_at: now }).execute()
    await db.insertInto('chat_messages').values({ conversation_id: id, sender_id: ids.runner, body: 'Demo reply: I found the long trail run and the method summary. I will review my completed sessions next.', client_key: crypto.randomUUID(), created_at: now }).execute()
  }
})
console.log(JSON.stringify({ organization_id: organizationId, users: ids, result: 'LSU demo seeded; existing passwords and edited content preserved' }))
process.exit(0)
