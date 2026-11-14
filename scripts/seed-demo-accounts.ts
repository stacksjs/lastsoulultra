/* eslint-disable no-console */
/**
 * Provision LSU review accounts in the coaching application's database.
 * Run from that application's root with a private LSU_DEMO_ACCOUNTS_FILE.
 * No provider requests, real charges, email or password resets are performed.
 */
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { combinedRunKey, demoPlan, demoRunningPlan, demoRunningTier, demoStrengthDescription, demoTier } from './lsu-demo-plan'
import { CATALOG, CATALOG_COACH_EMAIL, catalogDescription, reviewStorefrontOffers } from './lsu-demo-catalog'

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
// Standalone scripts provide the server database global used by application helpers.
Object.assign(globalThis, { db })
const { transaction } = await import(Bun.resolveSync('@stacksjs/orm', root))
const { Auth, RateLimiter } = await import(Bun.resolveSync('@stacksjs/auth', root))
const { todayIn, addDays, startOfIsoWeek } = await import(Bun.resolveSync('@stacksjs/datetime', root))
const { saveExperience, saveMethod } = await appModule('brandExperience')
// LSU's brand is the installation's packaged preset (enterprise/presets.json,
// written by native-source.ts). HQ releases before installation presets kept a
// copy of it under LSU's name; read that only from such an older kit.
const experiencePresets = await appModule('experiencePresets')
const lsuExperience = (): Record<string, any> => {
  const preset = experiencePresets.installationExperiencePreset?.() ?? experiencePresets.lastSoulExperience?.()
  if (!preset) throw new Error('Package enterprise/presets.json into the HQ source before seeding (native-source.ts).')
  return preset
}
const { grantComp } = await appModule('platformBilling')
const { recordPolicyAcceptance } = await appModule('policyAcceptance')
const { policyKey } = await appModule('policies')
const { grantSubscriptionEnrollment, enrollmentKey } = await appModule('storefront')
const { normalizePlan } = await appModule('planEdit')
const { planToWorkouts } = await appModule('planBuilder')
const { writePlanWorkouts } = await appModule('planDrafts')
const { toYmd } = await appModule('helpers')
const normalized = normalizePlan(demoPlan(), true)
if (!normalized.plan) throw new Error(normalized.error)
const template = normalized.plan
const database = await db.unsafe('SELECT current_database() AS name').execute()
if (database[0]?.name !== process.env.LSU_SEED_DATABASE)
  throw new Error('LSU_SEED_DATABASE must match the connected database explicitly.')
const origin = 'https://lsu.stacksjs.com'
const applicationOrigin = String(process.env.APP_URL || 'https://training.lsu.stacksjs.com').replace(/\/$/, '')
const now = new Date().toISOString()
// Review fixtures stay usable but are not customer offers once the authored catalog is installed.
const reviewProductStatus = process.env.HQ_INSTALLATION_CATALOG ? 'draft' : 'active'
const zone = 'Europe/Berlin'
const today = todayIn(zone)
const ids: Record<string, number> = {}
let organizationId = 0
let created = 0
let realigned = 0
/** An unreadable, empty or foreign hash counts as a mismatch, so the published password wins. */
const verifies = async (stored: unknown, password: string): Promise<boolean> => {
  const hash = String(stored || '')
  if (!hash) return false
  try { return await Bun.password.verify(password, hash) }
  catch { return false }
}

await transaction(async () => {
  await db.unsafe("SELECT pg_advisory_xact_lock(hashtext('lsu-private-demo-seed'))").execute()
  let org = await db.selectFrom('organizations').selectAll().where('slug', '=', 'last-soul-ultra').executeTakeFirst()
  const claim = org ? JSON.parse(String(org.settings || '{}')).demo_seed : undefined
  /*
   * The marker is this seeder's own signature, and refusing anything without it
   * is right on the shared host, where `last-soul-ultra` could name a real
   * tenant with real athletes.
   *
   * Adopting an unclaimed organization is safe only on `lsu_training`, a
   * database dedicated to this one brand that the operator has already had to
   * name twice to reach this line: LSU_SEED_DATABASE, checked against
   * current_database() above, and DB_DATABASE in enterprise/seed-review.ts. An
   * organization carrying somebody else's marker is still refused.
   *
   * This path has never run here, and the commit that added it was wrong about
   * why the handed-out logins were failing. The organization on this
   * installation carries the marker because this seeder created it, so every
   * deploy has taken the claimed path. A deploy proves that by itself: any
   * throw in here exits the wrapper non-zero, which fails the remote script
   * under `set -e` and turns the deploy red, and none of them were. The real
   * cause was the password rule below.
   */
  const dedicated = database[0]?.name === 'lsu_training'
  const adopting = Boolean(org) && !claim && dedicated
  if (org && claim !== 'lsu-private-review-v1' && !adopting)
    throw new Error('Refusing to modify an existing LSU organization that this seeder does not own.')
  for (const account of accounts) {
    let user = await db.selectFrom('users').select(['id', 'name', 'password']).where('email', '=', account.email).executeTakeFirst()
    if (user && (!org || user.name !== account.name)) throw new Error(`Refusing to adopt existing account ${account.email}`)
    /*
     * A credential we publish has to be the one that works. Progress, plans and
     * messages belong to the reviewer and are preserved everywhere below, but
     * the password is not theirs: it is handed out in the gated docs, which
     * scripts/prepare-demo-docs.ts regenerates from LSU_DEMO_ACCOUNTS_JSON on
     * every deploy. Leaving an existing hash alone meant rotating that secret
     * republished twelve logins the database had never been told about, and
     * every one came back "Invalid credentials", which from outside is
     * indistinguishable from an account that was never created.
     *
     * Rehash only on a real mismatch, so a deploy that changes nothing leaves
     * password_changed_at alone and keeps the review sessions signed in.
     */
    if (user && !await verifies(user.password, account.password)) {
      await db.updateTable('users').set({ password: await Bun.password.hash(account.password, { algorithm: 'bcrypt', cost: 12 }), password_changed_at: now, updated_at: now }).where('id', '=', Number(user.id)).execute()
      realigned += 1
    }
    if (!user) {
      user = await db.insertInto('users').values({ name: account.name, email: account.email, password: await Bun.password.hash(account.password, { algorithm: 'bcrypt', cost: 12 }), role: account.coach ? 'coach' : 'athlete', email_verified_at: now, profile_public: false, created_at: now }).returning(['id']).executeTakeFirstOrThrow()
      created += 1
    }
    ids[account.key] = Number(user.id)
    // These reserved .test identities are fixtures, never evidence of human consent.
    await recordPolicyAcceptance(ids[account.key], policyKey(), { method: 'seed', client: 'phone', locale: 'en' })
  }
  if (!org) org = await db.insertInto('organizations').values({ user_id: ids.owner, name: 'Last Soul Ultra', slug: 'last-soul-ultra', status: 'active', kind: 'club', currency: demoTier.currency, timezone: zone, profile_public: false, public_join: false, lead_form: false, settings: JSON.stringify({ demo_seed: 'lsu-private-review-v1' }), created_at: now }).returningAll().executeTakeFirstOrThrow()
  organizationId = Number(org.id)
  if (adopting) {
    // Claim it, so this is a one-off: every later run takes the marker path.
    const settings = JSON.parse(String(org.settings || '{}'))
    await db.updateTable('organizations').set({ settings: JSON.stringify({ ...settings, demo_seed: 'lsu-private-review-v1' }) }).where('id', '=', organizationId).execute()
    console.log(`[ts-cloud] lsu review seed: adopted the existing last-soul-ultra organization (#${organizationId}) and marked it for this seeder.`)
  }
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
  const priorVersion = Number(JSON.parse(String(org.settings || '{}')).demo_schema_version || 1)
  let product = await db.selectFrom('products').selectAll().where('slug', '=', 'lsu-private-demo-running').executeTakeFirst()
  if (product && (Number(product.organization_id) !== organizationId || Number(product.coach_id) !== Number(coach.id))) throw new Error('The demo product is owned by another organization or coach.')
  const oldOffer = product ? await db.selectFrom('coaching_subscriptions').selectAll().where('product_id', '=', Number(product.id)).execute() : []
  if (oldOffer.some((row: any) => row.stripe_subscription_id || row.stripe_checkout_session_id || !Object.values(ids).includes(Number(row.user_id)))) throw new Error('Refusing to alter a purchased or non-demo subscription.')
  const previousPlan = product?.training_plan_id ? await db.selectFrom('training_plans').selectAll().where('id', '=', Number(product.training_plan_id)).executeTakeFirst() : null
  if (previousPlan && Number(previousPlan.coach_id) !== Number(coach.id)) throw new Error('The demo plan belongs to another coach.')
  const methodInput = { coach_id: Number(coach.id), name: 'LSU demo running and strength method', summary: 'Fictional eight-week Run + Strength sample for reviewing workouts and feedback. Not an approved LSU coaching method.', instructions: 'Demonstration method only. Review four running sessions and two illustrated strength sessions per week. Respect the athlete\'s availability and discomfort. Ask for clarification when needed. Only adapt future unfinished sessions after reviewed feedback; never invent completed history.', contact_url: `${origin}/contact`, status: 'published' }
  const existingBrand = await db.selectFrom('brand_experiences').selectAll().where('organization_id', '=', organizationId).executeTakeFirst()
  const existingSettings = existingBrand ? JSON.parse(String(existingBrand.settings)) : null
  const oldMethodId = existingSettings?.offers?.find((offer: any) => Number(offer.product_id) === Number(product?.id))?.method_id
  const method = await saveMethod(organizationId, methodInput, oldMethodId ? Number(oldMethodId) : undefined)
  const planValues = { name: 'LSU demo: eight weeks of running and strength', description: template.summary, sport: 'Multisport', weeks: 8, plan: JSON.stringify(template), updated_at: now }
  const plan = previousPlan || await db.insertInto('training_plans').values({ ...planValues, coach_id: Number(coach.id), created_at: now }).returning(['id']).executeTakeFirstOrThrow()
  if (previousPlan) await db.updateTable('training_plans').set(planValues).where('id', '=', Number(plan.id)).execute()
  const productValues = { name: demoTier.name, description: `Private review sample. ${new Intl.NumberFormat('en', { style: 'currency', currency: demoTier.currency }).format(demoTier.price_cents / 100)} monthly SOUL tier, tax included; demo access is complimentary. Payments run in Stripe test mode: no card is charged.`, price_cents: demoTier.price_cents, currency: demoTier.currency, billing_interval: demoTier.billing_interval, allowed_training_sports: JSON.stringify(demoTier.sports), includes_coaching: false, training_plan_id: Number(plan.id), status: reviewProductStatus, updated_at: now }
  if (!product) product = await db.insertInto('products').values({ ...productValues, organization_id: organizationId, coach_id: Number(coach.id), slug: 'lsu-private-demo-running', type: 'coaching', created_at: now }).returningAll().executeTakeFirstOrThrow()
  else await db.updateTable('products').set(productValues).where('id', '=', Number(product.id)).execute()
  const offer = { product_id: Number(product.id), method_id: Number(method.id), label: demoTier.name }
  // The running tier, at LSU's running price, on the same method. It has no
  // review subscribers: it is there so the store shows both tiers LSU sells.
  const runningTemplate = normalizePlan(demoRunningPlan(), true)
  if (!runningTemplate.plan) throw new Error(runningTemplate.error)
  let runningProduct = await db.selectFrom('products').selectAll().where('slug', '=', 'lsu-private-demo-running-only').executeTakeFirst()
  if (runningProduct && (Number(runningProduct.organization_id) !== organizationId || Number(runningProduct.coach_id) !== Number(coach.id))) throw new Error('The running demo product is owned by another organization or coach.')
  const runningPlanValues = { name: 'LSU demo: eight weeks of running', description: runningTemplate.plan.summary, sport: 'Run', weeks: 8, plan: JSON.stringify(runningTemplate.plan), updated_at: now }
  const runningPrevious = runningProduct?.training_plan_id ? await db.selectFrom('training_plans').selectAll().where('id', '=', Number(runningProduct.training_plan_id)).executeTakeFirst() : null
  if (runningPrevious && Number(runningPrevious.coach_id) !== Number(coach.id)) throw new Error('The running demo plan belongs to another coach.')
  const runningPlan = runningPrevious || await db.insertInto('training_plans').values({ ...runningPlanValues, coach_id: Number(coach.id), created_at: now }).returning(['id']).executeTakeFirstOrThrow()
  if (runningPrevious) await db.updateTable('training_plans').set(runningPlanValues).where('id', '=', Number(runningPlan.id)).execute()
  const runningValues = { name: demoRunningTier.name, description: `Private review sample. ${new Intl.NumberFormat('en', { style: 'currency', currency: demoRunningTier.currency }).format(demoRunningTier.price_cents / 100)} monthly RUN tier, tax included. Payments run in Stripe test mode: no card is charged.`, price_cents: demoRunningTier.price_cents, currency: demoRunningTier.currency, billing_interval: demoRunningTier.billing_interval, allowed_training_sports: JSON.stringify(demoRunningTier.sports), includes_coaching: false, training_plan_id: Number(runningPlan.id), status: reviewProductStatus, updated_at: now }
  if (!runningProduct) runningProduct = await db.insertInto('products').values({ ...runningValues, organization_id: organizationId, coach_id: Number(coach.id), slug: 'lsu-private-demo-running-only', type: 'coaching', created_at: now }).returningAll().executeTakeFirstOrThrow()
  else await db.updateTable('products').set(runningValues).where('id', '=', Number(runningProduct.id)).execute()
  // RUN first, then SOUL: the order the store lists them in.
  const tierOffers = [{ product_id: Number(runningProduct.id), method_id: Number(method.id), label: demoRunningTier.name }, offer]
  // The saved experience keeps what LSU's staff edited (its words, its modules),
  // but its theme is the packaged one: the coaching portal and the coaching
  // section inside the app are drawn from it, and they must look like the app
  // around them (native/product.json), not like the theme of an earlier build.
  await saveExperience(organizationId, existingSettings ? { ...existingSettings, theme: lsuExperience().theme, offers: reviewStorefrontOffers(existingSettings.offers, tierOffers, Boolean(process.env.HQ_INSTALLATION_CATALOG)) } : { ...lsuExperience(), home_url: `${origin}/coaching`, logo_url: `${applicationOrigin}/assets/native-product/lsu-logo.svg`, support_url: `${origin}/contact`, privacy_url: `${applicationOrigin}/legal/lsu/privacy`, terms_url: `${applicationOrigin}/legal/lsu/terms`, embed_origins: [origin], show_powered_by: false, offers: tierOffers }, existingBrand?.status || 'published')
  const brand = await db.selectFrom('brand_experiences').select('id').where('organization_id', '=', organizationId).executeTakeFirstOrThrow()
  for (const account of accounts.filter(account => account.subscriber)) {
    const athlete = await db.selectFrom('athletes').select('id').where('user_id', '=', ids[account.key]).executeTakeFirstOrThrow()
    let subscription = await db.selectFrom('coaching_subscriptions').selectAll().where('user_id', '=', ids[account.key]).where('product_id', '=', Number(product.id)).executeTakeFirst()
    const sampleStart = addDays(startOfIsoWeek(today), -21)
    if (!subscription) subscription = await db.insertInto('coaching_subscriptions').values({ user_id: ids[account.key], product_id: Number(product.id), coach_id: Number(coach.id), brand_experience_id: Number(brand.id), coaching_method_id: Number(method.id), status: 'active', price_cents: demoTier.price_cents, currency: demoTier.currency, billing_interval: demoTier.billing_interval, plan_start_date: sampleStart, created_at: now, updated_at: now }).returningAll().executeTakeFirstOrThrow()
    // Enrollment delivers the real plan without purchase welcome notifications.
    await grantSubscriptionEnrollment({ userId: ids[account.key], productId: Number(product.id), athleteId: Number(athlete.id), planStart: sampleStart, coachingSubscriptionId: Number(subscription.id) })
    const enrollment = await db.selectFrom('product_enrollments').selectAll().where('coaching_subscription_id', '=', Number(subscription.id)).executeTakeFirstOrThrow()
    if (Number(enrollment.plan_revision || 0) !== 0 || enrollment.revoked_at || enrollment.order_id) throw new Error('Refusing to replace a revised or purchased demo enrollment.')
    const key = enrollmentKey(Number(enrollment.id))
    const before = await db.selectFrom('workouts').select(['id', 'external_id', 'sport', 'date']).where('athlete_id', '=', Number(athlete.id)).where('external_source', '=', 'hq-plan').where('external_id', 'like', `${key}:%`).execute()
    const start = toYmd(before.find((row: any) => String(row.external_id) === `${key}:w1:1`)?.date) || toYmd(enrollment.plan_start_date) || sampleStart
    if (priorVersion < 2 && before.length && before.every((row: any) => row.sport === 'Run')) {
      const rekeys = before.map((row: any) => ({ id: Number(row.id), next: combinedRunKey(String(row.external_id), key) }))
      // Two phases avoid collisions between old slot 3 and its new occupant.
      for (const row of rekeys) await db.updateTable('workouts').set({ external_id: `${key}:migration:${row.id}` }).where('id', '=', row.id).execute()
      for (const row of rekeys) await db.updateTable('workouts').set({ external_id: row.next }).where('id', '=', row.id).execute()
    }
    await db.updateTable('product_enrollments').set({ plan_start_date: start, plan_snapshot: JSON.stringify(template), released_units: template.weeks.length, updated_at: now }).where('id', '=', Number(enrollment.id)).execute()
    await db.updateTable('coaching_subscriptions').set({ price_cents: demoTier.price_cents, currency: demoTier.currency, billing_interval: demoTier.billing_interval, plan_start_date: start, access_started_at: subscription.access_started_at || now, athlete_id: Number(athlete.id), linked_coach: false, updated_at: now }).where('id', '=', Number(subscription.id)).execute()
    // Preserve every existing workout, including reviewer edits and completion history.
    const existingIds = new Set(before.map((row: any) => Number(row.id)))
    await writePlanWorkouts(Number(athlete.id), null, key, planToWorkouts(template, start, key))
    // Repair only the old, exact demo copy; keep any reviewer-written description.
    await db.updateTable('workouts').set({ description: demoStrengthDescription }).where('athlete_id', '=', Number(athlete.id)).where('external_source', '=', 'hq-plan').where('external_id', 'like', `${key}:%`).where('sport', '=', 'Strength').where('description', '=', 'Fictional demo session for reviewing illustrated exercises, sets and the strength player. Not an approved LSU prescription.').execute()
    const after = await db.selectFrom('workouts').select(['id', 'date', 'planned_duration', 'planned_distance_km', 'planned_tss']).where('athlete_id', '=', Number(athlete.id)).where('external_source', '=', 'hq-plan').where('external_id', 'like', `${key}:%`).execute()
    for (const [index, workout] of after.entries()) {
      if (existingIds.has(Number(workout.id)) || String(toYmd(workout.date)) >= today) continue
      await db.updateTable('workouts').set({ completed: true, completed_duration: workout.planned_duration, completed_distance_km: workout.planned_distance_km, completed_tss: workout.planned_tss, avg_hr: 138 + index % 9, rpe: 3 + index % 3, feeling: 3 + index % 2 }).where('id', '=', Number(workout.id)).execute()
    }
    for (let day = 0; day < 21; day++) {
      const date = addDays(today, -day)
      if (await db.selectFrom('health_metrics').select('id').where('athlete_id', '=', Number(athlete.id)).where('date', '=', date).where('source', '=', 'lsu-demo').executeTakeFirst()) continue
      await db.insertInto('health_metrics').values({ athlete_id: Number(athlete.id), date, source: 'lsu-demo', sleep_hours: 7.2 + day % 4 * 0.2, sleep_score: 79 + day % 10, hrv: 50 + day % 11, resting_hr: 50 + day % 5, readiness: 77 + day % 14, steps: 8500 + day * 160, created_at: now }).execute()
    }
  }
  await db.updateTable('organizations').set({ currency: demoTier.currency, settings: JSON.stringify({ ...JSON.parse(String(org.settings || '{}')), demo_schema_version: 2 }), updated_at: now }).where('id', '=', organizationId).execute()
  /*
   * The demo storefront (scripts/lsu-demo-catalog.ts), shown under the
   * installation admin it is drafted for. Each plan and product is made once
   * and then left alone: he may edit, unpublish or delete them, and a deploy
   * must not put back what he changed. A slug already used by anyone else is
   * refused rather than taken over.
   */
  const catalogUser = await db.selectFrom('users').select(['id']).where('email', '=', CATALOG_COACH_EMAIL).executeTakeFirst()
  let catalogMade = 0
  if (!catalogUser) console.log(`[ts-cloud] lsu review seed: no ${CATALOG_COACH_EMAIL} account yet, so no demo storefront`)
  else {
    const member = await db.selectFrom('org_members').select(['id']).where('organization_id', '=', organizationId).where('user_id', '=', Number(catalogUser.id)).executeTakeFirst()
    if (!member) throw new Error('The demo storefront coach is not a member of the LSU organization.')
    let catalogCoach = await db.selectFrom('coaches').select(['id', 'organization_id']).where('user_id', '=', Number(catalogUser.id)).executeTakeFirst()
    if (catalogCoach && Number(catalogCoach.organization_id) !== organizationId) throw new Error('The demo storefront coach coaches for another organization.')
    if (!catalogCoach) catalogCoach = await db.insertInto('coaches').values({ user_id: Number(catalogUser.id), organization_id: organizationId, specialty: 'Ultra running', accepting_athletes: false, created_at: now }).returning(['id', 'organization_id']).executeTakeFirstOrThrow()
    for (const item of CATALOG) {
      const existing = await db.selectFrom('products').select(['id', 'coach_id', 'organization_id', 'name', 'training_plan_id', 'tax_code']).where('slug', '=', item.slug).executeTakeFirst()
      if (existing) {
        if (Number(existing.coach_id) !== Number(catalogCoach.id) || Number(existing.organization_id) !== organizationId) throw new Error(`Refusing to adopt product ${item.slug}, which someone else owns.`)
        if (process.env.HQ_INSTALLATION_CATALOG) await db.updateTable('products').set({ status: 'draft', updated_at: now }).where('id', '=', Number(existing.id)).execute()
        // Apply the operator's corrected label only to the unchanged demo
        // title. Keep stable URLs and any name the coach deliberately edited.
        if (item.slug === 'lsu-pawel-strength-for-ultrarunners' && existing.name === 'Strength for Ultrarunners') {
          await db.updateTable('products').set({ name: item.name, updated_at: now }).where('id', '=', Number(existing.id)).where('name', '=', 'Strength for Ultrarunners').execute()
          if (existing.training_plan_id) await db.updateTable('training_plans').set({ name: item.name, updated_at: now }).where('id', '=', Number(existing.training_plan_id)).where('coach_id', '=', Number(catalogCoach.id)).where('name', '=', 'Strength for Ultrarunners').execute()
        }
        if (item.tax_code && !existing.tax_code) await db.updateTable('products').set({ tax_code: item.tax_code, updated_at: now }).where('id', '=', Number(existing.id)).execute()
        continue
      }
      const checked = normalizePlan(item.plan(), true)
      if (!checked.plan) throw new Error(`${item.slug}: ${checked.error}`)
      const description = catalogDescription(item)
      const plan = await db.insertInto('training_plans').values({ name: item.name, description: checked.plan.summary, sport: item.sport, weeks: checked.plan.weeks.length, plan: JSON.stringify(checked.plan), coach_id: Number(catalogCoach.id), created_at: now, updated_at: now }).returning(['id']).executeTakeFirstOrThrow()
      await db.insertInto('products').values({ organization_id: organizationId, coach_id: Number(catalogCoach.id), slug: item.slug, type: 'training_plan', name: item.name, description, price_cents: item.price_cents, currency: 'EUR', tax_code: item.tax_code || null, allowed_training_sports: JSON.stringify(item.sports), includes_coaching: false, training_plan_id: Number(plan.id), release_mode: 'all_at_once', status: reviewProductStatus, created_at: now, updated_at: now }).execute()
      catalogMade += 1
    }
    console.log(`[ts-cloud] lsu review seed: demo storefront under coach #${Number(catalogCoach.id)}, ${catalogMade} of ${CATALOG.length} plans made this run`)
  }
  // A club-scoped sample conversation to an admin, without assigning a personal coach.
  const first = Math.min(ids.runner, ids.admin), second = Math.max(ids.runner, ids.admin)
  const scope = `hq:gym:${organizationId}`
  /*
   * A conversation's id is derived, not chosen. createMessenger().direct()
   * hashes [scope, participantType, first, second] with SHA-256, and opening a
   * thread rejects an id that is not 64 hex characters before it even reads the
   * row. A random UUID therefore seeds a conversation the inbox lists happily,
   * because list() finds it by scope and participants, and no thread can ever
   * open: tapping it derives the real id, misses, and silently creates an empty
   * conversation beside it. That is the empty thread under a row showing its
   * own last message.
   */
  const conversationId = createHash('sha256').update(JSON.stringify([scope, 'users', first, second])).digest('hex')
  const legacy = await db.selectFrom('chat_conversations').select('id').where('scope', '=', scope).where('first_id', '=', first).where('second_id', '=', second).where('id', '!=', conversationId).executeTakeFirst()
  if (!await db.selectFrom('chat_conversations').select('id').where('id', '=', conversationId).executeTakeFirst())
    await db.insertInto('chat_conversations').values({ id: conversationId, first_id: first, second_id: second, scope, participant_type: 'users', created_at: now }).execute()
  // An installation seeded before this carries an unreachable thread. Its
  // messages move across rather than being dropped, since a reviewer may have
  // written some of them, and the row nothing can reach goes.
  if (legacy) {
    await db.updateTable('chat_messages').set({ conversation_id: conversationId }).where('conversation_id', '=', legacy.id).execute()
    await db.deleteFrom('chat_conversations').where('id', '=', legacy.id).execute()
  }
  if (!await db.selectFrom('chat_messages').select('id').where('conversation_id', '=', conversationId).executeTakeFirst()) {
    await db.insertInto('chat_messages').values({ conversation_id: conversationId, sender_id: ids.admin, body: 'Welcome to the LSU review. This is a fictional sample conversation. Your demo calendar has completed sessions and upcoming training to explore.', client_key: crypto.randomUUID(), created_at: now }).execute()
    await db.insertInto('chat_messages').values({ conversation_id: conversationId, sender_id: ids.runner, body: 'Demo reply: I found the long trail run and the method summary. I will review my completed sessions next.', client_key: crypto.randomUUID(), created_at: now }).execute()
  }
})
/*
 * Seeding a row is not the same as being able to sign in, and this seeder has
 * never checked the second thing. Auth.validate is the lookup the login action
 * itself ends up in, by way of Auth.withVerifiedCredentials: the same email
 * normalization, the same table, the same hash comparison. Unlike
 * verifyCredentials it touches no rate limiter, so asking it twelve questions
 * on every deploy records no failed attempts and locks nobody out.
 *
 * This reports rather than throws. The installation serves more than these
 * twelve fixtures, so a broken handout is not a reason to hold back a release
 * of the application itself. It is only worth reporting now that a line from
 * here can actually be read.
 */
const unusable: string[] = []
for (const account of accounts) {
  if (await Auth.validate({ email: account.email, password: account.password })) continue
  /* Row count included because the lookups take the first match of an unordered
   * query, so a duplicate address can pass this seeder and fail the login. */
  const rows = await db.selectFrom('users').select(['id']).where('email', '=', account.email).execute()
  unusable.push(`${account.key} (${rows.length} row${rows.length === 1 ? '' : 's'})`)
}
console.log(`[ts-cloud] lsu review seed: ${accounts.length - unusable.length}/${accounts.length} published credentials authenticate${unusable.length ? `; cannot sign in: ${unusable.join(', ')}` : ''}`)

/*
 * Everything about these accounts except the password, so the blob can be
 * rebuilt without reading it back. LSU_DEMO_ACCOUNTS_JSON is a repository
 * secret, and GitHub will not show you a secret again once it is set, so
 * replacing it means reproducing `name`, `membership` and the role flags
 * from memory. Get `name` wrong and the adoption guard above throws and
 * fails the deploy, which is a slow way to learn you mistyped something.
 *
 * None of this is sensitive: it is the same roster published in docs/roles.md.
 */
console.log(`[ts-cloud] lsu review seed: roster ${JSON.stringify(accounts.map(({ key, name, email, membership, coach, athlete, subscriber }) => ({ key, name, email, membership, coach, athlete, subscriber })))}`)

/*
 * validate() stops at the password. The login action carries on through
 * withVerifiedCredentials, which also consults the rate limiter and re-reads
 * the row under FOR UPDATE before anything is minted. Twelve passwords that
 * verify while the HTTP endpoint answers 401 means the difference lives in
 * that tail, and only the host can say which part of it.
 *
 * One account, because a failure here records a failed attempt against the
 * address. Reset it either way, so probing leaves the handout exactly as it
 * was found and nobody is locked out by a deploy.
 */
const probe = accounts[0]
const limited = await RateLimiter.isRateLimited(probe.email)
let outcome: string
try {
  const minted = await Auth.withVerifiedCredentials({ email: probe.email, password: probe.password }, async (candidate: { id: unknown }) => {
    /* Mint exactly as the action does. This is the one step a password check
     * never reaches, and the previous probe skipped it, which is why it could
     * report a clean sign-in while the endpoint answered 401. */
    const issued = await Auth.createTokenForUser(candidate, { name: 'lsu-seed-probe', expiresInMinutes: 1, withRefreshToken: false })
    return { id: Number(candidate.id), token: issued?.plainTextToken as string | undefined }
  })
  if (minted?.token) {
    await Auth.revokeToken(minted.token)
    outcome = `signs in as user #${minted.id} and mints a token`
  }
  else outcome = minted ? `signs in as user #${minted.id} but minted nothing` : 'withVerifiedCredentials returned null'
}
catch (error) { outcome = `threw ${error instanceof Error ? error.message : String(error)}` }
await RateLimiter.resetAttempts(probe.email)
/* APP_KEY by length only, never its value. config/training-cloud.ts resolves it
 * from LSU_TRAINING_APP_KEY, a secret this repository does not have and the
 * deploy workflow does not pass, so it is expected to be empty here. Saying so
 * out loud costs nothing and settles whether it matters. */
/*
 * Everything above runs in this hook: the new release, this hook's environment,
 * this hook's database handle. The 401 comes from the service that is actually
 * listening, which is a different process with the environment systemd gave it,
 * and nothing so far has asked that process anything.
 *
 * preStart runs before activation, so the port still answers from the release
 * the site is serving right now, which is exactly the one the browser is
 * hitting. Same credential, same endpoint, no Cloudflare and no rpx in between.
 * A 200 here puts the fault at the edge; a 401 here, against twelve passwords
 * this hook just verified, means that process is not reading what this hook
 * reads.
 */
let local = 'not attempted'
try {
  const response = await fetch(`http://127.0.0.1:${process.env.PORT_API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: probe.email, password: probe.password, remember: true }),
    signal: AbortSignal.timeout(15000),
  })
  const body = await response.text()
  /* Never the token: only whether one came back. */
  local = `${response.status} ${response.ok ? '(token issued)' : body.slice(0, 120)}`
}
catch (error) { local = `unreachable: ${error instanceof Error ? error.message : String(error)}` }
await RateLimiter.resetAttempts(probe.email)
console.log(`[ts-cloud] lsu review seed: live service on 127.0.0.1:${process.env.PORT_API} answered ${local}`)

const appKey = String(process.env.APP_KEY || '')
console.log(`[ts-cloud] lsu review seed: full path for ${probe.key}: ${outcome} (rate limited beforehand: ${limited}, APP_KEY ${appKey ? `set, ${appKey.length} chars` : 'EMPTY'})`)

/*
 * ts-cloud forwards a successful hook's output only for lines beginning
 * "[ts-cloud]"; its SSH printer drops every other line and keeps the rest only
 * when the command fails. So this summary wears that prefix or it is never
 * seen, and until it did, a green deploy said nothing at all about whether the
 * twelve review logins existed. That silence is most of why the password rule
 * above went unnoticed for a day.
 */
console.log(`[ts-cloud] lsu review seed: organization #${organizationId}, ${accounts.length} accounts, ${created} created, ${realigned} password${realigned === 1 ? '' : 's'} realigned`)
console.log(`[ts-cloud] ${JSON.stringify({ organization_id: organizationId, users: ids, created, realigned, result: 'LSU demo seeded; published passwords enforced, edited content preserved' })}`)
process.exit(0)
