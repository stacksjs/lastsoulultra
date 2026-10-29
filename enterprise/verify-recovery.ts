/** Run as root on the dedicated LSU server after an immediate backup. */
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'

if (process.getuid?.() !== 0) throw new Error('Recovery verification requires the owned server administrator')
const configPath = '/etc/ts-cloud/backups.config.ts'
const config = (await import(pathToFileURL(configPath).href)).default
const destination = config.destinations?.[0]
if (config.databases?.length !== 1 || config.databases[0].name !== 'lsu_training'
  || destination?.bucket !== 'lastsoulultra-production-backups' || destination?.region !== 'fsn1'
  || destination?.endpoint !== 'https://fsn1.your-objectstorage.com' || destination?.prefix !== 'lastsoulultra-production'
  || !process.env.TS_CLOUD_BACKUP_ENCRYPTION_KEY) throw new Error('Refusing recovery verification outside the isolated LSU backup policy')
const { decryptBackupFile, RestoreManager } = await import(import.meta.resolve('ts-backups', pathToFileURL('/opt/ts-cloud/backups/package.json').href))
const client = new Bun.S3Client({ ...destination.credentials, bucket: destination.bucket, endpoint: destination.endpoint, region: destination.region })
const objects = (await client.list({ prefix: `${destination.prefix}/`, maxKeys: 1000 })).contents || []
const directory = mkdtempSync('/var/backups/ts-cloud/recovery-')
chmodSync(directory, 0o700)
const database = `lsu_recovery_${Date.now()}`
let created = false
const hash = async (file: string) => new Bun.CryptoHasher('sha256').update(await Bun.file(file).arrayBuffer()).digest('hex')
async function sql(target: string, statement?: string, input?: string) {
  const child = Bun.spawn(['psql', '-U', 'postgres', '-p', '5432', '-v', 'ON_ERROR_STOP=1', '-At', '-d', target, ...(statement ? ['-c', statement] : [])], { stdin: input ? Bun.file(input) : 'ignore', stdout: 'pipe', stderr: 'pipe' })
  const [status, output] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  if (status) throw new Error('The isolated PostgreSQL recovery operation failed; production was not a restore target')
  return output.trim()
}
async function download(name: string) {
  const object = objects.filter(row => row.key && basename(row.key).startsWith(`${name}_`) && row.key.endsWith('.enc')).sort((a, b) => String(b.lastModified).localeCompare(String(a.lastModified)))[0]
  if (!object?.key) throw new Error(`No encrypted offsite snapshot for ${name}`)
  const filename = basename(object.key).slice(0, -4)
  const encrypted = join(directory, `${filename}.enc`)
  const plain = join(directory, filename)
  await Bun.write(encrypted, new Response(client.file(object.key).stream()))
  await decryptBackupFile(encrypted, plain, process.env.TS_CLOUD_BACKUP_ENCRYPTION_KEY)
  const local = join(config.outputPath, filename)
  if (!existsSync(local) || await hash(local) !== await hash(plain)) throw new Error(`Recovered ${name} differs from the engine's original snapshot`)
  return { filename, plain, key: object.key, sha256: await hash(plain) }
}
try {
  const snapshot = await download('lsu_training')
  await sql('postgres', `CREATE DATABASE "${database}"`)
  created = true
  await sql(database, undefined, snapshot.plain)
  const counts = JSON.parse(await sql(database, "SELECT json_build_object('users', (SELECT count(*) FROM users), 'workouts', (SELECT count(*) FROM workouts), 'constraints', (SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace), 'indexes', (SELECT count(*) FROM pg_indexes WHERE schemaname='public'))"))
  if (counts.users < 12 || counts.workouts < 48 || counts.constraints < 10 || counts.indexes < 10) throw new Error('Restored database is missing expected records or schema objects')
  const files = []
  for (const file of config.files) {
    const recovered = await download(file.name)
    const target = join(directory, file.name)
    const summary = await new RestoreManager({ ...config, verbose: false, databases: [], destinations: [], files: [file], outputPath: directory }, { snapshot: recovered.filename, targetPath: target, only: [file.name] }).restore()
    if (summary.failureCount || summary.successCount !== 1) throw new Error(`File recovery failed for ${file.name}`)
    if (file.name === 'lsu-uploads') {
      const fixture = process.env.LSU_RECOVERY_FIXTURE_NAME || ''
      if (!/^lsu-recovery-fixture\.[A-Za-z0-9]+$/.test(fixture)
        || await hash(join(target, fixture)) !== await hash(join(file.path, fixture))) throw new Error('The recovered binary upload differs from the synthetic recovery fixture')
    }
    if (file.name === 'lsu-runtime-recovery') {
      const environment = join(target, '.env')
      chmodSync(environment, 0o600)
      if (!(await Bun.file(environment).text()).includes('APP_KEY=')) throw new Error('The application encryption key is absent from recovery')
    }
    files.push({ name: file.name, offsiteObject: recovered.key, sha256: recovered.sha256, restored: true })
  }
  const proof = { checkedAt: new Date().toISOString(), success: true, encryptedOffsiteDownload: true, authenticatedDecryption: true, originalSnapshotChecksumsMatched: true, productionDatabaseRestoredInto: false, database: { ...counts, offsiteObject: snapshot.key, sha256: snapshot.sha256 }, files }
  writeFileSync('/var/backups/ts-cloud/recovery-proof.json', JSON.stringify(proof, null, 2), { mode: 0o600 })
  console.log(JSON.stringify(proof))
}
finally {
  try { if (created) await sql('postgres', `DROP DATABASE "${database}"`) }
  finally { rmSync(directory, { recursive: true, force: true }) }
}
