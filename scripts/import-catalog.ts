/* eslint-disable no-console */
/**
 * Turn a coach's plan export into LSU's packaged catalog:
 *
 *   bun scripts/import-catalog.ts <folder of hq-import/*.json>
 *
 * The export is one file per plan, `{ name, weeks, description, sessions:
 * [{ week, day, order, workout }] }`, every workout an `hq.workout.v1`
 * document. Thirty plans repeat a few hundred workouts thousands of times, so
 * the catalog keeps each workout once in `workouts.json` and a plan names its
 * sessions' workouts by key: 21 MB of export is about 1 MB here.
 *
 * Writes `enterprise/catalog/workouts.json` and `plans/*.json`. The manifest
 * beside them, `catalog.json`, is written by hand: it says which plans exist,
 * the method they follow and which of them are sold. HQ's
 * InstallationCatalogSeeder reads all three on every deploy.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { workoutKey } from './import-catalog-keys'

interface Session { week: number, day: number, order: number, workout: Record<string, unknown> }
interface Export { name: string, weeks: number, description: string, sessions: Session[] }

const source = process.argv[2]
if (!source) throw new Error('Name the folder of exported plans: bun scripts/import-catalog.ts <folder>')
const target = resolve(import.meta.dir, '../enterprise/catalog')

const files = readdirSync(source).filter(file => file.endsWith('.json')).sort()
if (!files.length) throw new Error(`No plan files in ${source}`)
const workouts: Record<string, Record<string, unknown>> = {}
rmSync(join(target, 'plans'), { recursive: true, force: true })
mkdirSync(join(target, 'plans'), { recursive: true })
for (const file of files) {
  const plan = JSON.parse(readFileSync(join(source, file), 'utf8')) as Export
  const sessions = plan.sessions.map((session) => {
    const key = workoutKey(session.workout)
    workouts[key] = session.workout
    return { week: session.week, day: session.day, order: session.order, workout: key }
  })
  // One session a line: a changed week reads as a changed week in a diff.
  writeFileSync(join(target, 'plans', file), `{\n  "name": ${JSON.stringify(plan.name)},\n  "weeks": ${plan.weeks},\n  "description": ${JSON.stringify(plan.description)},\n  "sessions": [\n${sessions.map(session => `    ${JSON.stringify(session)}`).join(',\n')}\n  ]\n}\n`)
}
const sorted = Object.fromEntries(Object.entries(workouts).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(join(target, 'workouts.json'), `${JSON.stringify(sorted, null, 1)}\n`)
console.log(`${files.length} plans, ${Object.keys(sorted).length} workouts written to enterprise/catalog`)
