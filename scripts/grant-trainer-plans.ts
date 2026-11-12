/* eslint-disable no-console */
/**
 * Give LSU's trainers HQ's Coach plan for free, on every deploy.
 *
 * Run from the coaching application's root (deployment/lsu, where
 * scripts/prepare-training.ts copies it), after the review seed and
 * `installation:admins` have put LSU's own people in place. Who counts as a
 * trainer and what is done for each is scripts/lsu-trainer-plans.ts.
 *
 * It only ever adds or keeps a comp: no charge, no email, nothing removed, and
 * a second run changes nothing. Ending one is HQ's `revokeComp`, by hand.
 */
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { TRAINER_PLAN, trainerIds, trainerPlanAction, trainerPlanSummary } from './lsu-trainer-plans'

if (process.env.DB_DATABASE !== 'lsu_training' || process.env.LSU_SEED_DATABASE !== 'lsu_training' || process.env.LSU_SEED_CONFIRM !== 'last-soul-ultra')
  throw new Error('Trainer plans are granted only in LSU\'s own database, named explicitly.')
const root = process.cwd()
const manifest = await Bun.file(resolve(root, 'package.json')).json()
if (manifest.name !== 'hq-training') throw new Error('Run this from the coaching application root.')
const appModule = (name: string) => import(pathToFileURL(resolve(root, 'app/Support', `${name}.ts`)).href)
const { db } = await import(Bun.resolveSync('@stacksjs/database/runtime', root))
// Standalone scripts provide the server database global used by application helpers.
Object.assign(globalThis, { db })
const database = await db.unsafe('SELECT current_database() AS name').execute()
if (database[0]?.name !== process.env.LSU_SEED_DATABASE)
  throw new Error('LSU_SEED_DATABASE must match the connected database explicitly.')
const { grantComp } = await appModule('platformBilling')
const { planAccess } = await appModule('planAccess')

const organization = await db.selectFrom('organizations').select(['id']).where('slug', '=', 'last-soul-ultra').executeTakeFirst()
if (!organization) {
  // "[ts-cloud]" is the only prefix ts-cloud forwards out of a successful preStart hook.
  console.log('[ts-cloud] lsu trainer plans: no Last Soul Ultra organization yet, nothing to do')
  process.exit(0)
}
const organizationId = Number(organization.id)
const [members, coaches] = await Promise.all([
  db.selectFrom('org_members').select(['user_id', 'role', 'status']).where('organization_id', '=', organizationId).execute(),
  db.selectFrom('coaches').select(['user_id', 'organization_id']).execute(),
])
const trainers = trainerIds(organizationId, members, coaches)
const kept: Record<string, number> = {}
let granted = 0
let skipped = 0
for (const userId of trainers) {
  const { coach: access, plan } = await planAccess(userId)
  const action = trainerPlanAction(access, { entitled: Boolean(plan?.entitled), comped: Boolean(plan?.comped) })
  if (action === 'keep') {
    kept[String(access.via)] = (kept[String(access.via)] || 0) + 1
    continue
  }
  if (action === 'skip') {
    skipped++
    continue
  }
  await grantComp(userId, TRAINER_PLAN)
  granted++
}
console.log(`[ts-cloud] ${trainerPlanSummary({ trainers: trainers.length, granted, kept, skipped })}`)
process.exit(0)
