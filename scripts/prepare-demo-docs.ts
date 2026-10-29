import { chmod, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

/** Keep review credentials in the gated build, outside this public repository. */
const source = process.env.LSU_DEMO_ACCOUNTS_JSON
  || await Bun.file(process.env.LSU_DEMO_ACCOUNTS_FILE || 'storage/runtime/lsu-handoff/accounts.json').text().catch(() => '')
const keys = ['sam', 'pawel', 'owner', 'admin', 'manager', 'frontdesk', 'trainer', 'coach', 'runner', 'runner2', 'member', 'visitor']
/** Row headers for the credentials table. Names and order follow docs/roles.md. */
const labels: Record<string, string> = { sam: 'Sam, administrator', pawel: 'Pawel, administrator', owner: 'Demo owner', admin: 'Demo administrator', manager: 'Demo manager', frontdesk: 'Demo front desk', trainer: 'Demo trainer', coach: 'Demo coach', runner: 'Alex, Run + Strength', runner2: 'Jamie, Run + Strength', member: 'Demo member, no training enrollment', visitor: 'Demo visitor, no membership or enrollment' }
const supplied: { key: string, email: string, password: string }[] = source ? JSON.parse(source) : []
const accounts = keys.map(key => {
  const account = supplied.find(account => account.key === key)
  if (!account || !account.email.endsWith('@lsu-demo.test') || account.password.length < 24) {
    if (source || process.env.LSU_REQUIRE_DEMO_ACCOUNTS === '1') throw new Error(`Missing valid review account: ${key}`)
    return null
  }
  return { name: labels[key], email: account.email, password: account.password }
}).filter(Boolean)
const directory = resolve('docs/.data')
await mkdir(directory, { recursive: true })
const file = resolve(directory, 'demoAccounts.json')
await Bun.write(file, JSON.stringify(accounts))
await chmod(file, 0o600)
