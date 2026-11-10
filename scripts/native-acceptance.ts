/**
 * Start the native build and its on-device acceptance, without an upload, when
 * a push to main changed what they depend on (.github/workflows/native-acceptance.yml):
 *
 *   bun scripts/native-acceptance.ts <deployed commit>
 *
 * A new HQ kit can change how the app behaves (kit 1.0.4135 removed a row the
 * acceptance script tapped; kit 1.0.4155 made sign-up one form). Each was found
 * half an hour into a release build, after its build number was spent. The ids
 * were still in the source both times, so only running the app finds it. This
 * runs it when the kit pin or the acceptance script moves, once Deploy has the
 * backend on that kit, so a release starts from a known answer
 * (scripts/release-native.ts reads it before releasing).
 */
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'
import { TESTFLIGHT_WORKFLOW } from './testflight-runs'

/** What the app's behaviour under acceptance is made of. A change to any of these is worth forty minutes. */
export const ACCEPTANCE_INPUTS = ['native/hq-source.json', 'scripts/test-native-ios.ts', '.github/workflows/testflight.yml']

/** The acceptance inputs among a push's changed files. */
export function acceptanceInputs(changed: string[]): string[] {
  const paths = new Set(changed.map(path => path.trim()))
  return ACCEPTANCE_INPUTS.filter(path => paths.has(path))
}

/** Where main was before the push that ended at this commit, from GitHub's push activity. */
export function pushBefore(pushes: Array<{ before?: string, after?: string }>, sha: string): string | null {
  const before = pushes.find(push => push.after === sha)?.before
  // All zeros is a branch being created: there was no "before".
  return before && /^[a-f0-9]{40}$/.test(before) && !/^0+$/.test(before) ? before : null
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, '..')
  const run = (command: string, ...values: string[]) => execFileSync(command, values, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  const say = (line: string) => process.stdout.write(`${line}\n`)
  const sha = process.argv[2] || run('git', 'rev-parse', 'HEAD')
  const repository = process.env.GITHUB_REPOSITORY
  if (!repository) throw new Error('GITHUB_REPOSITORY names the repository whose workflow is started')

  // The runner's checkout holds one commit; anything else is fetched as it is needed.
  const has = (commit: string) => {
    try { return run('git', 'cat-file', '-t', commit) === 'commit' }
    catch { return false }
  }

  // A push can carry several commits, and Deploy runs once for its last one, so
  // the question is what the whole push changed.
  let before: string | null = null
  try {
    before = pushBefore(JSON.parse(run('gh', 'api', `repos/${repository}/activity?ref=refs/heads/main&activity_type=push&per_page=50`)), sha)
    if (before && !has(before)) run('git', 'fetch', '--quiet', '--depth=1', 'origin', before)
  }
  catch { before = null }
  if (!before) {
    say(`::warning::GitHub did not say which push ended at ${sha.slice(0, 9)}; looking at that commit alone.`)
    if (!has(`${sha}^`)) run('git', 'fetch', '--quiet', '--depth=2', 'origin', sha)
    before = `${sha}^`
  }
  const inputs = acceptanceInputs(run('git', 'diff', '--name-only', before, sha).split('\n'))
  if (!inputs.length) {
    say('This push changed neither the HQ kit pin nor the acceptance script; nothing to accept.')
    process.exit(0)
  }
  // Never an upload: `upload=false` is the whole difference from a release.
  run('gh', 'workflow', 'run', TESTFLIGHT_WORKFLOW, '--repo', repository, '--ref', 'main', '-f', 'upload=false')
  say(`::notice::Started native acceptance without an upload, because this push changed ${inputs.join(', ')}. Follow it with \`gh run list --workflow ${TESTFLIGHT_WORKFLOW}\`.`)
}
