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
 * A follow-along session is one video and one "rep", which says nothing about
 * how long it takes. Where neither the document nor its title gives a length
 * ("NSDR 20 min" does, HQ reads that), the session takes its video's length,
 * rounded to the minute. `video-lengths.json` remembers each video's seconds,
 * so only a video seen for the first time is looked up, and a deploy or a
 * test never needs the network.
 *
 * Writes `enterprise/catalog/workouts.json` and `plans/*.json`. The manifest
 * beside them, `catalog.json`, is written by hand: it says which plans exist,
 * the method they follow and which of them are sold. HQ's
 * InstallationCatalogSeeder reads all three on every deploy.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

/** The one video a follow-along session plays, when the session has no length of its own. */
function followAlongVideo(workout: Record<string, any>): string | null {
  if (workout.planned_duration || workout.structure || /\d\s?min/i.test(String(workout.title || ''))) return null
  const exercises = (workout.strength?.blocks || []).flatMap((block: any) => block.exercises || [])
  return exercises.length === 1 && typeof exercises[0].video_url === 'string' ? exercises[0].video_url : null
}

/** A public video's length in seconds, from the page or API anyone can open. */
async function videoSeconds(url: string): Promise<number> {
  const dailymotion = /dailymotion\.com\/video\/([a-z0-9]+)/i.exec(url)
  if (dailymotion) return Number((await (await fetch(`https://api.dailymotion.com/video/${dailymotion[1]}?fields=duration`)).json() as { duration?: number }).duration || 0)
  const page = await (await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'en', 'cookie': 'CONSENT=YES+1' } })).text()
  return Number(/"lengthSeconds":"(\d+)"/.exec(page)?.[1] || 0)
}

const lengthsFile = join(target, 'video-lengths.json')
const lengths: Record<string, number> = existsSync(lengthsFile) ? JSON.parse(readFileSync(lengthsFile, 'utf8')) : {}
const exports = files.map(file => ({ file, plan: JSON.parse(readFileSync(join(source, file), 'utf8')) as Export }))
for (const { plan } of exports) {
  for (const session of plan.sessions) {
    const video = followAlongVideo(session.workout)
    if (!video) continue
    if (!lengths[video]) {
      lengths[video] = await videoSeconds(video)
      if (!lengths[video]) throw new Error(`No length found for ${video} ("${String(session.workout.title)}"): give the session a planned_duration, or add the video's seconds to video-lengths.json`)
    }
    const minutes = Math.max(1, Math.round(lengths[video]! / 60))
    session.workout = { ...session.workout, planned_duration: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:00` }
  }
}
writeFileSync(lengthsFile, `${JSON.stringify(Object.fromEntries(Object.entries(lengths).sort(([a], [b]) => a.localeCompare(b))), null, 1)}\n`)
rmSync(join(target, 'plans'), { recursive: true, force: true })
mkdirSync(join(target, 'plans'), { recursive: true })
for (const { file, plan } of exports) {
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
