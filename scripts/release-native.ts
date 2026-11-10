/**
 * Release the LSU app to TestFlight with one command, the way HQ's
 * `bun run release:build` does:
 *
 *   bun run release:build [--dry-run] [--notes "What to test" | --notes-file path] [--no-wait]
 *   bun run release:minor | release:major | bun scripts/release-native.ts --bump 1.2.0
 *
 * It takes the next build number, writes the tester notes from the conventional
 * commits since the previous release (logsmith's grouping, through Stacks'
 * release notes), commits `chore(release): v<version>-build.<n>`, tags it and
 * pushes both. From there nothing needs a laptop: CI runs on the push, Deploy
 * follows CI, and the TestFlight workflow follows Deploy for a release commit
 * (.github/workflows/testflight.yml). The command stays to watch that run and
 * says how it ended; `--no-wait` leaves once the push is out.
 *
 * Moving the HQ kit is a separate, earlier step (`bun run native:pin <version>`),
 * because the backend has to be running a kit before an app built on it ships.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { commitsBetween, fitNotes, NO_VISIBLE_CHANGES, resolveNotes, TESTFLIGHT_NOTES_LIMIT, testerNotes, writeWhatToTest } from '@stacksjs/actions/release-notes'
import { bumpedVersion, DEFAULT_NOTES_LOCALES, nextBuild, NOTES_PROJECT_DIR, RELEASE_COMMIT_PREFIX, releaseTag, withRelease } from './native-release'

const root = resolve(import.meta.dir, '..')
const args = process.argv.slice(2)
const option = (name: string) => {
  const index = args.indexOf(name)
  const value = index === -1 ? undefined : args[index + 1]
  if (index !== -1 && (!value || value.startsWith('--'))) throw new Error(`${name} needs a value`)
  return value
}
if (args.includes('--help')) {
  process.stdout.write('bun run release:build [--dry-run] [--notes "What to test" | --notes-file path] [--no-wait]\nbun scripts/release-native.ts --bump build|patch|minor|major|x.y.z\n\nTester notes are generated from the conventional commits since the previous release unless --notes, --notes-file, RELEASE_NOTES or release.notes in native/product.json says otherwise.\n')
  process.exit(0)
}
const dryRun = args.includes('--dry-run')
const wait = !args.includes('--no-wait')
const bump = option('--bump') || 'build'
const say = (text: string) => process.stdout.write(`${text}\n`)
const git = (...values: string[]) => execFileSync('git', values, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const gh = (...values: string[]) => execFileSync('gh', values, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

// Exactly what is on main, and nothing a laptop has that main does not.
const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
if (branch !== 'main') throw new Error(`Releases are cut from main; this is ${branch}`)
if (git('status', '--porcelain', '--untracked-files=no')) throw new Error('Commit or stash your changes first, so the release is exactly what is on main')
if (!dryRun) git('pull', '--quiet', '--rebase', 'origin', 'main')
git('fetch', '--quiet', '--tags', 'origin')

const productPath = join(root, 'native/product.json')
const productSource = readFileSync(productPath, 'utf8')
const product = JSON.parse(productSource) as { version: string, build: number, site: string, bundleId: string, release?: { notes?: string, notesFile?: string, noteTypes?: string[], excludeScopes?: string[], locales?: string[] } }
const source = JSON.parse(readFileSync(join(root, 'native/hq-source.json'), 'utf8')) as { version: string, revision: string }
const version = bumpedVersion(product.version, bump)
const build = nextBuild(product.build, git('tag', '--list', 'v*-build.*').split('\n'))
const tag = releaseTag(version, build)

// An app talks to the backend it was built for. The workflow refuses a build
// whose kit the backend is not running yet, forty minutes in; say so now.
const backend = await fetch(`${product.site}/api/deployment`, { redirect: 'error', signal: AbortSignal.timeout(15_000) }).then(response => response.ok ? response.json() as Promise<{ source?: string }> : null).catch(() => null)
if (!backend) throw new Error(`${product.site} did not answer /api/deployment; the backend has to be up before an app for it ships`)
if (backend.source !== source.revision) {
  const pending = git('rev-list', '--count', 'origin/main..HEAD') !== '0' ? 'Push the pin first' : 'The Deploy workflow for the pin has not finished'
  throw new Error(`The backend runs HQ ${String(backend.source).slice(0, 9)}, and this app is pinned to kit ${source.version} (${source.revision.slice(0, 9)}). ${pending}, then release.`)
}

// What testers are told: the commits since the previous release, unless a
// person said it themselves. The previous release is the commit that last
// moved the build number, whether this command or a hand made it.
const previous = git('log', '-1', '--format=%H', '-G', '"build":', '--', 'native/product.json') || undefined
const commits = commitsBetween(root, previous, 'HEAD')
const config = product.release ?? {}
const notes = resolveNotes({ cwd: root, flags: { notes: option('--notes'), notesFile: option('--notes-file') }, env: process.env, config, generate: () => testerNotes(commits, { types: config.noteTypes, excludeScopes: config.excludeScopes }) })
const text = fitNotes(notes.text || NO_VISIBLE_CHANGES, TESTFLIGHT_NOTES_LIMIT)
const locales = config.locales?.length ? config.locales : DEFAULT_NOTES_LOCALES
const origin = notes.source === 'generated' ? `${commits.length} commits since ${previous ? previous.slice(0, 9) : 'the first commit'}` : ({ flag: '--notes', env: 'RELEASE_NOTES', config: 'native/product.json release.notes' } as const)[notes.source]

say(`Releasing ${tag}${version === product.version ? '' : ` (version ${product.version} → ${version})`} on HQ kit ${source.version}`)
say(`\nWhat to Test (${origin}):\n\n${text}\n`)
if (dryRun) {
  say(`Dry run complete: would commit ${RELEASE_COMMIT_PREFIX}${tag.slice(1)}, tag ${tag}, push both, and let CI, Deploy and TestFlight follow. Nothing was changed.`)
  process.exit(0)
}

writeFileSync(productPath, withRelease(productSource, version, build))
const written = writeWhatToTest(root, NOTES_PROJECT_DIR, text, locales)
git('add', '--', 'native/product.json', ...written)
git('commit', '--quiet', '-m', `${RELEASE_COMMIT_PREFIX}${tag.slice(1)}`)
git('tag', tag)
// Together or not at all: a tag without its commit on main names a release nobody can build.
git('push', '--atomic', 'origin', 'main', tag)
const sha = git('rev-parse', 'HEAD')
say(`Pushed ${tag} (${sha.slice(0, 9)}). CI, then Deploy, then TestFlight run from here on their own.`)

if (!wait) {
  say('Not waiting. Follow it with `gh run list --workflow testflight.yml`.')
  process.exit(0)
}

/** The newest run of a workflow for this commit, or none yet. */
function runFor(workflow: string): { id: number, status: string, conclusion: string, url: string } | null {
  const rows = JSON.parse(gh('run', 'list', '--workflow', workflow, '--limit', '20', '--json', 'databaseId,headSha,status,conclusion,url')) as Array<{ databaseId: number, headSha: string, status: string, conclusion: string, url: string }>
  const row = rows.find(candidate => candidate.headSha === sha)
  return row ? { id: row.databaseId, status: row.status, conclusion: row.conclusion, url: row.url } : null
}

/** Wait for a workflow's run on this commit to finish. Null when none appeared in time. */
async function finished(workflow: string, appearMinutes: number, finishMinutes: number): Promise<{ conclusion: string, url: string } | null> {
  const appearBy = Date.now() + appearMinutes * 60_000
  let announced = false
  for (;;) {
    const run = runFor(workflow)
    if (run) {
      if (!announced) say(`${workflow}: ${run.url}`)
      announced = true
      if (run.status === 'completed') return { conclusion: run.conclusion, url: run.url }
      if (Date.now() > appearBy + finishMinutes * 60_000) throw new Error(`${workflow} is still running after ${appearMinutes + finishMinutes} minutes: ${run.url}`)
    }
    else if (Date.now() > appearBy) { return null }
    await Bun.sleep(30_000)
  }
}

try { gh('--version') }
catch { throw new Error(`${tag} is pushed and will release on its own; install GitHub's \`gh\` to watch it from here`) }

for (const workflow of ['ci.yml', 'deploy.yml']) {
  const run = await finished(workflow, 10, 30)
  if (!run) throw new Error(`${tag} is pushed, but no ${workflow} run appeared for it. Check the repository's Actions.`)
  if (run.conclusion !== 'success') throw new Error(`${workflow} ended ${run.conclusion} for ${tag}, so TestFlight did not start: ${run.url}. Fix it on main and start the upload with \`gh workflow run testflight.yml --ref main\`; the build number is already taken.`)
}
// The workflow starts itself after Deploy. If another commit reached main in
// between, Deploy ran for that one and the chain did not see a release commit.
let upload = await finished('testflight.yml', 5, 90)
if (!upload) {
  say('TestFlight did not start on its own (a newer commit reached main first); starting it for main.')
  gh('workflow', 'run', 'testflight.yml', '--ref', 'main', '-f', 'upload=true')
  const startedBy = Date.now() + 5 * 60_000
  let url = ''
  while (!url && Date.now() < startedBy) {
    await Bun.sleep(15_000)
    const rows = JSON.parse(gh('run', 'list', '--workflow', 'testflight.yml', '--event', 'workflow_dispatch', '--limit', '1', '--json', 'databaseId,status,url,createdAt')) as Array<{ databaseId: number, status: string, url: string, createdAt: string }>
    if (rows[0] && rows[0].status !== 'completed') url = rows[0].url
  }
  if (!url) throw new Error('The TestFlight workflow could not be started; run `gh workflow run testflight.yml --ref main`')
  say(`testflight.yml: ${url}`)
  const id = url.split('/').at(-1)!
  const deadline = Date.now() + 90 * 60_000
  for (;;) {
    const run = JSON.parse(gh('run', 'view', id, '--json', 'status,conclusion')) as { status: string, conclusion: string }
    if (run.status === 'completed') { upload = { conclusion: run.conclusion, url }; break }
    if (Date.now() > deadline) throw new Error(`TestFlight is still running after 90 minutes: ${url}`)
    await Bun.sleep(30_000)
  }
}
if (upload!.conclusion !== 'success') throw new Error(`TestFlight ended ${upload!.conclusion} for ${tag}: ${upload!.url}. If the upload itself succeeded and only Apple's processing was slow, re-check it without uploading again: \`gh workflow run testflight.yml --ref main -f verify_run=${upload!.url.split('/').at(-1)}\`. Otherwise the build number is taken: fix the cause on main and release the next build.`)
say(`${tag} is on TestFlight and available to its internal testers: ${upload!.url}`)
