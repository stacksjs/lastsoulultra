/**
 * Hold a deploy that moves the backend to another HQ kit while a TestFlight
 * build is in flight (.github/workflows/deploy.yml):
 *
 *   bun scripts/hold-kit-deploy.ts
 *
 * A build is uploaded only while the backend runs the kit the app was built
 * from (scripts/release-native-ios.ts). A deploy that changes the kit during a
 * build makes that build unreleasable an hour into its run; builds 20 and 21
 * were both lost that way. So a kit change waits for the build, and every other
 * deploy goes straight through.
 *
 * It runs before the kit is installed or anything is deployed.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { RUN_FIELDS, TESTFLIGHT_WORKFLOW, type TestFlightRun, uploadsInFlight } from './testflight-runs'

type Run = Pick<TestFlightRun, 'status' | 'displayTitle' | 'url'>

export interface HoldInput {
  /** The HQ revision this deploy would put live (native/hq-source.json). */
  pinned: string
  /** The revision the backend says it runs, or null when it cannot say. */
  live: string | null
  /** The workflow's recent runs, or null when GitHub would not list them. */
  runs: Run[] | null
  /** Which check this is, from 1, and how many are made before giving up. */
  check: number
  checks: number
}

export interface HoldDecision { action: 'deploy' | 'wait' | 'fail', message: string, warning?: boolean }

/** What one check decides. Only a kit change with a build in flight waits. */
export function holdDecision({ pinned, live, runs, check, checks }: HoldInput): HoldDecision {
  if (!live) return { action: 'deploy', message: 'The backend cannot say which kit it runs; nothing to hold.' }
  if (live === pinned) return { action: 'deploy', message: 'The backend already runs this kit; nothing to hold.' }
  // Not knowing is no reason to block a deploy: the hold protects a build, and
  // a deploy that never happens costs more than one build.
  if (!runs) return { action: 'deploy', warning: true, message: 'Could not read TestFlight runs; deploying the kit change without waiting.' }
  const busy = uploadsInFlight(runs)
  if (!busy.length) return { action: 'deploy', message: `No TestFlight build is in flight; moving the backend to kit ${pinned.slice(0, 9)}.` }
  if (check >= checks) return { action: 'fail', message: `A TestFlight build was still in flight after ${checks} checks (${busy[0]!.url}); the kit change was not deployed. Re-run this deploy once it finishes.` }
  return { action: 'wait', message: `A TestFlight build is in flight (${busy[0]!.url}); holding the move to kit ${pinned.slice(0, 9)} (check ${check} of ${checks}).` }
}

export interface HoldDependencies {
  pinned: string
  live: () => Promise<string | null>
  runs: () => Run[] | null
  sleep: (milliseconds: number) => Promise<unknown>
  say: (line: string) => void
  checks?: number
  intervalMs?: number
}

/** Check until the deploy may go ahead (0) or the build outlasted the wait (1). */
export async function holdKitDeploy(dependencies: HoldDependencies): Promise<0 | 1> {
  const { pinned, live, runs, sleep, say } = dependencies
  // A build takes about forty minutes; eighty checks a minute apart outlast one waiting behind another.
  const checks = dependencies.checks ?? 80
  const intervalMs = dependencies.intervalMs ?? 60_000
  const running = await live()
  for (let check = 1; ; check++) {
    // The runs are only asked for when the kit is changing.
    const decision = holdDecision({ pinned, live: running, runs: running && running !== pinned ? runs() : [], check, checks })
    if (decision.action === 'fail') {
      say(`::error::${decision.message}`)
      return 1
    }
    say(decision.warning ? `::warning::${decision.message}` : decision.message)
    if (decision.action === 'deploy') return 0
    await sleep(intervalMs)
  }
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, '..')
  const json = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8'))
  const site = json('native/product.json').site as string
  process.exit(await holdKitDeploy({
    pinned: json('native/hq-source.json').revision as string,
    live: () => fetch(`${site}/api/deployment`, { redirect: 'error', signal: AbortSignal.timeout(15_000) })
      .then(response => response.ok ? response.json() as Promise<{ source?: unknown }> : null)
      .then(answer => typeof answer?.source === 'string' && answer.source ? answer.source : null)
      .catch(() => null),
    runs: () => {
      try {
        const repository = process.env.GITHUB_REPOSITORY ? ['--repo', process.env.GITHUB_REPOSITORY] : []
        return JSON.parse(execFileSync('gh', ['run', 'list', ...repository, '--workflow', TESTFLIGHT_WORKFLOW, '--limit', '20', '--json', RUN_FIELDS], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })) as TestFlightRun[]
      }
      catch { return null }
    },
    sleep: milliseconds => Bun.sleep(milliseconds),
    say: line => process.stdout.write(`${line}\n`),
  }))
}
