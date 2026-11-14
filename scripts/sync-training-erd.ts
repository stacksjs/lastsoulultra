/* eslint-disable no-console */
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import layout from '../resources/data/guide/erd-layout.json'
import routes from '../resources/data/guide/erd-routes.json'
import source from '../native/hq-source.json'

interface Column { name: string, type: string, nullable: boolean, primary?: boolean, unique?: boolean, references?: string }
interface Table { columns: Map<string, Column>, constraints: Map<string, { column: string, references: string }>, uniqueTogether: string[][] }
const hash = (text: string) => createHash('sha256').update(text).digest('hex')

/** The generated migration dialect used by the pinned platform kit, not arbitrary SQL. */
export function trainingSchema(migrations: { name: string, sql: string }[], selected: readonly string[]) {
  const tables = new Map<string, Table>()
  const inputs: { file: string, sha256: string }[] = []
  const wanted = new Set(selected)
  function column(name: string, definition: string): Column {
    const type = definition.split(/\s+(?:not null|default|references|primary key|unique|check)\b/i)[0]!.trim().replace(/,$/, '')
    if (!type) throw new Error(`Missing SQL type for ${name}`)
    const reference = /REFERENCES "([^"]+)"\("([^"]+)"\)/i.exec(definition)
    const primary = /PRIMARY KEY/i.test(definition)
    return { name, type, nullable: !primary && !/\bNOT NULL\b/i.test(definition), ...(primary ? { primary: true } : {}), ...(reference ? { references: `${reference[1]}.${reference[2]}` } : {}) }
  }
  for (const { name, sql } of migrations) {
    let affected = false
    let current: Table | undefined
    for (const raw of sql.split('\n')) {
      const line = raw.trim()
      const create = /^CREATE TABLE IF NOT EXISTS "([^"]+)" \(/.exec(line)
      if (create) {
        current = undefined
        if (!wanted.has(create[1]!)) continue
        if (tables.has(create[1]!)) throw new Error(`Duplicate table creation: ${create[1]}`)
        current = { columns: new Map(), constraints: new Map(), uniqueTogether: [] }
        tables.set(create[1]!, current)
        affected = true
        continue
      }
      if (current) {
        if (line === ');') { current = undefined; continue }
        const field = /^"([^"]+)"\s+(.+?)(?:,)?$/.exec(line)
        if (!field) throw new Error(`Unsupported table declaration in ${name}: ${line}`)
        current.columns.set(field[1]!, column(field[1]!, field[2]!))
        continue
      }
      const alter = /^ALTER TABLE "([^"]+)" (.+);$/.exec(line)
      if (alter && wanted.has(alter[1]!)) {
        affected = true
        const table = tables.get(alter[1]!)
        if (!table) throw new Error(`Alter before creation: ${alter[1]}`)
        const statement = alter[2]!
        const add = /^ADD COLUMN IF NOT EXISTS "([^"]+)" (.+)$/.exec(statement)
        const drop = /^DROP COLUMN IF EXISTS "([^"]+)"$/.exec(statement)
        const foreign = /^ADD CONSTRAINT "([^"]+)" FOREIGN KEY \("([^"]+)"\) REFERENCES "([^"]+)"\("([^"]+)"\)/.exec(statement)
        const dropConstraint = /^DROP CONSTRAINT IF EXISTS "([^"]+)"$/.exec(statement)
        const change = /^ALTER COLUMN "([^"]+)" (.+)$/.exec(statement)
        if (add) { if (!table.columns.has(add[1]!)) table.columns.set(add[1]!, column(add[1]!, add[2]!)) }
        else if (drop) table.columns.delete(drop[1]!)
        else if (foreign) table.constraints.set(foreign[1]!, { column: foreign[2]!, references: `${foreign[3]}.${foreign[4]}` })
        else if (dropConstraint) table.constraints.delete(dropConstraint[1]!)
        else if (change) {
          const field = table.columns.get(change[1]!)
          if (!field) throw new Error(`Unknown column: ${alter[1]}.${change[1]}`)
          const operation = change[2]!
          if (operation === 'DROP NOT NULL') field.nullable = true
          else if (operation === 'SET NOT NULL') field.nullable = false
          else if (operation.startsWith('TYPE ')) field.type = operation.slice(5).split(' USING ')[0]!
          else if (operation !== 'DROP DEFAULT' && !operation.startsWith('SET DEFAULT ')) throw new Error(`Unsupported alteration: ${line}`)
        }
        else throw new Error(`Unsupported alteration: ${line}`)
      }
      const unique = /^CREATE UNIQUE INDEX IF NOT EXISTS "[^"]+" ON "([^"]+)" \(([^)]+)\);$/.exec(line)
      if (unique && wanted.has(unique[1]!)) {
        affected = true
        const table = tables.get(unique[1]!)!
        const columns = [...unique[2]!.matchAll(/"([^"]+)"/g)].map(match => match[1]!)
        if (columns.length === 1) table.columns.get(columns[0]!)!.unique = true
        else table.uniqueTogether.push(columns)
      }
    }
    if (affected) inputs.push({ file: name, sha256: hash(sql) })
  }
  for (const [name, table] of tables) {
    for (const constraint of table.constraints.values()) {
      const field = table.columns.get(constraint.column)
      if (!field) throw new Error(`Unknown foreign-key column: ${name}.${constraint.column}`)
      field.references = constraint.references
    }
    for (const field of table.columns.values()) {
      if (!field.references) continue
      const [target, key] = field.references.split('.')
      if (!tables.get(target!)?.columns.has(key!)) throw new Error(`Unresolved foreign key: ${name}.${field.name} -> ${field.references}`)
    }
  }
  for (const name of selected) if (!tables.has(name)) throw new Error(`Missing selected table: ${name}`)
  return { tables, inputs }
}

if (import.meta.main) {
  const check = process.argv.includes('--check')
  const kitRoot = resolve('pantry/@hq/platform')
  const installed = JSON.parse(await readFile(resolve(kitRoot, 'platform.json'), 'utf8'))
  if (installed.version !== source.version || installed.revision !== source.revision) throw new Error('Install the pinned platform kit before generating the ERD')
  const directory = resolve(kitRoot, 'source/database/migrations')
  const migrations = await Promise.all((await readdir(directory)).filter(name => name.endsWith('.sql')).sort().map(async name => ({ name, sql: await readFile(resolve(directory, name), 'utf8') })))
  const { tables, inputs } = trainingSchema(migrations, layout.map(item => item.id))
  let columns = 0
  let foreignKeys = 0
  let selfReferences = 0
  const relationships: Record<string, unknown>[] = []
  const entities = layout.map(item => {
    const table = tables.get(item.id)!
    const attributes = [...table.columns.values()].map(field => {
      columns++
      const key = [...(field.primary ? ['pk'] : []), ...(field.unique ? ['uk'] : []), ...(field.references ? ['fk'] : [])]
      if (field.references) {
        foreignKeys++
        const [target] = field.references.split('.')
        if (target === item.id) selfReferences++
        else {
          // Measured route repairs keep these long links outside intervening tables.
          const sides = item.id === 'training_blocks' && ['organization_id', 'reviewed_by_coach_id'].includes(field.name) ? { fromSide: 'top', toSide: 'top' }
            : item.id === 'customers' && field.name === 'user_id' ? { fromSide: 'left', toSide: 'left' }
              : item.id === 'coupons' && field.name === 'product_id' ? { fromSide: 'right', toSide: 'right' } : {}
          relationships.push({ id: `${item.id}_${field.name}`, from: item.id, to: target, fromCardinality: 'many', toCardinality: 'one', fromOptional: true, toOptional: field.nullable, ...sides, ...(routes as Record<string, object>)[`${item.id}_${field.name}`] })
        }
      }
      return { name: field.name, type: `${field.type}${field.nullable ? '?' : ''}`, ...(key.length ? { key: key.length === 1 ? key[0] : key } : {}), ...(field.references ? { references: field.references } : {}) }
    })
    return { ...item, label: item.id, attributes }
  })
  const schema = {
    schema_version: 1, diagram_type: 'erd',
    meta: { title: 'Last Soul Ultra data relationships', locale: 'en', quality_profile: 'standard', output: 'docs/public/diagrams/lsu-erd/index.html', views: [
      { id: 'roles', label: 'Accounts and roles', focus: ['users', 'organizations', 'org_members', 'coaches', 'athletes'], note: 'Organization permissions, coach profiles and athlete profiles are separate.' },
      { id: 'training', label: 'Training access', focus: ['products', 'coaching_subscriptions', 'product_enrollments', 'training_plans', 'workouts'], note: 'A subscription grants access; an enrollment carries the plan snapshot and calendar delivery.' },
      { id: 'review', label: 'Weekly coach review', focus: ['training_blocks', 'product_enrollments', 'coaching_subscriptions', 'coaches'], note: 'Feedback, evidence, revision and coach approval are recorded before release.' },
      { id: 'feedback', label: 'Feedback and privacy', focus: ['assistant_conversations', 'coaching_voice_feedback', 'health_metrics'], note: 'Training conversations, temporary transcript receipts and personal records have different lifecycles.' },
    ] },
    layout: { mode: 'grid', gapX: 60, gapY: 70, rowH: 16, headerH: 36 }, entities, relationships,
    cards: [
      { dot: 'cyan', title: 'Read the schema', items: [`${columns} columns in ${tables.size} tables, from pinned migration declarations.`, `${foreignKeys - selfReferences} cross-table links are drawn. ${selfReferences} self-reference is retained in the fields.`, 'PK means primary key, FK foreign key and UK a single-column unique key. A type ending in ? allows null.'] },
      { dot: 'amber', title: 'Weekly review', items: ['training_blocks links the subscription, enrollment, athlete and reviewing coach.', 'feedback_at starts the qualifying check-in record. Review and release timestamps describe separate stages.', 'This is declared schema from the source kit, not an inspection of production records.'] },
      { dot: 'emerald', title: 'Compound constraints', items: [...tables].flatMap(([name, table]) => table.uniqueTogether.map(fields => `${name}: unique together (${fields.join(', ')}).`)) },
    ],
  }
  const manifest = { source: { package: source.package, version: source.version, revision: source.revision }, scope: 'Declared schema from pinned migrations; no production database queried.', tables: tables.size, columns, foreign_keys: foreignKeys, rendered_relationships: relationships.length, self_references: selfReferences, migrations: inputs }
  for (const [file, value] of [['docs/public/diagrams/lsu-erd/schema.json', schema], ['docs/public/diagrams/lsu-erd/manifest.json', manifest]] as const) {
    const expected = `${JSON.stringify(value, null, 2)}\n`
    if (check) { if (await Bun.file(file).text() !== expected) throw new Error(`Training ERD source is stale: ${file}`) }
    else await Bun.write(file, expected)
  }
  console.log(`Verified training ERD source: ${tables.size} tables, ${columns} columns, ${foreignKeys} foreign keys, kit ${source.version}.`)
}
