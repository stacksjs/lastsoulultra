import { mkdtemp, chmod, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const accounts = process.env.LSU_DEMO_ACCOUNTS_JSON
if (!accounts || process.env.DB_DATABASE !== 'lsu_training' || process.env.LSU_SEED_DATABASE !== 'lsu_training')
  throw new Error('Enterprise review seed requires its own database and explicit synthetic account inputs')
/*
 * "[ts-cloud]" is the only prefix ts-cloud forwards out of a successful
 * preStart hook, so this is how a deploy says the seeder was reached at all.
 * Without it, a seeder that never ran and one that ran and changed nothing
 * read identically from the deploy log: both are silence under a green tick.
 */
console.log(`[ts-cloud] lsu review seed: starting against ${process.env.DB_DATABASE} with ${JSON.parse(accounts).length} accounts`)
const directory = await mkdtemp(join(tmpdir(), 'lsu-review-'))
await chmod(directory, 0o700)
try {
  const path = join(directory, 'accounts.json')
  await Bun.write(path, accounts, { mode: 0o600 })
  const child = Bun.spawn([process.execPath, 'deployment/lsu/seed-demo-accounts.ts'], { env: { ...process.env, LSU_DEMO_ACCOUNTS_FILE: path }, stdout: 'inherit', stderr: 'inherit' })
  if (await child.exited) throw new Error('Enterprise review seed failed')
}
finally { await rm(directory, { recursive: true, force: true }) }
