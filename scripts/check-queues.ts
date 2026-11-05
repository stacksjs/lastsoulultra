/**
 * Every queue the installed HQ kit dispatches to has a worker on the training
 * API. A queue with none fills `jobs` and sends nothing, and nothing says so:
 * 421 notifications sat undelivered that way until b9f0a3a. The deploy runs
 * this once `pantry ci` has installed the kit, before any release starts.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import source from '../native/hq-source.json'
import { trainingSites } from '../config/training-cloud'

/** HQ's own side of the platform relay: HQ queues these for installations, which receive them instead. */
export const HQ_ONLY_QUEUES = ['platform-relay']

/** The kit's application code, as `pantry ci` installs it. */
export const kitAppRoot = resolve(import.meta.dir, '..', 'pantry', source.package, 'source', 'app')

/** The queues the kit's jobs name: `queue: '…'` in a definition, or `.onQueue('…')` where one is dispatched. */
export function kitQueues(app = kitAppRoot): string[] {
  const queues = new Set<string>()
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry)
      if (statSync(path).isDirectory()) visit(path)
      else if (path.endsWith('.ts')) {
        for (const match of readFileSync(path, 'utf8').matchAll(/(?:queue:\s*|\.onQueue\(\s*)'([a-z0-9-]+)'/g))
          queues.add(match[1]!)
      }
    }
  }
  visit(app)
  return [...queues].sort()
}

/** The queues the training API's daemons work. */
export function drainedQueues(): string[] {
  return (trainingSites()['training-api'].daemons ?? []).flatMap(daemon => /--queue=(\S+)/.exec(daemon.command)?.[1]?.split(',') ?? [])
}

/** The queues in `queues` that no daemon works and that are not HQ's own. */
export function undrainedQueues(queues: string[]): string[] {
  const drained = new Set(drainedQueues())
  return queues.filter(queue => !drained.has(queue) && !HQ_ONLY_QUEUES.includes(queue))
}

if (import.meta.main) {
  if (!existsSync(kitAppRoot)) throw new Error(`The HQ platform kit is not installed at ${kitAppRoot}: run pantry ci first`)
  const queues = kitQueues()
  const missing = undrainedQueues(queues)
  if (missing.length) throw new Error(`No training-api worker drains ${missing.join(', ')}: add it to a daemon in config/training-cloud.ts`)
  process.stdout.write(`Every queue the HQ platform kit dispatches to has a worker (${queues.join(', ')}).\n`)
}
